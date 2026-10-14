// A placed collection's first items are its own instances, the same kind its "+" adds (2026-10-14
// user 「Tabs · Table · Tree · Menu · Select · ComboBox 도 동일하게」), and a slot position holding
// those items takes its own style (Card Content · TabList · Menu — the `fillSlot` carries it).
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/slot-owned-collections-live.mjs <out>
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
  process.stdout.write(`${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 600)}\n`);
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
  await search.fill(label.replace(/\\s\?|[\^$?]/g, "").replace(/ /g, " "));
  await page.waitForTimeout(300);
  await page.locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") }).first().click();
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(200);
}
const recordsOf = (type) =>
  page.evaluate((type) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type).map((r) => r.id);
  }, type);
const select = (id) => page.evaluate((id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]), id);
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

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300);
await page.keyboard.type("Owned collections");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await ready();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Design", exact: true }).first().click().catch(() => {});

// 1. First item = "+" item (Component section, ID) for each host; "+" offered on the item's list.
for (const [label, hostType, itemType, plusHost] of [
  ["Tabs", "Tabs", "Tab", "TabList"],
  ["Tree", "Tree", "TreeItem", "Tree"],
  ["Menu", "MenuTrigger", "MenuItem", "Menu"],
  ["Select", "Select", "ListBoxItem", "Select"],
  ["Combo ?Box", "ComboBox", "ListBoxItem", "ComboBox"],
]) {
  const before = await recordsOf(itemType);
  await addFromPalette(label);
  const firstItems = (await recordsOf(itemType)).filter((id) => !before.includes(id));
  await select(firstItems[0]);
  await page.waitForTimeout(500);
  const first = await componentOf();
  const host = (await recordsOf(plusHost)).at(-1);
  await select(host);
  await page.waitForTimeout(500);
  const plusButton = page.getByRole("button", { name: `Insert ${itemType}`, exact: true }).first();
  const offered = await plusButton.isVisible().catch(() => false);
  let plus = null;
  let added;
  if (offered) {
    await plusButton.click();
    await page.waitForTimeout(500);
    added = (await recordsOf(itemType)).filter((id) => !before.includes(id) && !firstItems.includes(id))[0];
    await select(added);
    await page.waitForTimeout(500);
    plus = await componentOf();
  }
  await page.screenshot({ path: `${OUT}/${hostType}.png` });
  record(`${hostType}-first-equals-plus`, !!added && JSON.stringify(first) === JSON.stringify(plus) && first.role === "instance" && first.detach && first.create && first.id, { first, plus, count: firstItems.length, offered });
}

// 2. Table: starts empty — its "+" columns and rows are its own (unchanged).
{
  await addFromPalette("Table");
  const header = (await recordsOf("TableHeader")).at(-1);
  await select(header);
  await page.waitForTimeout(400);
  const insertColumn = page.getByRole("button", { name: "Insert Column", exact: true }).first();
  const offered = await insertColumn.isVisible().catch(() => false);
  if (offered) await insertColumn.click();
  await page.waitForTimeout(400);
  const columns = await recordsOf("Column");
  if (columns.length) await select(columns.at(-1));
  await page.waitForTimeout(400);
  record("Table-plus-column-owned", offered && columns.length > 0, { offered, columns: columns.length, component: await componentOf() });
}

// 3. A slot position holding the instance's items takes a style and keeps the items.
for (const [label, partType] of [["Card", "Content"], ["Tabs", "TabList"], ["Menu", "Menu"]]) {
  await addFromPalette(label);
  const part = (await recordsOf(partType)).at(-1);
  const out = await page.evaluate((part) => {
    const { workspace, commands } = window.__COMPOSITION_CATALOG__;
    const root = workspace.root;
    const count = () => root.canvasInputs.get(part).children.length;
    const items = count();
    let error = null;
    try {
      workspace.execute(commands.setFields({ targets: [workspace.positionOfRecord(part).target], visual: { backgroundColor: { kind: "set", value: "#e11d48" } } }));
    } catch (e) { error = String(e); }
    const after = root.canvasInputs.get(part);
    return { items, after: count(), bg: after.visual.backgroundColor, error };
  }, part);
  await select(part);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/style-${partType}.png` });
  record(`${partType}-style-keeps-items`, !out.error && out.bg === "#e11d48" && out.items === out.after && out.items > 0, out);
}

writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
process.stdout.write(`errors ${errors.length}\n`);
for (const e of errors.slice(0, 8)) process.stdout.write(`  ${e}\n`);
await browser.close();
