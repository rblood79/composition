// Slot contents as owned instances (2026-10-14, user 「slot 호스트 전부」): in the real Builder, a
// ToggleButtonGroup from the palette holds "Toggle 1 · 2" as its own ToggleButton nodes. Selecting
// one shows what the "+"-added ToggleButton shows — Design panel Component section "ToggleButton ·
// Instance" with go-to-origin, detach and create component, the Attributes section with its ID, and
// the Layers row's instance dot. On the Components page the group's template ToggleButton (a
// template position) still reads as an instance.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/template-row-instance-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"));
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({ storageState: state, viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
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
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(300);
}
const last = (type) =>
  page.evaluate((type) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type).at(-1)?.id;
  }, type);
/** The drawn records of a type under a record (the group's ToggleButtons). */
const under = (ownerId, type) =>
  page.evaluate(({ ownerId, type }) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const walk = (id) => { const r = root.canvasInputs.get(id); return r ? [r, ...r.children.flatMap(walk)] : []; };
    return walk(ownerId).slice(1).filter((r) => root.typeOf(r) === type).map((r) => r.id);
  }, { ownerId, type });
const select = (id) => page.evaluate((id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]), id);
const targetKind = (id) => page.evaluate((id) => window.__COMPOSITION_CATALOG__.workspace.itemOfRecord(id)?.target.kind, id);
/** What the Design panel Component section shows for the selection. */
const componentSection = () =>
  page.evaluate(() => {
    const panel = document.querySelector('.workspace-panel-frame[data-panel="properties"]') ?? document;
    const identity = panel.querySelector(".component-semantics-identity");
    const titles = [...panel.querySelectorAll(".section-title, .panel-section-title, [class*='section'] h3, [class*='Section'] button")].map((el) => el.textContent?.trim()).filter(Boolean);
    const idInput = [...panel.querySelectorAll("fieldset")].find((field) => field.querySelector("legend")?.textContent?.trim() === "ID")?.querySelector("input");
    return {
      attributes: titles.includes("Attributes") || !!panel.textContent?.includes("Attributes"),
      id: idInput ? idInput.value : null,
      create: [...panel.querySelectorAll("button")].some((b) => b.textContent?.includes("Create component")),
      name: identity?.querySelector(".component-semantics-identity-name")?.textContent ?? null,
      role: identity?.getAttribute("data-role") ?? null,
      roleLabel: identity?.querySelector(".component-semantics-identity-role")?.textContent ?? null,
      goToOrigin: !!panel.querySelector('[aria-label="Go to origin"], [aria-label="Go to component"]'),
      detach: !!panel.querySelector('[aria-label*="Detach"]'),
    };
  });
/** The Layers rows (every collapsed row expanded first): text → dot role. */
const layerDot = async (text) => {
  for (let pass = 0; pass < 6; pass += 1) {
    const expanded = await page.evaluate(() => {
      const nav = document.querySelector('.workspace-panel-frame[data-panel="navigator"]') ?? document;
      const buttons = [...nav.querySelectorAll('.layer-expand-button[aria-expanded="false"]')];
      for (const b of buttons) b.click();
      return buttons.length;
    });
    await page.waitForTimeout(150);
    if (!expanded) break;
  }
  return page.evaluate((text) => {
    const nav = document.querySelector('.workspace-panel-frame[data-panel="navigator"]') ?? document;
    const rows = [...nav.querySelectorAll(".elementItem")].map((row) => {
      const dot = row.querySelector(".editing-semantics-dot");
      return {
        text: row.querySelector(".elementItemLabelText")?.textContent?.trim() ?? "",
        active: row.classList.contains("active"),
        dot: dot ? ([...dot.classList].find((c) => c.startsWith("editing-semantics-dot--")) ?? "dot") : null,
      };
    });
    return { rows, found: rows.find((row) => row.active && row.text === text) ?? null };
  }, text);
};

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300);
await page.keyboard.type("Template row instance");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await ready();
await page.waitForTimeout(1500);

await addFromPalette("togglebuttongroup").catch(async () => addFromPalette("toggle button group"));
// Open the Layers and Design panels (a new project starts with them closed).
await page.getByRole("button", { name: "Navigator", exact: true }).first().click().catch(() => {});
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Design", exact: true }).first().click().catch(() => {});
await page.waitForTimeout(500);
const group = await last("ToggleButtonGroup");
const buttons = await under(group, "ToggleButton");
record("group-placed", !!group && buttons.length === 2, { group, buttons });

// 1) The template row (descendant target).
await select(buttons[0]);
await page.waitForTimeout(500);
const kind1 = await targetKind(buttons[0]);
const section1 = await componentSection();
const dot1 = await layerDot("ToggleButton");
record("placed-item-owned-instance", kind1 === "node" && section1.name === "ToggleButton" && section1.role === "instance" && section1.goToOrigin && section1.detach && section1.create && section1.attributes && !!section1.id && dot1.found?.dot === "editing-semantics-dot--instance", { kind1, section1, dot1: dot1.found });
await page.screenshot({ path: `${OUT}/template-row.png` });

// 2) The "+" added owned ToggleButton for comparison (the group's add-item).
await select(group);
await page.waitForTimeout(300);
const addButton = page.getByRole("button", { name: "Insert ToggleButton", exact: true }).first();
let added = [];
if (await addButton.isVisible().catch(() => false)) {
  await addButton.click();
  await page.waitForTimeout(500);
  added = (await under(group, "ToggleButton")).filter((id) => !buttons.includes(id));
}
if (added.length) {
  await select(added[0]);
  await page.waitForTimeout(500);
  const kind2 = await targetKind(added[0]);
  const section2 = await componentSection();
  const dot2 = await layerDot("ToggleButton");
  record("plus-item-same-as-placed", kind2 === "node" && section2.name === "ToggleButton" && section2.role === "instance" && section2.detach && section2.create && section2.attributes && !!section2.id && dot2.found?.dot === "editing-semantics-dot--instance" && JSON.stringify({ ...section2, id: !!section2.id }) === JSON.stringify({ ...section1, id: !!section1.id }), { kind2, section2, dot2: dot2.found });
} else record("owned-row-instance", false, { note: "add button not found", added });

// 3) Components page: the ToggleButtonGroup sample's template ToggleButton.
await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.showDefinition("lib:definition:origin-component-togglebuttongroup"));
await page.waitForTimeout(1500);
const sample = await page.evaluate(() => {
  const root = window.__COMPOSITION_CATALOG__.workspace.root;
  return [...root.canvasInputs.values()].find((r) => root.typeOf(r) === "ToggleButtonGroup")?.id;
});
const sampleButtons = sample ? await under(sample, "ToggleButton") : [];
if (sampleButtons.length) {
  await select(sampleButtons[0]);
  await page.waitForTimeout(500);
  const kind3 = await targetKind(sampleButtons[0]);
  const section3 = await componentSection();
  record("components-page-row-instance", kind3 === "descendant" && section3.name === "ToggleButton" && section3.role === "instance", { kind3, section3 });
  await page.screenshot({ path: `${OUT}/components-page.png` });
} else record("components-page-row-instance", false, { sample, sampleButtons });

writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
process.stdout.write(`\n${results.filter((r) => r.pass).length}/${results.length} PASS · errors ${errors.length}\n`);
for (const e of errors.slice(0, 8)) process.stdout.write(`  ${e}\n`);
await browser.close();
