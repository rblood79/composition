// ADR-248 Phase 4e G5 (§6.2) in the real Builder (dev 5175, headless Chrome, a fresh profile with the
// saved auth session): the product path's deterministic counts and the stored document bytes.
//
//   bytes   mixed seed 0/1/60/600/5k (G0 perf-baseline `mixed`: Text "Seed i" / frame #dbe7ff,
//           absolute 160×60 on a 6-column grid, fontSize 14, + a second page) → saved →
//           TextEncoder(JSON.stringify(exportDocument())) (the G0 serializer) and the IndexedDB rows
//           the product stored (`composition-catalog-projects-v1` heads + entries of the project).
//   counts  60/600/5k: one user operation = one command through `workspace.execute` (the panels'
//           path), then two frames (the Canvas scene sync) and the autosave to durable. Recorded per
//           operation: graph transaction metrics, `exportDocument` calls, large `JSON.stringify`
//           outputs, `graph.indexes` reads, root metrics (layout input visits · resolver visits ·
//           include checks · affected instances · whole-graph flag), layout engine (WASM) calls by
//           method, Canvas scene sync (patch roots · rebinds), IndexedDB writes (count · bytes).
//           Operations (one node selected, as the Properties panel edits): select · leaf text ·
//           leaf width · move · delete · page switch · deselect · definition edit with 12 instances
//           (fan-out, nothing selected). The seed insert's selection (every seeded node) is cleared.
// The page layout signature path (`scene/layoutCache.ts` · `useLayoutPublisher.ts` ·
// `invalidationPacket.ts`) was deleted in 4e-9; the script records that the files are gone.
// Usage: ADR248_AUTH_SESSION=<session> node scripts/adr248-g5-live.mjs <outDir> [counts]
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const COUNTS = (process.argv[3] ?? "0,1,60,600,5000").split(",").map(Number);
const BASE = process.env.BUILDER_URL ?? "http://localhost:5175";
const state = JSON.parse(readFileSync(process.env.ADR248_AUTH_SESSION, "utf8"));
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ storageState: state, viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => performance.setResourceTimingBufferSize(100000));
const errors = [];

async function ready(page) {
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 60000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace && window.__COMPOSITION_CATALOG__?.canvas, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
}

async function newProject(page, name) {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await ready(page);
}

/** Page-side harness: seed, counters, one measured operation. */
async function install(page) {
  await page.evaluate(async () => {
    const module = (path) => import(performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes(path)) ?? path);
    const palette = await module("/src/builder/catalogRuntime/paletteInsert.ts");
    const sceneModule = await module("/src/builder/catalogRuntime/canvasScene.ts");
    const ws = () => window.__COMPOSITION_CATALOG__.workspace;
    const cmd = () => window.__COMPOSITION_CATALOG__.commands;
    const stringify = JSON.stringify.bind(JSON);
    const encoder = new TextEncoder();
    const counters = {};
    const bump = (key, by = 1) => (counters[key] = (counters[key] ?? 0) + by);
    let on = false;
    // Large serializations: any JSON.stringify output over 64 KiB, and any of an object with `entries`.
    JSON.stringify = function (value, ...rest) {
      const text = stringify(value, ...rest);
      if (on) {
        if (value && typeof value === "object" && "entries" in value && !Array.isArray(value)) bump("stringify.withEntries");
        if (text && text.length > 65536) { bump("stringify.over64KiB"); counters["stringify.maxChars"] = Math.max(counters["stringify.maxChars"] ?? 0, text.length); }
      }
      return text;
    };
    // IndexedDB writes during the operation (the autosave's dirty set).
    for (const method of ["put", "add"]) {
      const original = IDBObjectStore.prototype[method];
      IDBObjectStore.prototype[method] = function (value, ...rest) {
        if (on) { bump(`idb.${this.name}.${method}`); bump("idb.bytes", encoder.encode(stringify(value) ?? "").byteLength); }
        return original.call(this, value, ...rest);
      };
    }
    // Canvas scene sync: patch roots and rebinds (Skia dirty roots).
    const sync = sceneModule.CatalogCanvasScene.prototype.sync;
    sceneModule.CatalogCanvasScene.prototype.sync = function () {
      const result = sync.call(this);
      if (on) {
        bump(`scene.${result.kind}`);
        if (result.kind === "patched") { bump("scene.patchRoots", result.update.patchRoots.length); bump("scene.reboundRecords", result.update.rebound.length); }
        if (result.kind === "rebound") bump(`scene.rebind.${result.reason}`);
      }
      return result;
    };
    const wrapped = new WeakSet();
    const instrumentGraph = (graph) => {
      if (wrapped.has(graph)) return;
      wrapped.add(graph);
      const exportDocument = graph.exportDocument.bind(graph);
      graph.exportDocument = () => { if (on) bump("graph.exportDocument"); return exportDocument(); };
      const proto = Object.getPrototypeOf(graph);
      const indexes = Object.getOwnPropertyDescriptor(proto, "indexes");
      Object.defineProperty(graph, "indexes", { get() { if (on) bump("graph.indexesRead"); return indexes.get.call(graph); } });
    };
    const instrumentEngine = (root) => {
      const tree = root.layout;
      const engine = tree && Object.values(tree).find((v) => v && typeof v.updateStyleRaw === "function");
      if (!engine || wrapped.has(engine)) return;
      wrapped.add(engine);
      for (const name of ["buildTreeBatch", "buildTreeBatchBinary", "createNodeRaw", "updateStyleRaw", "setChildren", "markDirty", "removeNode", "computeLayout", "getLayoutsBatch", "clear"]) {
        const fn = engine[name];
        if (typeof fn !== "function") continue;
        engine[name] = function (...args) {
          if (on) bump(`wasm.${name}`);
          if (on && name === "getLayoutsBatch") {
            const n = Array.isArray(args[0]) ? args[0].length : 0;
            bump("wasm.getLayoutsBatch.ids", n);
            // Where a large geometry read comes from (top app frames of the stack).
            if (n > 50) {
              const frames = (new Error().stack ?? "").split("\n").slice(2).filter((l) => l.includes("/src/")).slice(0, 6).map((l) => l.replace(/^.*\/src\//, "").replace(/\?[^:]*/, "").replace(/\)$/, "")).join(" < ");
              bump(`wasm.getLayoutsBatch.large@${frames}`, n);
            }
          }
          return fn.apply(this, args);
        };
      }
    };
    const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const saved = async () => {
      for (let i = 0; i < 400; i++) {
        const w = ws();
        const s = w.autosave.getSnapshot().state;
        if (s === "saved" && w.runtime.durableRevision === w.runtime.graph.revision) return true;
        await new Promise((r) => setTimeout(r, 25));
      }
      return false;
    };
    const node = (i, lib) => {
      const text = i % 2 === 0;
      return {
        kind: "node", id: `project:node:perf-seed-${i}`,
        definitionId: palette.catalogPaletteDefinitionId(lib, text ? "Text" : "frame"),
        children: [],
        props: text ? { children: { kind: "set", value: `Seed ${i}` } } : {},
        visual: { fontSize: { kind: "set", value: 14 }, ...(text ? {} : { backgroundColor: { kind: "set", value: "#dbe7ff" } }) },
        sizing: { width: { kind: "set", value: 160 }, height: { kind: "set", value: 60 } },
        placement: { kind: "absolute", x: 20 + (i % 6) * 200, y: 20 + Math.floor(i / 6) * 90 },
        descendantOverrides: [],
      };
    };
    const homePage = () => ws().runtime.graph.getEntry(ws().runtime.graph.getEntry(ws().runtime.graph.projectId).pageIds[0]);
    const bodyOf = (page) => page.children[0];
    window.__G5__ = {
      async seed(count) {
        const graph = ws().runtime.graph;
        const body = bodyOf(homePage());
        if (count > 0) {
          const entries = Array.from({ length: count }, (_, i) => node(i, graph.library));
          ws().execute(cmd().insertNodes({ parent: { kind: "node", id: body }, entries, rootIds: entries.map((e) => e.id), newId: ws().newId, label: "Seed" }));
        }
        const bodyId = "project:node:perf-page-2-body";
        ws().execute(cmd().createPage({
          page: { kind: "page", id: "project:page:perf-page-2", route: "/perf-page-2", name: "Perf Page 2", children: [bodyId] },
          entries: [{ kind: "node", id: bodyId, definitionId: "lib:definition:type-body", name: "Body", children: [], props: {}, visual: {}, sizing: {}, descendantOverrides: [] }],
        }));
        // The seed insert selects every inserted node; a user edits one selected node.
        ws().session.clearSelection();
        await frames();
        return saved();
      },
      /** Select one seeded node (the Properties panel's edit target) — `measure` it or not. */
      selectSeed: (w) => w.session.select([{ target: { kind: "node", id: "project:node:perf-seed-0" }, identity: w.root.recordsOfSource("project:node:perf-seed-0")[0] }]),
      clearSelection: (w) => w.session.clearSelection(),
      async bytes() {
        const graph = ws().runtime.graph;
        const documentBytes = encoder.encode(stringify(graph.exportDocument())).byteLength;
        const projectId = graph.projectId;
        const db = await new Promise((r, j) => { const q = indexedDB.open("composition-catalog-projects-v1"); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
        const read = (store, range) => new Promise((r, j) => { const q = db.transaction(store).objectStore(store).getAll(range); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
        const heads = await read("heads", projectId);
        const rows = await read("entries", IDBKeyRange.bound([projectId], [projectId, []]));
        db.close();
        const size = (v) => encoder.encode(stringify(v)).byteLength;
        const definitions = Object.values(graph.exportDocument().entries).filter((e) => e.kind === "definition" || e.kind === "definitionOverride").length;
        return { documentBytes, idbHeadBytes: heads.reduce((s, v) => s + size(v), 0), idbEntryRows: rows.length, idbEntryBytes: rows.reduce((s, v) => s + size(v), 0), projectDefinitionEntries: definitions };
      },
      /** One operation: `run()` executes commands; counters cover the command, two frames and the save. */
      async measure(run) {
        instrumentGraph(ws().runtime.graph);
        instrumentEngine(ws().root);
        for (const key of Object.keys(counters)) delete counters[key];
        on = true;
        const t0 = performance.now();
        const before = ws().runtime.graph.revision;
        run(ws(), cmd());
        const graphMetrics = { ...ws().runtime.graph.metrics };
        const m = ws().root.metrics;
        const rootMetrics = { changedIds: m.changedIds.length, removedIds: m.removedIds.length, affectedRootIds: m.affectedRootIds.length, layoutInputVisits: m.layoutInputVisits, resolverVisits: m.resolverVisits, resolverIncludeChecks: m.resolverIncludeChecks, affectedInstanceCount: m.affectedInstanceCount, canvasInputUpdates: m.canvasInputUpdates, domInputUpdates: m.domInputUpdates, traversedWholeInputGraph: m.traversedWholeInputGraph };
        const commandMs = performance.now() - t0;
        await frames();
        const isSaved = await saved();
        on = false;
        // No transaction (page switch): the graph and root metrics still describe the last commit.
        const committed = ws().runtime.graph.revision !== before;
        return { revisionDelta: ws().runtime.graph.revision - before, commandMs: Math.round(commandMs * 10) / 10, saved: isSaved, graphMetrics: committed ? graphMetrics : null, rootMetrics: committed ? rootMetrics : null, counters: { ...counters } };
      },
      ops: {
        leafText: (w, c) => w.execute(c.setFields({ targets: [{ kind: "node", id: "project:node:perf-seed-0" }], props: { children: { kind: "set", value: `Edited ${Date.now()}` } } })),
        leafWidth: (w, c) => w.execute(c.setFields({ targets: [{ kind: "node", id: "project:node:perf-seed-0" }], sizing: { width: { kind: "set", value: 172 } } })),
        move: (w, c) => w.execute(c.moveNodes({ ids: ["project:node:perf-seed-2"], parent: { kind: "node", id: bodyOf(homePage()) }, index: 0, newId: w.newId })),
        remove: (w, c) => w.execute(c.removeTargets({ targets: [{ kind: "node", id: "project:node:perf-seed-4" }] })),
        pageSwitch: (w) => w.session.setPage("project:page:perf-page-2"),
        pageBack: (w) => w.session.setPage(homePage().id),
      },
      /** Make perf-seed-1 (a frame) a component and place 12 instances (not measured). */
      async prepareFanout() {
        const w = ws(), c = cmd();
        w.execute(c.createComponent({ id: "project:node:perf-seed-1", name: "PerfCard", newId: w.newId }));
        const graph = w.runtime.graph;
        const definitionId = graph.getEntry(graph.projectId).definitionIds.at(-1);
        if (!definitionId) throw new Error("component definition not found");
        const entries = Array.from({ length: 12 }, (_, k) => ({ kind: "node", id: `project:node:perf-instance-${k}`, definitionId, children: [], props: {}, visual: {}, sizing: {}, placement: { kind: "absolute", x: 1300 + (k % 3) * 200, y: 20 + Math.floor(k / 3) * 90 }, descendantOverrides: [] }));
        w.execute(c.insertNodes({ parent: { kind: "node", id: bodyOf(homePage()) }, entries, rootIds: entries.map((e) => e.id), newId: w.newId }));
        w.session.clearSelection();
        await frames();
        await saved();
        return { definitionId, instances: graph.instancesOf(definitionId).size };
      },
      fanoutEdit: (w, c) => w.execute(c.setFields({ targets: [{ kind: "node", id: "project:node:perf-seed-1" }], visual: { backgroundColor: { kind: "set", value: "#ffd8a8" } } })),
      bodyLayout: () => { const r = ws().root; const body = bodyOf(homePage()); const rec = r.recordsOfSource(body)[0]; return rec ? (r.canvasInputs.get(rec)?.layout ?? null) : null; },
    };
  });
}

const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 240)}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 240)}`); });
const result = {
  measuredAt: new Date().toISOString(),
  head: execSync("git rev-parse HEAD", { encoding: "utf8" }).trim(),
  dirty: execSync("git status --short -- ../../apps ../../packages", { encoding: "utf8" }).trim().split("\n").filter(Boolean),
  environment: { url: BASE, build: "dev", browser: "headless Chrome (playwright channel chrome)", viewport: "1440x900" },
  deletedSignaturePaths: Object.fromEntries(["src/builder/workspace/canvas/scene/layoutCache.ts", "src/builder/hooks/useLayoutPublisher.ts", "src/builder/workspace/canvas/renderers/invalidationPacket.ts"].map((p) => [p, existsSync(resolve(p)) ? "PRESENT" : "absent"])),
  bytes: [],
  counts: {},
};
for (const count of COUNTS) {
  await newProject(page, `g5-${count}-${Date.now()}`);
  await install(page);
  const seeded = await page.evaluate((n) => window.__G5__.seed(n), count);
  const bytes = await page.evaluate(() => window.__G5__.bytes());
  result.bytes.push({ count, seededSaved: seeded, ...bytes });
  process.stdout.write(`bytes ${count}: document ${bytes.documentBytes} · idb ${bytes.idbHeadBytes + bytes.idbEntryBytes} (${bytes.idbEntryRows} rows)\n`);
  if (count < 60) continue;
  const ops = {};
  ops.select = await page.evaluate(() => window.__G5__.measure(window.__G5__.selectSeed));
  for (const name of ["leafText", "leafWidth", "move", "remove", "pageSwitch", "pageBack"]) {
    ops[name] = await page.evaluate((op) => window.__G5__.measure(window.__G5__.ops[op]), name);
  }
  ops.deselect = await page.evaluate(() => window.__G5__.measure(window.__G5__.clearSelection));
  ops.fanoutSetup = await page.evaluate(() => window.__G5__.prepareFanout());
  ops.fanoutEdit = await page.evaluate(() => window.__G5__.measure(window.__G5__.fanoutEdit));
  ops.bodyLayout = await page.evaluate(() => window.__G5__.bodyLayout());
  result.counts[count] = ops;
  const brief = (o) => `rev+${o.revisionDelta} entriesTraversed ${o.graphMetrics?.transactionEntriesTraversed ?? "-"} export ${o.counters["graph.exportDocument"] ?? 0} bigJSON ${o.counters["stringify.over64KiB"] ?? 0} layoutVisits ${o.rootMetrics?.layoutInputVisits ?? "-"} resolver ${o.rootMetrics?.resolverVisits ?? "-"} wasm.update ${o.counters["wasm.updateStyleRaw"] ?? 0} patchRoots ${o.counters["scene.patchRoots"] ?? 0} rebind ${Object.keys(o.counters).filter((k) => k.startsWith("scene.rebind.")).join("|") || 0} idb ${o.counters["idb.entries.put"] ?? 0}`;
  for (const [name, o] of Object.entries(ops)) if (o?.counters) process.stdout.write(`  ${count} ${name}: ${brief(o)}\n`);
}
result.errors = errors;
writeFileSync(`${OUT}/g5-live.json`, JSON.stringify(result, null, 1));
process.stdout.write(`errors ${errors.length}\n`);
await browser.close();
