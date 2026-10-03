// ADR-248 Phase 4 G3 live leg: the frozen G0 scenarios authored in the real Builder (5175) through
// the public command API, captured with the frozen camera. Output per case: <caseKey>.png (the clip)
// and <caseKey>.json (the live subject entry + live geometry). Usage:
//   node scripts/adr248-g3-live.mjs base|axis|state|child [caseKey,...]
// then ADR248_SCENARIO=<s> ADR248_LIVE_DIR=test-results/adr248-g3-live/<s> vitest --config vitest.adr248-g3.browser.config.ts
// Needs the dev handle (DEV build) and a saved license session (ADR248_AUTH_SESSION, default scripts/.auth-session.json).
import { chromium } from "playwright";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const SCENARIO = process.argv[2] ?? "base";
const ONLY = process.argv[3] ? new Set(process.argv[3].split(",")) : null;
const HERE = dirname(fileURLToPath(import.meta.url));
const DESIGN = resolve(HERE, "../../../docs/adr/design");
const REPLAY = { base: "248-phase3-palette-old-replay.json", axis: "248-phase3-palette-axis-old-replay.json", state: "248-phase3-state-origin-old-replay.json", child: "248-baseline/system-child-scene.json" }[SCENARIO];
const CHILD = SCENARIO === "child";
const SECTION_HOSTS = { "component-listbox-section": "ListBox", "component-menu-section": "Menu", "component-gridlist-section": "GridList" };
const OUT = resolve(HERE, `../test-results/adr248-g3-live/${SCENARIO}`);
mkdirSync(OUT, { recursive: true });
const replay = JSON.parse(readFileSync(`${DESIGN}/${REPLAY}`, "utf8"));
const rows = CHILD ? replay.rows.map((row) => ({ type: row.rootType, id: row.rootId, status: row.status, camera: { zoom: 1, pan: { x: 0, y: 0 } }, nodes: [] })) : SCENARIO === "axis" ? replay.rows.flatMap((row) => row.axes.map((axis) => ({ ...axis, type: row.type }))) : replay.rows;
const caseKey = (row) => row.id ?? (row.axis ? `${row.type}-${row.axis.replace(":", "-")}` : row.type);
const clip = replay.captureClip ?? { x: 0, y: 0, width: 1, height: 1 };
const BASE = process.env.BUILDER_URL ?? "http://localhost:5175";
const state = JSON.parse(readFileSync(process.env.ADR248_AUTH_SESSION ?? resolve(HERE, ".auth-session.json"), "utf8"));
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ storageState: state, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`); });
// The frozen capture date (the harness fakes the same Date): calendars show the same month and today.
await page.clock.setFixedTime(new Date(2026, 8, 28, 12, 0, 0));
await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300); await page.keyboard.type(`G3 live ${SCENARIO} ${Date.now() % 100000}`); await page.keyboard.press("Enter");
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 }); await page.waitForTimeout(2500);
await page.mouse.move(1435, 895);
const summary = [];
let n = 0;
for (const row of rows) {
  const key = caseKey(row);
  if (ONLY && !ONLY.has(key)) continue;
  if (CHILD && row.status !== "AUTHORED") { summary.push({ key, status: "OLD_" + row.status }); continue; }
  n++;
  const result = await page.evaluate(({ row, n, state, clip, host }) => {
    const { workspace, commands, canvas } = window.__COMPOSITION_CATALOG__;
    const graph = workspace.runtime.graph;
    const has = (id) => graph.library.definitions.has(id);
    let definitionId = null;
    if (row.id) definitionId = has(`lib:definition:origin-${row.id}`) ? `lib:definition:origin-${row.id}` : null;
    else if (row.ref) definitionId = has(`lib:definition:origin-${row.ref}`) ? `lib:definition:origin-${row.ref}` : null;
    else for (const id of [`lib:definition:${row.type.toLowerCase()}`, `lib:definition:type-${row.type}`]) if (!definitionId && has(id)) definitionId = id;
    if (!definitionId) return { status: "NO_TYPED_ROUTE" };
    const props = {};
    if (row.axis) { const [prop, value] = row.axis.split(":"); props[prop] = { kind: "set", value }; }
    const id = `project:node:g3-${n}`;
    const entry = { kind: "node", id, definitionId, children: [], props, visual: {}, sizing: state ? {} : { width: { kind: "set", value: 220 }, height: { kind: "set", value: 130 } }, placement: { kind: "absolute", x: 30, y: 30 }, descendantOverrides: [] };
    try {
      if (host) {
        // Child scene: a section root inserted unsized into a 220×130 host at (30,30).
        const hostId = `project:node:g3-host-${n}`;
        const hostEntry = { ...entry, id: hostId, definitionId: `lib:definition:type-${host}`, children: [id] };
        const subject = { ...entry, sizing: {}, placement: undefined };
        delete subject.placement;
        workspace.execute(commands.insertNodes({ parent: { kind: "node", id: "project:node:home-body" }, entries: [hostEntry, subject], rootIds: [hostId], newId: workspace.newId }));
      } else
      workspace.execute(commands.insertNodes({ parent: { kind: "node", id: "project:node:home-body" }, entries: [entry], rootIds: [id], newId: workspace.newId }));
    } catch (error) {
      if (row.axis) {
        // The contract refused the axis prop: run unedited like the harness (it decides whether that is valid).
        try { delete entry.props[row.axis.split(":")[0]]; workspace.execute(commands.insertNodes({ parent: { kind: "node", id: "project:node:home-body" }, entries: [entry], rootIds: [id], newId: workspace.newId })); }
        catch (again) { return { status: "INSERT_FAILED", error: String(again?.message ?? again) }; }
      } else if (state && error?.code === "NESTING_NOT_ALLOWED") {
        // An item origin cannot stand in a page body (RAC content model): the new app's surface for
        // it is the origin view (the old app showed it alone on the Components page).
        workspace.showDefinition(definitionId);
        return { status: "DEFINITION_VIEW", definitionId };
      } else return { status: "INSERT_FAILED", error: String(error?.message ?? error) };
    }
    workspace.session.select([]);
    const root = workspace.root;
    const rel = root.getGeometry(root.canvasInputs.keys());
    const pageAbs = (rid) => { let x = 0, y = 0; for (let c = rid; c && rel.get(c); c = root.canvasInputs.get(c)?.parentId) { x += rel.get(c).x; y += rel.get(c).y; } const r = rel.get(rid); return r ? { x, y, width: r.width, height: r.height } : null; };
    const record = root.recordsOfSource(id)[0];
    // The page body record is the scene origin of page-absolute rects (its rect is the page box).
    let bodyRecord = record; while (bodyRecord && root.canvasInputs.get(bodyRecord)?.parentId && root.canvasInputs.get(root.canvasInputs.get(bodyRecord).parentId)) bodyRecord = root.canvasInputs.get(bodyRecord).parentId;
    const frame = root.pageFrameRects().get(workspace.session.getSnapshot().pageId) ?? { x: 0, y: 0 };
    const subtree = [];
    const walk = (rid) => { subtree.push({ id: rid, type: root.typeOf(root.canvasInputs.get(rid)), rect: pageAbs(rid) }); for (const c of root.canvasInputs.get(rid)?.children ?? []) walk(c); };
    walk(record);
    const rootRect = pageAbs(record);
    let camera = { scale: row.camera.zoom, x: row.camera.pan.x, y: row.camera.pan.y };
    if (state) {
      const oldRoot = row.nodes.find((node) => node.path === "")?.rect;
      const cr = row.camera.canvasRect;
      const anchor = { x: cr.x + cr.width / 2 - (oldRoot.width * row.camera.zoom) / 2, y: cr.y + cr.height / 2 - (oldRoot.height * row.camera.zoom) / 2 };
      camera = { scale: row.camera.zoom, x: anchor.x - (frame.x + rootRect.x) * row.camera.zoom, y: anchor.y - (frame.y + rootRect.y) * row.camera.zoom };
    }
    canvas.setCamera(camera);
    return { status: "AUTHORED", definitionId, entry: graph.getEntry(id), record, frame, camera, subtree };
  }, { row, n, state: SCENARIO === "state", clip, host: CHILD ? SECTION_HOSTS[row.id] : undefined });
  if (result.status === "DEFINITION_VIEW") {
    await page.waitForTimeout(400);
    const view = await page.evaluate(({ row }) => {
      const { workspace, canvas } = window.__COMPOSITION_CATALOG__;
      workspace.session.select([]);
      const root = workspace.root;
      const rel = root.getGeometry(root.canvasInputs.keys());
      const record = [...root.canvasInputs.keys()].find((id) => root.canvasInputs.get(id).parentId === "catalog:root");
      const rootRect = rel.get(record);
      const frame = [...root.pageFrameRects().values()][0] ?? { x: 0, y: 0 };
      const oldRoot = row.nodes.find((node) => node.path === "")?.rect;
      const cr = row.camera.canvasRect;
      const anchor = { x: cr.x + cr.width / 2 - (oldRoot.width * row.camera.zoom) / 2, y: cr.y + cr.height / 2 - (oldRoot.height * row.camera.zoom) / 2 };
      const camera = { scale: row.camera.zoom, x: anchor.x - (frame.x + rootRect.x) * row.camera.zoom, y: anchor.y - (frame.y + rootRect.y) * row.camera.zoom };
      canvas.setCamera(camera);
      return { record, rootRect, frame, camera, anchor };
    }, { row });
    await page.waitForTimeout(350);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    writeFileSync(`${OUT}/${key}.png`, await page.screenshot({ clip }));
    writeFileSync(`${OUT}/${key}.json`, JSON.stringify({ key, status: "AUTHORED", surface: "definition-view", definitionId: result.definitionId, ...view }, null, 1));
    summary.push({ key, status: "CAPTURED", surface: "definition-view", definitionId: result.definitionId });
    await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.showDefinition(undefined));
    await page.waitForTimeout(200);
    continue;
  }
  if (result.status !== "AUTHORED") { summary.push({ key, ...result }); continue; }
  await page.waitForTimeout(350);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  if (!CHILD) writeFileSync(`${OUT}/${key}.png`, await page.screenshot({ clip }));
  const camera = await page.evaluate(() => window.__COMPOSITION_CATALOG__.canvas.camera());
  writeFileSync(`${OUT}/${key}.json`, JSON.stringify({ key, ...result, appliedCamera: camera }, null, 1));
  summary.push({ key, status: "CAPTURED", definitionId: result.definitionId });
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
}
writeFileSync(`${OUT}/_summary.json`, JSON.stringify({ scenario: SCENARIO, clip, cases: summary, errors }, null, 1));
const count = (s) => summary.filter((x) => x.status === s).length;
console.log(SCENARIO, "cases", summary.length, "captured", count("CAPTURED"), "noRoute", count("NO_TYPED_ROUTE"), "insertFailed", count("INSERT_FAILED"), "errors", errors.length);
for (const x of summary.filter((x) => x.status !== "CAPTURED")) console.log("  ", x.key, x.status, x.error ?? "");
console.log(errors.slice(0, 5).join("\n"));
await browser.close();
