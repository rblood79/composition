// ADR-248 Phase 4e-12 live: labelPosition side and palette-instance fills / layout in the real
// Builder (5175), driven through the Properties and Styles panels. Inserts go through the palette
// definition (the same composite the palette inserts); the edits under test are panel clicks.
// Usage: ADR248_AUTH_SESSION=<session> node scripts/adr248-4e12-live.mjs <outDir>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5175";
const state = JSON.parse(readFileSync(process.env.ADR248_AUTH_SESSION, "utf8"));
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ storageState: state, viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`); });
await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300); await page.keyboard.type(`4e-12 live ${Date.now() % 100000}`); await page.keyboard.press("Enter");
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 }); await page.waitForTimeout(2500);
await page.evaluate(async () => {
  const { workspace, commands } = window.__COMPOSITION_CATALOG__;
  const palette = await import("/src/builder/catalogRuntime/paletteInsert.ts");
  const graph = workspace.runtime.graph;
  window.__4E12__ = {
    insert(id, type) {
      const nodeId = `project:node:${id}`;
      workspace.execute(commands.insertNodes({ parent: { kind: "node", id: "project:node:home-body" }, entries: [{ kind: "node", id: nodeId, definitionId: palette.catalogPaletteDefinitionId(graph.library, type), children: [], props: {}, visual: {}, sizing: { width: { kind: "set", value: 420 } }, descendantOverrides: [] }], rootIds: [nodeId], newId: workspace.newId }));
      workspace.selectRecords([workspace.root.recordsOfSource(nodeId)[0]]);
    },
    /** Child boxes of the record (page-relative to the owner) by type. */
    boxes(id) {
      const root = workspace.root;
      const record = root.recordsOfSource(`project:node:${id}`)[0];
      const input = root.canvasInputs.get(record);
      const ids = [record, ...input.children];
      const geometry = root.getGeometry(ids);
      return Object.fromEntries(ids.map((rid, index) => [index === 0 ? "root" : `${root.typeOf(root.canvasInputs.get(rid))}${index}`, (({ x, y, width, height }) => [x, y, width, height].map(Math.round))(geometry.get(rid))]));
    },
    record: (id) => { const root = workspace.root; return root.canvasInputs.get(root.recordsOfSource(`project:node:${id}`)[0]); },
    entry: (id) => graph.getEntry(`project:node:${id}`),
  };
});
const shot = async (name) => writeFileSync(`${OUT}/${name}.png`, await page.screenshot());
const panel = async (name) => {
  const button = page.getByRole("button", { name, exact: true });
  if ((await button.getAttribute("aria-pressed")) !== "true") await button.click();
  await page.waitForTimeout(500);
};
const results = {};

/** Properties panel: pick `value` in the segmented field labelled `label` (a RAC radio group). */
async function pickProperty(label, value) {
  await page.getByRole("radiogroup", { name: label, exact: true }).getByRole("radio", { name: value, exact: true }).click();
  await page.waitForTimeout(500);
}

// 1. labelPosition side through the Properties panel: TextField · ProgressBar · Select.
await panel("Properties");
for (const [id, type] of [["tf", "TextField"], ["pb", "ProgressBar"], ["sel", "Select"]]) {
  await page.evaluate(([id, type]) => window.__4E12__.insert(id, type), [id, type]);
  await page.waitForTimeout(500);
  const before = await page.evaluate((id) => window.__4E12__.boxes(id), id);
  await pickProperty("Label Position", "Side");
  const after = await page.evaluate((id) => window.__4E12__.boxes(id), id);
  const prop = await page.evaluate((id) => window.__4E12__.entry(id).props.labelPosition ?? null, id);
  await shot(`side-${id}`);
  results[`side-${type}`] = { prop, before, after };
}
// 2. Fill on a palette TextField through the Styles panel (Add fill).
await page.evaluate(() => window.__4E12__.insert("tf-fill", "TextField"));
await panel("Styles");
await page.getByRole("tab", { name: "Style", exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Add fill" }).click();
await page.waitForTimeout(600);
await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
await page.waitForTimeout(400);
await shot("fill-tf");
results.fill = await page.evaluate(() => ({ own: window.__4E12__.entry("tf-fill").fills ?? null, record: window.__4E12__.record("tf-fill").fills ?? null }));
// 3. Layout on a palette ListBox through the Styles panel (Direction: Block).
await page.evaluate(() => window.__4E12__.insert("lb", "ListBox"));
await page.getByRole("tab", { name: "Layout", exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole("radio", { name: "Row", exact: true }).click();
await page.waitForTimeout(600);
await shot("layout-lb");
results.layout = await page.evaluate(() => ({ own: window.__4E12__.entry("lb").layout ?? null, record: window.__4E12__.record("lb").layout, boxes: window.__4E12__.boxes("lb") }));

writeFileSync(`${OUT}/result.json`, JSON.stringify({ results, errors }, null, 1));
console.log(JSON.stringify({ errors: errors.length }));
await browser.close();
