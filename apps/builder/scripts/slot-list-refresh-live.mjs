// The Design panel's slot list follows a group's "+" (2026-10-14 user report: ToggleButtonGroup's
// list did not refresh after its "+", RadioGroup · CheckboxGroup · TagGroup's did).
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/slot-list-refresh-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(readFileSync(`${process.cwd()}/apps/builder/scripts/.auth-session.json`, "utf8"));
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const page = await (await browser.newContext({ storageState: state, viewport: { width: 1600, height: 1000 } })).newPage();
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(`${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 700)}\n`);
};
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`); });
const ready = () => page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
async function addFromPalette(label) {
  await ready();
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page.getByRole("button", { name: "Components", exact: true }).first().click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page.locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") }).first().click();
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(200);
}
const last = (type) =>
  page.evaluate((type) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type).at(-1)?.id;
  }, type);
const select = (id) => page.evaluate((id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]), id);
/** The Design panel's Property tab: every section's title and its text. */
const panelText = () =>
  page.evaluate(() => {
    const panel = document.querySelector('.workspace-panel-frame[data-panel="properties"]');
    return [...(panel?.querySelectorAll(".section") ?? [])].map((section) => ({
      id: section.getAttribute("data-section-id"),
      title: section.querySelector(".section-title")?.textContent?.trim(),
      text: section.querySelector(".section-content")?.textContent?.replace(/\s+/g, " ").trim().slice(0, 300),
    }));
  });

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300);
await page.keyboard.type("Slot list refresh");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await ready();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Design", exact: true }).first().click().catch(() => {});

for (const [label, type, item] of [
  ["Toggle Button Group", "ToggleButtonGroup", "ToggleButton"],
  ["Radio Group", "RadioGroup", "Radio"],
]) {
  await addFromPalette(label);
  const host = await last(type);
  await select(host);
  await page.waitForTimeout(500);
  const before = await panelText();
  await page.getByRole("button", { name: `Insert ${item}`, exact: true }).first().click();
  await page.waitForTimeout(500);
  await select(host);
  await page.waitForTimeout(500);
  const after = await panelText();
  writeFileSync(`${OUT}/${type}.json`, JSON.stringify({ before, after }, null, 2));
  const count = (sections) => sections.map((s) => s.text ?? "").join(" ").split(item).length - 1;
  // (A RadioGroup's Content lists its options by label — "Option 3" is the new one.)
  const grew =
    type === "RadioGroup"
      ? after.some((s) => s.text?.includes("Option 3")) && !before.some((s) => s.text?.includes("Option 3"))
      : count(after) > count(before);
  record(`${type}-panel-after-plus`, grew, { before: count(before), after: count(after), slot: after.filter((s) => s.title === "Slot" || s.title === "Content").map((s) => s.text.slice(0, 160)) });
}

// ListBox: the first item and the one its "+" adds show the same Component section and an ID.
const componentOf = () =>
  page.evaluate(() => {
    const panel = document.querySelector('.workspace-panel-frame[data-panel="properties"]');
    const identity = panel?.querySelector(".component-semantics-identity");
    const idField = [...(panel?.querySelectorAll("fieldset") ?? [])].find((f) => f.querySelector("legend")?.textContent?.trim() === "ID");
    return {
      name: identity?.querySelector(".component-semantics-identity-name")?.textContent ?? null,
      role: identity?.getAttribute("data-role") ?? null,
      detach: !!panel?.querySelector('[aria-label*="Detach"]'),
      create: [...(panel?.querySelectorAll("button") ?? [])].some((b) => b.textContent?.includes("Create component")),
      id: !!idField?.querySelector("input")?.value,
    };
  });
await addFromPalette("List Box");
const list = await last("ListBox");
const itemsOf = () =>
  page.evaluate((list) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return root.canvasInputs.get(list).children.filter((id) => root.typeOf(root.canvasInputs.get(id)) === "ListBoxItem");
  }, list);
const firstItems = await itemsOf();
await select(firstItems[0]);
await page.waitForTimeout(500);
const first = await componentOf();
await select(list);
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Insert ListBoxItem", exact: true }).first().click();
await page.waitForTimeout(500);
const allItems = await itemsOf();
const added = allItems.find((id) => !firstItems.includes(id));
await select(added);
await page.waitForTimeout(500);
const plus = await componentOf();
record("listbox-first-equals-plus", allItems.length === firstItems.length + 1 && JSON.stringify(first) === JSON.stringify(plus) && first.detach && first.id && first.role === "instance", { first, plus, count: [firstItems.length, allItems.length] });
await page.screenshot({ path: `${OUT}/listbox.png` });
// The items' boxes and own fields: the first ones and the "+" one lay out alike.
const boxes = await page.evaluate((list) => {
  const { workspace } = window.__COMPOSITION_CATALOG__;
  const root = workspace.root;
  const graph = workspace.runtime.graph;
  return root.canvasInputs.get(list).children.map((id) => {
    const r = root.canvasInputs.get(id);
    const g = root.getGeometry([id]).get(id);
    const node = graph.getEntry(r.sourceId);
    return { type: root.typeOf(r), w: Math.round(g?.width ?? -1), h: Math.round(g?.height ?? -1), visual: node?.visual, sizing: node?.sizing, props: node?.props, overrides: node?.descendantOverrides?.map((o) => o.kind + ":" + o.address.templatePath.at(-1)) };
  });
}, list);
writeFileSync(`${OUT}/listbox-boxes.json`, JSON.stringify(boxes, null, 2));
const widths = boxes.filter((b) => b.type === "ListBoxItem").map((b) => b.w);
record("listbox-items-same-width", new Set(widths).size === 1, { widths });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
process.stdout.write(`errors ${errors.length}\n`);
for (const e of errors.slice(0, 8)) process.stdout.write(`  ${e}\n`);
await browser.close();
