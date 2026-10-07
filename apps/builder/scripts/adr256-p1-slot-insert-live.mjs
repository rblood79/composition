// ADR-256 Phase 1 live: the Properties slot section's insert list is the position's children kind.
// (1) A Toolbar instance shows its root slot (F4) and fills it from its own selection: the list
// offers built-in origins (Button · Heading …); choosing Button adds one to the Canvas record and
// to the Preview toolbar. (2) A Tabs instance's TabList position lists only Tab (items), and
// filling it adds a tab in the Preview. Real Builder, headed Chrome, saved auth session.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p1-slot-insert-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const page = await context.newPage();
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
async function addFromPalette(label) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page
    .locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") })
    .first()
    .click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
}
const slotsModule = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/slots.ts`;

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-256 P1 slot insert");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);

// ── (1) Toolbar root slot ────────────────────────────────────────────────
await addFromPalette("toolbar");
await page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first()
  .click();
await page.waitForTimeout(2500);
const selectType = (type) =>
  page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const rec = [...ws.root.canvasInputs.values()].find(
      (r) => ws.root.typeOf(r) === type,
    );
    ws.selectRecords([rec.id]);
    return rec.id;
  }, type);
const choose = async (name) => {
  // The list popover can sit past the viewport edge: choose it with the keyboard (RAC ListBox).
  const option = page.getByRole("option", { name, exact: true });
  await option.focus();
  await page.keyboard.press("Enter");
};
const counts = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const records = [...ws.root.canvasInputs.values()];
    const toolbar = records.find((r) => ws.root.typeOf(r) === "Toolbar");
    const tabList = records.find((r) => ws.root.typeOf(r) === "TabList");
    const typeOfChild = (id) => ws.root.typeOf(ws.root.canvasInputs.get(id));
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    return {
      canvasToolbarButtons:
        toolbar?.children.filter((id) => typeOfChild(id) === "Button").length ??
        null,
      canvasTabs:
        tabList?.children.filter((id) => typeOfChild(id) === "Tab").length ??
        null,
      previewToolbarButtons:
        doc?.querySelectorAll('[role="toolbar"] button').length ?? null,
      previewTabs: doc?.querySelectorAll('[role="tab"]').length ?? null,
    };
  });
await selectType("Toolbar");
await page.waitForTimeout(800);
const before = await counts();
const openDesign = async () => {
  const fill = page.locator('button[aria-label="Fill slot"]').first();
  if (await fill.isVisible().catch(() => false)) return fill;
  await page
    .getByRole("button", { name: "Design", exact: true })
    .first()
    .click();
  await page.waitForTimeout(1000);
  return fill;
};
const fillSelect = await openDesign();
const sectionVisible = await fillSelect.isVisible().catch(() => false);
record("P1-1 Toolbar instance shows its root slot (F4)", sectionVisible, {
  sectionVisible,
});
await fillSelect.click();
await page.waitForTimeout(400);
const toolbarOptions = await page.getByRole("option").allTextContents();
record(
  "P1-2 Toolbar list offers built-in origins",
  ["Button", "Heading", "Checkbox", "Text"].every((name) =>
    toolbarOptions.includes(name),
  ),
  { count: toolbarOptions.length, sample: toolbarOptions.slice(0, 12) },
);
await choose("Button");
await page.waitForTimeout(1500);
const after = await counts();
record(
  "P1-3 filling adds a Button to Canvas and Preview",
  after.canvasToolbarButtons === before.canvasToolbarButtons + 1 &&
    after.previewToolbarButtons === before.previewToolbarButtons + 1,
  { before, after },
);
await page.screenshot({ path: `${OUT}/toolbar-filled.png` });

// ── (2) Tabs › TabList lists only Tab ────────────────────────────────────
await addFromPalette("tabs");
await page.waitForTimeout(1500);
const tabListOptions = await page.evaluate(async (slotsModule) => {
  const { catalogSlotInsertOptions } = await import(slotsModule);
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const rec = [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r) === "TabList",
  );
  const position = ws.positionOfRecord(rec.id);
  return catalogSlotInsertOptions(ws.runtime.graph, position.target).map(
    (option) => option.label,
  );
}, slotsModule);
record(
  "P1-4 TabList position lists only Tab",
  tabListOptions.length > 0 && tabListOptions.every((name) => name === "Tab"),
  { tabListOptions },
);
const tabsBefore = await counts();
await selectType("TabList");
await page.waitForTimeout(800);
await (await openDesign()).click();
await page.waitForTimeout(400);
const uiTabOptions = await page.getByRole("option").allTextContents();
await choose("Tab");
await page.waitForTimeout(1500);
const tabsAfter = await counts();
record(
  "P1-5 the UI list for TabList = [Tab] and filling adds a tab (Canvas · Preview)",
  JSON.stringify(uiTabOptions.filter((t) => t !== "Add content…")) ===
    JSON.stringify(["Tab"]) &&
    tabsAfter.canvasTabs === tabsBefore.canvasTabs + 1 &&
    tabsAfter.previewTabs === tabsBefore.previewTabs + 1,
  { uiTabOptions, tabsBefore, tabsAfter },
);
await page.screenshot({ path: `${OUT}/tabs-filled.png` });

record("P1-6 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
