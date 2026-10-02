// ADR-248 G5 (§6.2) paired timing: the old app (G5 baseline build, ADR-243 closed `2a5c97099`) and the
// new app (catalog Builder, a production build with `VITE_COMPOSITION_HARNESS=1` — the harness
// handle only; a normal build has the same bundle without it) on the same machine, served as
// production dists under `/composition/`, headless Chrome 1440×900, fresh profiles + the saved auth.
//
// Fixture per app: dashboard → new project → mixed seed N (G0 perf-baseline `mixed`: Text "Seed i" /
// frame #dbe7ff, absolute 160×60, 6 columns) + a second page; `perf-seed-1` (a frame) becomes a
// component origin with 12 instances. Same semantic IDs; each app builds it through its own API
// (old: element store actions; new: catalog commands).
//
// One run = reload → ready → settle → CPU throttle → for each operation `OPS` inputs, each timed
// from dispatch to the second animation frame after it (the change on screen), `GAP_MS` apart,
// after `WARMUP` unmeasured inputs:
//   select      select perf-seed-0 / perf-seed-2 alternately
//   edit        width of perf-seed-3 (frame) 160 → 164 → …
//   fanout      fill of the origin perf-seed-1 (12 instances follow)
//   pageSwitch  home ↔ second page
//   save        a text edit → the stored head revision advances (IndexedDB poll, 5 ms)
// and `LOADS` reloads → ready (load). Before a run the old app's one-time origin impact dialog is
// approved (it asks once per session; the new app's commands do not ask). Runs alternate A/B (old first on even runs) `RUNS` times.
// Judgment (§6.2): per run p95; median over runs; after ≤ before × 1.10 + 2 ms (save/load + 10 ms).
//
// Usage: ADR248_AUTH_SESSION=<session> node scripts/adr248-g5-paired.mjs <out.json> \
//          --old <oldDist> --new <newHarnessDist> [--sizes 60,600,5000] [--cpu 1,4] [--runs 5]
//          [--ops 100] [--loads 20]
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { loadStorageState, seedDocument } from "./perf-baseline.mjs";
import { serveDist } from "./adr248-g5-boot-bundle.mjs";

const args = process.argv.slice(2);
const OUT = args[0];
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const OLD_DIST = opt("old");
const NEW_DIST = opt("new");
const SIZES = opt("sizes", "60,600,5000").split(",").map(Number);
const CPUS = opt("cpu", "1,4").split(",").map(Number);
const RUNS = Number(opt("runs", "5"));
const OPS = Number(opt("ops", "100"));
const LOADS = Number(opt("loads", "20"));
const GAP_MS = 50;
/** Unmeasured inputs per operation before the measured ones (first mount, shader warm-up). */
const WARMUP = 5;
const SETTLE_MS = 1500;
const OP_NAMES = ["select", "edit", "fanout", "pageSwitch", "save"];

const log = (line) => process.env.G5_DEBUG && process.stdout.write(`  · ${line}\n`);
const pct = (values, q) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const at = (sorted.length - 1) * q;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return +(sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo)).toFixed(2);
};
const median = (values) => pct(values, 0.5);

const APPS = {
  old: {
    dist: OLD_DIST,
    port: 4191,
    ready: () =>
      Boolean(
        window.__composition_STORE__?.getState().currentPageId &&
          document.querySelector(".app:not(.builder-booting)") &&
          document.querySelector('[data-testid="skia-canvas-unified"]'),
      ),
    async seed(page, count) {
      // A project already has two pages (home + the system Components page): add a perf page with
      // an empty body (the new app's second page) and switch to it.
      let seeded = await seedDocument(page, count, "mixed", 2);
      if (!seeded.pageIds.some((id) => id.startsWith("perf-seed-page-")))
        seeded = await seedDocument(page, count, "mixed", seeded.pageIds.length + 1);
      return page.evaluate(async ({ homePageId, pageIds }) => {
        const store = window.__composition_STORE__;
        const s = store.getState();
        await s.toggleComponentOrigin("perf-seed-1");
        const body = s.elements.find((e) => e.page_id === homePageId && e.type === "body");
        for (let k = 0; k < 12; k++) {
          const instance = store.getState().createInstance("perf-seed-1", body.id, homePageId);
          if (!instance) throw new Error("createInstance failed");
          await store.getState().updateElementProps(instance.id, {
            ...(instance.props ?? {}),
            style: { ...(instance.props?.style ?? {}), position: "absolute", left: `${1300 + (k % 3) * 200}px`, top: `${20 + Math.floor(k / 3) * 90}px` },
          });
          await new Promise((r) => setTimeout(r, 0));
        }
        store.getState().setSelectedElement(null);
        return { homePageId, otherPageId: pageIds.find((id) => id.startsWith("perf-seed-page-")) };
      }, seeded);
    },
    /**
     * The old app asks once per session before an origin edit that reaches instances
     * (`EditingSemanticsImpactDialog`, approval cached until reload): approve it before measuring.
     */
    async prepare(page) {
      await page.evaluate(() => {
        const store = window.__composition_STORE__;
        const el = store.getState().elements.find((e) => e.id === "perf-seed-1");
        window.__g5Warm = store.getState().updateElementProps("perf-seed-1", { ...el.props, style: { ...(el.props?.style ?? {}), backgroundColor: "#dbe7ff" } });
      });
      const proceed = page.locator(".editing-impact-actions button").last();
      await proceed.waitFor({ state: "visible", timeout: 15000 });
      await proceed.click();
      await page.evaluate(() => window.__g5Warm);
    },
    install: () => {
      const store = () => window.__composition_STORE__;
      const element = (id) => store().getState().elementsMap?.get(id) ?? store().getState().elements.find((e) => e.id === id);
      const props = (id, patch) => {
        const el = element(id);
        return store().getState().updateElementProps(id, { ...el.props, ...patch(el.props ?? {}) });
      };
      return {
        select: (k) => store().getState().setSelectedElement(k % 2 ? "perf-seed-2" : "perf-seed-0"),
        edit: (k) => props("perf-seed-3", (p) => ({ style: { ...(p.style ?? {}), width: `${160 + (k % 5) * 4}px` } })),
        fanout: (k) => props("perf-seed-1", (p) => ({ style: { ...(p.style ?? {}), backgroundColor: k % 2 ? "#ffd8a8" : "#dbe7ff" } })),
        pageSwitch: (k, ids) => store().getState().activatePage(k % 2 ? ids.homePageId : ids.otherPageId),
        saveEdit: (k) => props("perf-seed-0", () => ({ children: `Save probe ${k}` })),
        headDb: "composition",
        headStore: "document_heads",
        headKey: () => location.pathname.split("/").pop(),
        clear: () => store().getState().setSelectedElement(null),
      };
    },
  },
  new: {
    dist: NEW_DIST,
    port: 4192,
    ready: () =>
      Boolean(
        window.__COMPOSITION_CATALOG__?.workspace &&
          document.querySelector(".app:not(.builder-booting)") &&
          document.querySelector('[data-testid="skia-canvas-unified"]'),
      ),
    async seed(page, count) {
      return page.evaluate(async (count) => {
        const h = window.__COMPOSITION_CATALOG__;
        const ws = h.workspace, cmd = h.commands, palette = h.palette;
        const graph = ws.runtime.graph;
        const homePageId = graph.getEntry(graph.projectId).pageIds[0];
        const body = graph.getEntry(homePageId).children[0];
        const def = (type) => palette.catalogPaletteDefinitionId(graph.library, type);
        const entries = Array.from({ length: count }, (_, i) => {
          const text = i % 2 === 0;
          return {
            kind: "node", id: `project:node:perf-seed-${i}`, definitionId: def(text ? "Text" : "frame"), children: [],
            props: text ? { children: { kind: "set", value: `Seed ${i}` } } : {},
            visual: { fontSize: { kind: "set", value: 14 }, ...(text ? {} : { backgroundColor: { kind: "set", value: "#dbe7ff" } }) },
            sizing: { width: { kind: "set", value: 160 }, height: { kind: "set", value: 60 } },
            placement: { kind: "absolute", x: 20 + (i % 6) * 200, y: 20 + Math.floor(i / 6) * 90 },
            descendantOverrides: [],
          };
        });
        if (count) ws.execute(cmd.insertNodes({ parent: { kind: "node", id: body }, entries, rootIds: entries.map((e) => e.id), newId: ws.newId, label: "Seed" }));
        const otherPageId = "project:page:perf-page-2";
        const otherBody = "project:node:perf-page-2-body";
        ws.execute(cmd.createPage({
          page: { kind: "page", id: otherPageId, route: "/perf-page-2", name: "Perf Page 2", children: [otherBody] },
          entries: [{ kind: "node", id: otherBody, definitionId: "lib:definition:type-body", name: "Body", children: [], props: {}, visual: {}, sizing: {}, descendantOverrides: [] }],
        }));
        ws.execute(cmd.createComponent({ id: "project:node:perf-seed-1", name: "PerfCard", newId: ws.newId }));
        const definitionId = graph.getEntry(graph.projectId).definitionIds.at(-1);
        const instances = Array.from({ length: 12 }, (_, k) => ({ kind: "node", id: `project:node:perf-instance-${k}`, definitionId, children: [], props: {}, visual: {}, sizing: {}, placement: { kind: "absolute", x: 1300 + (k % 3) * 200, y: 20 + Math.floor(k / 3) * 90 }, descendantOverrides: [] }));
        ws.execute(cmd.insertNodes({ parent: { kind: "node", id: body }, entries: instances, rootIds: instances.map((e) => e.id), newId: ws.newId }));
        ws.session.clearSelection();
        for (let i = 0; i < 400; i++) {
          if (ws.autosave.getSnapshot().state === "saved" && ws.runtime.durableRevision === graph.revision) break;
          await new Promise((r) => setTimeout(r, 25));
        }
        return { homePageId, otherPageId, instances: graph.instancesOf(definitionId).size };
      }, count);
    },
    install: () => {
      const h = () => window.__COMPOSITION_CATALOG__;
      const ws = () => h().workspace;
      const node = (id) => ({ kind: "node", id: `project:node:${id}` });
      const set = (value) => ({ kind: "set", value });
      return {
        select: (k) => { const id = k % 2 ? "perf-seed-2" : "perf-seed-0"; ws().session.select([{ target: node(id), identity: ws().root.recordsOfSource(`project:node:${id}`)[0] }]); },
        edit: (k) => ws().execute(h().commands.setFields({ targets: [node("perf-seed-3")], sizing: { width: set(160 + (k % 5) * 4) } })),
        fanout: (k) => ws().execute(h().commands.setFields({ targets: [node("perf-seed-1")], visual: { backgroundColor: set(k % 2 ? "#ffd8a8" : "#dbe7ff") } })),
        pageSwitch: (k, ids) => ws().session.setPage(k % 2 ? ids.homePageId : ids.otherPageId),
        saveEdit: (k) => ws().execute(h().commands.setFields({ targets: [node("perf-seed-0")], props: { children: set(`Save probe ${k}`) } })),
        headDb: "composition-catalog-projects-v1",
        headStore: "heads",
        headKey: () => ws().runtime.graph.projectId,
        clear: () => ws().session.clearSelection(),
      };
    },
  },
};

/** One measured run in the page: every operation OPS times; returns latency arrays (ms). */
async function runOps(page, app, ids) {
  return page.evaluate(
    async ({ installSrc, ids, OPS, GAP_MS, WARMUP }) => {
      // eslint-disable-next-line no-new-func
      const d = new Function(`return (${installSrc})()`)();
      const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = {};
      for (const op of ["select", "edit", "fanout", "pageSwitch"]) {
        console.log(`[g5] ${op}`);
        const samples = [];
        for (let k = -WARMUP; k < OPS; k++) {
          const t0 = performance.now();
          await d[op](k + WARMUP, ids);
          await frames();
          if (k >= 0) samples.push(performance.now() - t0);
          await sleep(GAP_MS);
        }
        if (op === "select") d.clear();
        if (op === "pageSwitch") await d.pageSwitch(1, ids); // back home
        out[op] = samples;
      }
      // save: command → the stored head of the open project advances.
      const headKey = d.headKey();
      const db = await new Promise((resolve, reject) => { const q = indexedDB.open(d.headDb); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
      const readHead = () => new Promise((resolve, reject) => {
        const q = db.transaction(d.headStore, "readonly").objectStore(d.headStore).get(headKey);
        q.onsuccess = () => resolve(q.result);
        q.onerror = () => reject(q.error);
      });
      console.log("[g5] save");
      const save = [];
      for (let k = -WARMUP; k < OPS; k++) {
        const before = (await readHead())?.revision;
        const t0 = performance.now();
        await d.saveEdit(k);
        let after = (await readHead())?.revision;
        while (after === before && performance.now() - t0 < 20000) { await sleep(5); after = (await readHead())?.revision; }
        if (after === before) throw new Error("save revision did not advance");
        if (k >= 0) save.push(performance.now() - t0);
        await sleep(GAP_MS);
      }
      db.close();
      out.save = save;
      return out;
    },
    { installSrc: app.install.toString(), ids, OPS, GAP_MS, WARMUP },
  );
}

async function ready(page, app) {
  await page.waitForFunction(app.ready, null, { timeout: 120000 });
}

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const result = {
  measuredAt: new Date().toISOString(),
  method: { RUNS, OPS, WARMUP, LOADS, GAP_MS, SETTLE_MS, timing: "dispatch → second requestAnimationFrame (ms, performance.now)", order: "even run old→new, odd new→old", judge: "median of per-run p95; after ≤ before×1.10+2 (save/load +10)" },
  dists: { old: OLD_DIST, new: NEW_DIST },
  cells: [],
  errors: [],
};
const servers = {};
for (const [name, app] of Object.entries(APPS)) servers[name] = await serveDist(app.dist, app.port);
try {
  for (const size of SIZES) {
    // Fixture per app (one project each, reused across runs and CPU rates).
    const live = {};
    for (const [name, app] of Object.entries(APPS)) {
      const origin = `http://localhost:${app.port}`;
      const context = await browser.newContext({ storageState: loadStorageState(process.env.ADR248_AUTH_SESSION, origin), viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      page.on("pageerror", (e) => result.errors.push(`${name}/${size} pageerror: ${e.message.slice(0, 200)}`));
      page.on("console", (m) => {
        if (m.type() === "error") result.errors.push(`${name}/${size} console: ${m.text().slice(0, 200)}`);
        else if (process.env.G5_DEBUG && m.text().startsWith("[g5]")) process.stdout.write(`  · ${name} ${m.text()}\n`);
      });
      await page.goto(`${servers[name].url}/dashboard`, { waitUntil: "networkidle" });
      await page.locator("button.dashboard-create-button").first().click();
      await page.locator("#new-project-name").fill(`g5-paired-${name}-${size}-${Date.now()}`);
      await page.locator("#new-project-name").press("Enter");
      await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 });
      await ready(page, app);
      await page.waitForTimeout(SETTLE_MS);
      const ids = await app.seed(page, size);
      await page.waitForTimeout(3000);
      const cdp = await context.newCDPSession(page);
      live[name] = { context, page, ids, cdp, url: page.url() };
      process.stdout.write(`seed ${name} ${size}: ${JSON.stringify(ids)}\n`);
    }
    for (const cpu of CPUS) {
      const cell = { size, cpu, runs: { old: [], new: [] } };
      for (let run = 0; run < RUNS; run++) {
        const order = run % 2 ? ["new", "old"] : ["old", "new"];
        for (const name of order) {
          const app = APPS[name];
          const { page, ids, cdp } = live[name];
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
          log(`${size} ${cpu}x run ${run} ${name}: reload`);
          await page.reload({ waitUntil: "networkidle" });
          await ready(page, app);
          log(`${size} ${cpu}x run ${run} ${name}: ready`);
          await page.waitForTimeout(SETTLE_MS);
          if (app.prepare) await app.prepare(page);
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
          const ops = await runOps(page, app, ids);
          log(`${size} ${cpu}x run ${run} ${name}: ops done`);
          const loads = [];
          for (let k = 0; k < LOADS; k++) {
            const t0 = Date.now();
            await page.reload({ waitUntil: "networkidle" });
            await ready(page, app);
            loads.push(Date.now() - t0);
          }
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
          const p95 = Object.fromEntries([...OP_NAMES.map((op) => [op, pct(ops[op], 0.95)]), ["load", pct(loads, 0.95)]]);
          const p50 = Object.fromEntries([...OP_NAMES.map((op) => [op, pct(ops[op], 0.5)]), ["load", pct(loads, 0.5)]]);
          cell.runs[name].push({ run, p95, p50, samples: { ...ops, load: loads } });
          process.stdout.write(`${size} ${cpu}x run ${run} ${name}: p95 ${JSON.stringify(p95)}\n`);
        }
      }
      cell.verdict = Object.fromEntries([...OP_NAMES, "load"].map((op) => {
        const before = median(cell.runs.old.map((r) => r.p95[op]));
        const after = median(cell.runs.new.map((r) => r.p95[op]));
        const allowed = +(before * 1.1 + (op === "save" || op === "load" ? 10 : 2)).toFixed(2);
        return [op, { before, after, allowed, pass: after <= allowed }];
      }));
      result.cells.push(cell);
      process.stdout.write(`VERDICT ${size} ${cpu}x ${JSON.stringify(cell.verdict)}\n`);
      writeFileSync(OUT, JSON.stringify(result, null, 1));
    }
    for (const l of Object.values(live)) await l.context.close();
  }
} finally {
  for (const s of Object.values(servers)) s.close();
  await browser.close();
  writeFileSync(OUT, JSON.stringify(result, null, 1));
}
