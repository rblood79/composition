// ADR-248 G5 WebKit function check (the G0 `webkit-smoke` counterpart for the catalog Builder):
// Playwright WebKit, a fresh profile with the saved auth session, dev Builder (5175).
//   dashboard → new project → insert a frame 240×120 and a Text through the command layer →
//   the Canvas draws them (scene bounds), undo/redo, saved → reload: the same document;
//   page/console errors 0.
// Usage: ADR248_AUTH_SESSION=<session> node scripts/adr248-g5-webkit.mjs <out.json>
import { webkit } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const OUT = process.argv[2];
const BASE = process.env.BUILDER_URL ?? "http://localhost:5175";
const state = JSON.parse(readFileSync(process.env.ADR248_AUTH_SESSION, "utf8"));
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({ storageState: state, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await context.addInitScript(() => performance.setResourceTimingBufferSize?.(100000));
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 240)}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 240)}`); });
const checks = [];
const check = (id, pass, detail) => { checks.push({ id, pass, detail }); process.stdout.write(`${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 300)}\n`); };
const ready = async () => {
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 90000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace && window.__COMPOSITION_CATALOG__?.canvas, null, { timeout: 90000 });
  await page.waitForTimeout(1500);
};
try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type(`g5-webkit-${Date.now()}`);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 60000 });
  await ready();
  const drawn = await page.evaluate(async () => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace, cmd = h.commands, palette = h.palette;
    const graph = ws.runtime.graph;
    const home = graph.getEntry(graph.getEntry(graph.projectId).pageIds[0]);
    const def = (type) => palette.catalogPaletteDefinitionId(graph.library, type);
    const entries = [
      { kind: "node", id: "project:node:wk-frame", definitionId: def("frame"), children: [], props: {}, visual: { backgroundColor: { kind: "set", value: "#dbe7ff" } }, sizing: { width: { kind: "set", value: 240 }, height: { kind: "set", value: 120 } }, placement: { kind: "absolute", x: 40, y: 40 }, descendantOverrides: [] },
      { kind: "node", id: "project:node:wk-text", definitionId: def("Text"), children: [], props: { children: { kind: "set", value: "WebKit" } }, visual: {}, sizing: {}, placement: { kind: "absolute", x: 40, y: 200 }, descendantOverrides: [] },
    ];
    ws.execute(cmd.insertNodes({ parent: { kind: "node", id: home.children[0] }, entries, rootIds: entries.map((e) => e.id), newId: ws.newId }));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const bounds = (id) => { const rec = ws.root.recordsOfSource(id)[0]; const b = rec && h.canvas.boundsOf(rec); return b ? { width: Math.round(b.width), height: Math.round(b.height) } : null; };
    return { frame: bounds("project:node:wk-frame"), text: bounds("project:node:wk-text") };
  });
  check("draws a frame 240×120 and a text", drawn.frame?.width === 240 && drawn.frame?.height === 120 && (drawn.text?.width ?? 0) > 0, drawn);
  const history = await page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const has = () => Boolean(ws.runtime.graph.getEntry("project:node:wk-text"));
    const seen = [has()];
    ws.undo(); seen.push(has());
    ws.redo(); seen.push(has());
    return seen;
  });
  check("undo/redo", JSON.stringify(history) === "[true,false,true]", history);
  await page.waitForFunction(() => { const ws = window.__COMPOSITION_CATALOG__.workspace; return ws.autosave.getSnapshot().state === "saved" && ws.runtime.durableRevision === ws.runtime.graph.revision; }, null, { timeout: 20000 });
  const before = await page.evaluate(() => Object.keys(window.__COMPOSITION_CATALOG__.workspace.runtime.graph.exportDocument().entries).sort().join(","));
  await page.reload();
  await ready();
  const after = await page.evaluate(() => Object.keys(window.__COMPOSITION_CATALOG__.workspace.runtime.graph.exportDocument().entries).sort().join(","));
  check("saved → reload: same entries", before === after && after.includes("project:node:wk-frame"), { entries: after.split(",").length });
  writeFileSync(`${OUT}.png`, await page.screenshot());
} catch (error) {
  check("run", false, { threw: String(error?.message ?? error).slice(0, 300) });
} finally {
  check("page/console errors 0", errors.length === 0, errors);
  writeFileSync(OUT, JSON.stringify({ measuredAt: new Date().toISOString(), head: execSync("git rev-parse HEAD", { encoding: "utf8" }).trim(), browser: `webkit ${browser.version()}`, base: BASE, checks, errors }, null, 1));
  await browser.close();
}
