// ADR-248 Phase 4e-9-7 live: the three catalog Styles host repairs exercised through the real
// Styles panel (5175). Seeds go through a page-side catalog Styles host (the same writes the
// panel makes); the edits under test are panel clicks. Usage:
//   ADR248_AUTH_SESSION=<session> node scripts/adr248-4e97-live.mjs <outDir>
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
await page.waitForTimeout(300); await page.keyboard.type(`4e-9-7 live ${Date.now() % 100000}`); await page.keyboard.press("Enter");
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 }); await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Styles", exact: true }).click();
await page.waitForTimeout(600);
// Page-side seed host + component command (pure modules; the workspace is the live one).
await page.evaluate(async () => {
  const live = window.__COMPOSITION_CATALOG__;
  const hostMod = await import("/src/builder/panels/styles/catalog/catalogStylesHost.ts");
  const comp = await import("/src/builder/catalogRuntime/componentActions.ts");
  const fill = await import("/src/types/builder/fill.types.ts");
  const palette = await import("/src/builder/catalogRuntime/paletteInsert.ts");
  const { workspace, commands } = live;
  const seed = hostMod.createCatalogStylesHost(workspace);
  const graph = workspace.runtime.graph;
  const defOf = (type) => palette.catalogPaletteDefinitionId(graph.library, type);
  window.__4E97__ = {
    seed, fill,
    insert(nodes) {
      const entries = nodes.map((n) => ({ kind: "node", id: `project:node:${n.id}`, definitionId: n.type ? defOf(n.type) : "lib:definition:type-frame", children: nodes.filter((c) => c.parent === n.id).map((c) => `project:node:${c.id}`), props: {}, visual: {}, sizing: {}, descendantOverrides: [] }));
      workspace.execute(commands.insertNodes({ parent: { kind: "node", id: "project:node:home-body" }, entries, rootIds: nodes.filter((n) => !n.parent).map((n) => `project:node:${n.id}`), newId: workspace.newId }));
    },
    record: (id) => workspace.root.recordsOfSource(`project:node:${id}`)[0],
    componentize(id, name) {
      const parentOf = (nodeId) => [...graph.getEntry("project:node:home-body").children].includes(nodeId) ? "project:node:home-body" : null;
      const parent = parentOf(`project:node:${id}`);
      const index = graph.getEntry(parent).children.indexOf(`project:node:${id}`);
      workspace.execute(comp.catalogComponentCommands.create(`project:node:${id}`, name, workspace.newId));
      const instance = graph.getEntry(parent).children[index];
      return { instance, record: workspace.root.recordsOfSource(instance)[0] };
    },
    select: (records) => workspace.selectRecords(records),
    depth: () => workspace.runtime.historyDepth.undo,
    undo: () => workspace.undo(),
    entry: (id) => graph.getEntry(id),
    childRecord: (record) => workspace.root.domInputs.get(record).children[0],
  };
});
const shot = async (name) => writeFileSync(`${OUT}/${name}.png`, await page.screenshot());
const tab = async (name) => { await page.getByRole("tab", { name, exact: true }).click(); await page.waitForTimeout(400); };
const results = {};

// A. readFills — an instance child's "Add fill" stacks on the component layer it shows.
const a = await page.evaluate(() => {
  const T = window.__4E97__;
  T.insert([{ id: "form" }, { id: "field-1", type: "TextField", parent: "form" }]);
  T.select([T.record("field-1")]);
  T.seed.updateFills([T.fill.createDefaultColorFill("#112233FF")]);
  const { instance, record } = T.componentize("form", "Form");
  const child = T.childRecord(record);
  T.select([child]);
  return { instance, child, before: T.seed.readFills().map((f) => f.type + ":" + (f.color ?? "")) };
});
await tab("Style");
await shot("a-before");
await page.getByRole("button", { name: "Add fill" }).click();
await page.waitForTimeout(500);
await shot("a-after");
results.fills = await page.evaluate((a) => {
  const T = window.__4E97__;
  const after = T.seed.readFills();
  return { ...a, after: after.map((f) => f.type + ":" + (f.color ?? "")), pass: after.length === 2 && after[0].type === "color" && after[0].color === "#112233FF" && after[1].type === "linear-gradient" };
}, a);

// B. readSelectedTarget — an instance of an inline-flex component keeps inline-flex on an alignment click.
const b = await page.evaluate(() => {
  const T = window.__4E97__;
  T.insert([{ id: "row" }]);
  T.select([T.record("row")]);
  T.seed.updateStyles({ display: "inline-flex" });
  const { instance, record } = T.componentize("row", "Row");
  T.select([record]);
  return { instance, before: T.seed.readSelectedTarget().style.display, ownBefore: T.entry(instance).layout?.display ?? null };
});
await tab("Layout");
await shot("b-before");
await page.getByRole("radio", { name: "Top left" }).click();
await page.waitForTimeout(500);
await shot("b-after");
results.inlineFlex = await page.evaluate((b) => {
  const T = window.__4E97__;
  const entry = T.entry(b.instance);
  const after = T.seed.readSelectedTarget().style;
  return { ...b, after: { display: after.display, alignItems: after.alignItems, justifyContent: after.justifyContent }, ownLayout: entry.layout, pass: after.display === "inline-flex" && entry.layout?.display === undefined && entry.layout?.alignItems !== undefined && after.alignItems !== undefined };
}, b);

// C. Direction toggle on a ProgressBar with a stale inline direction: prop + cleanup in one step.
const c = await page.evaluate(() => {
  const T = window.__4E97__;
  T.insert([{ id: "bar", type: "ProgressBar" }]);
  T.select([T.record("bar")]);
  T.seed.updateStyles({ display: "flex", flexDirection: "column", width: "240px" });
  const style = T.seed.readSelectedTarget().style;
  return { depth: T.depth(), before: { ownLayout: T.entry("project:node:bar").layout, display: style.display, flexDirection: style.flexDirection, width: style.width, labelPosition: T.entry("project:node:bar").props.labelPosition ?? null } };
});
await shot("c-before");
await page.getByRole("radio", { name: "Row" }).click();
await page.waitForTimeout(500);
await shot("c-after");
results.direction = await page.evaluate((c) => {
  const T = window.__4E97__;
  const read = () => { const s = T.seed.readSelectedTarget().style; const e = T.entry("project:node:bar"); return { flexDirection: s.flexDirection, width: s.width, ownDisplay: e.layout?.display ?? null, ownFlexDirection: e.layout?.flexDirection ?? null, labelPosition: e.props.labelPosition ?? null }; };
  const after = read();
  const steps = T.depth() - c.depth;
  T.undo();
  const undone = read();
  const pass = steps === 1 && JSON.stringify(after.labelPosition) === JSON.stringify({ kind: "set", value: "side" }) && after.ownDisplay === null && after.ownFlexDirection === null && after.width === "240px" && undone.flexDirection === "column" && undone.ownFlexDirection !== null && undone.ownDisplay !== null && undone.labelPosition === null;
  return { ...c, after, steps, undone, pass };
}, c);

writeFileSync(`${OUT}/result.json`, JSON.stringify({ results, errors }, null, 1));
console.log(JSON.stringify({ fills: results.fills.pass, inlineFlex: results.inlineFlex.pass, direction: results.direction.pass, errors: errors.length }));
await browser.close();
