// ADR-248 Phase 4e live G4: the catalog project format in the real Builder (5175, headless Chrome,
// a fresh profile — IndexedDB empty, the saved auth session only).
//
//   R1  create (dashboard) → edit → undo/redo (keyboard) → saved → refresh: the same document
//   R2  the dashboard lists the project and opens it again
//   R3  data table (data store) → `composition.collections` row; the v2 file carries it
//   R4  export v2 zip · JSON (header menu) → import both into another project: same entries + data
//   R5  old format refused: the old app's real project file · an old JSON export · an old IDB head
//   R6  forced storage failure: never shown as saved; retry saves; refresh keeps the edit
//   R7  another tab saves first: this tab stops at conflict; its edit is not stored
//   R8  edit then switch project at once: the edit is stored for the project it belongs to
//   R9  header Preview: an explicit failure (toast), no navigation, no new page
//   R10 IndexedDB: no events/actions stores; collections · api_endpoints · variables present
//   R11 folder link (OPFS handle, DEV hook): the v2 container written after a durable save
//   R12 `apps/publish` diff 0 against main
// Not run here: Preview iframe stale/gap (the iframe is not opened in live checks — unit 4d-1).
// Usage: ADR248_AUTH_SESSION=<session> node scripts/adr248-g4-live.mjs <outDir>
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5175";
const OLD_ZIP = resolve("../../docs/adr/design/248-baseline/storage-surface/oracle/old-export.composition.zip");
const state = JSON.parse(readFileSync(process.env.ADR248_AUTH_SESSION, "utf8"));
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ storageState: state, viewport: { width: 1440, height: 900 }, acceptDownloads: true });
// Dev loads thousands of modules: keep every resource entry so the app's own module URL can be found.
await context.addInitScript(() => performance.setResourceTimingBufferSize(100000));
const errors = [];
let pagesOpened = 0;
context.on("page", () => (pagesOpened += 1));
const watch = (page, tag) => {
  page.on("pageerror", (e) => errors.push(`${tag} pageerror: ${e.message.slice(0, 240)}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${tag} console: ${m.text().slice(0, 240)}`); });
};
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(`${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 400)}\n`);
};
const step = async (id, run) => {
  try { await run(); } catch (error) { record(id, false, { threw: String(error?.message ?? error).slice(0, 400) }); }
};

async function ready(page) {
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await install(page);
}
async function install(page) {
  await page.evaluate(async () => {
    const palette = await import("/src/builder/catalogRuntime/paletteInsert.ts");
    const stable = (value) =>
      Array.isArray(value) ? value.map(stable)
      : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, stable(value[k])]))
      : value;
    const ws = () => window.__COMPOSITION_CATALOG__.workspace;
    const cmd = () => window.__COMPOSITION_CATALOG__.commands;
    window.__G4__ = {
      routeId: () => location.pathname.split("/").pop(),
      revision: () => ({ revision: ws().runtime.graph.revision, durable: ws().runtime.durableRevision, state: ws().autosave.getSnapshot().state }),
      /** The whole document minus its revision (stable key order). */
      doc() { const { revision, ...rest } = ws().runtime.graph.exportDocument(); return JSON.stringify(stable(rest)); },
      /** Entries other than the project entry, with the project id written out (an import keeps the target's). */
      body() {
        const graph = ws().runtime.graph;
        const doc = graph.exportDocument();
        const entries = Object.values(doc.entries).filter((e) => e.kind !== "project");
        return JSON.stringify(stable(entries)).split(graph.projectId).join("<project>");
      },
      insert(id, type) {
        const graph = ws().runtime.graph;
        const nodeId = `project:node:${id}`;
        ws().execute(cmd().insertNodes({ parent: { kind: "node", id: "project:node:home-body" }, entries: [{ kind: "node", id: nodeId, definitionId: palette.catalogPaletteDefinitionId(graph.library, type), children: [], props: {}, visual: {}, sizing: { width: { kind: "set", value: 420 } }, descendantOverrides: [] }], rootIds: [nodeId], newId: ws().newId }));
      },
      label(id, value) {
        ws().execute(cmd().setFields({ targets: [{ kind: "node", id: `project:node:${id}` }], props: { label: { kind: "set", value } } }));
      },
      labelOf: (id) => ws().runtime.graph.getEntry(`project:node:${id}`)?.props?.label?.value ?? null,
      /** The app's own module instance (a dev edit adds `?t=` to the URL the app imported). */
      appModule: (path) => import(performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes(path)) ?? path),
      width(id) {
        const root = ws().root;
        const record = root.recordsOfSource(`project:node:${id}`)[0];
        return record ? Math.round(root.getGeometry([record]).get(record).width) : null;
      },
    };
  });
}
async function waitSaved(page, timeout = 15000) {
  await page.waitForFunction(() => { const r = window.__G4__.revision(); return r.state === "saved" && r.durable === r.revision; }, null, { timeout });
}
async function newProject(page, name) {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await ready(page);
  return page.evaluate(() => window.__G4__.routeId());
}
async function menu(page, item) {
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}
async function download(page, item, file) {
  let d;
  try {
    [d] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), menu(page, item)]);
  } catch (error) {
    writeFileSync(`${OUT}/menu-${file}.png`, await page.screenshot());
    throw error;
  }
  const path = `${OUT}/${file}`;
  await d.saveAs(path);
  return path;
}
const importInput = (page) => page.locator('input[type="file"][accept*="zip"]');
async function toast(page, text, timeout = 10000) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout });
  return true;
}
const blur = (page) => page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());

const page = await context.newPage();
watch(page, "p1");
const stamp = Date.now() % 100000;
const P1 = `G4 A ${stamp}`;
let route1, route2, docA, zipPath, jsonPath;

// R1 create → edit → undo/redo → saved → refresh.
await step("R1 roundtrip", async () => {
  route1 = await newProject(page, P1);
  await page.evaluate(() => { window.__G4__.insert("tf", "TextField"); window.__G4__.label("tf", "G4 라벨"); window.__G4__.label("tf", "undo me"); });
  await blur(page);
  const seen = [];
  await page.keyboard.press("ControlOrMeta+z"); await page.waitForTimeout(300);
  seen.push(await page.evaluate(() => window.__G4__.labelOf("tf")));
  await page.keyboard.press("ControlOrMeta+Shift+z"); await page.waitForTimeout(300);
  seen.push(await page.evaluate(() => window.__G4__.labelOf("tf")));
  await page.keyboard.press("ControlOrMeta+z"); await page.waitForTimeout(300);
  seen.push(await page.evaluate(() => window.__G4__.labelOf("tf")));
  await waitSaved(page);
  const before = await page.evaluate(() => ({ doc: window.__G4__.doc(), rev: window.__G4__.revision(), width: window.__G4__.width("tf") }));
  docA = before.doc;
  await page.reload();
  await ready(page);
  const after = await page.evaluate(() => ({ doc: window.__G4__.doc(), rev: window.__G4__.revision(), width: window.__G4__.width("tf"), label: window.__G4__.labelOf("tf") }));
  record("R1 undo/redo by keyboard", JSON.stringify(seen) === JSON.stringify(["G4 라벨", "undo me", "G4 라벨"]), { seen });
  record("R1 saved → refresh: same document", after.doc === before.doc && after.rev.state === "saved" && after.rev.revision === before.rev.revision, { before: before.rev, after: after.rev, label: after.label, width: [before.width, after.width], bytes: before.doc.length });
});

// R2 dashboard list → open.
await step("R2 dashboard", async () => {
  await page.goto(`${BASE}/dashboard`);
  const card = page.locator(".project-card-title", { hasText: P1 });
  await card.first().waitFor({ timeout: 15000 });
  await card.first().click();
  await page.waitForURL(new RegExp(`/builder/${route1}`), { timeout: 30000 });
  await ready(page);
  const same = await page.evaluate(() => window.__G4__.doc());
  record("R2 dashboard lists and reopens", same === docA, { route: route1 });
});

// The import target (also R8's other project).
await step("setup B", async () => {
  route2 = await newProject(page, `G4 B ${stamp}`);
  await page.goto(`${BASE}/builder/${route1}`);
  await ready(page);
});

// R3 data table through the product data store.
await step("R3 data", async () => {
  const out = await page.evaluate(async () => {
    const { useDataStore } = await window.__G4__.appModule("/src/builder/stores/data.ts");
    const store = useDataStore.getState();
    const projectId = store.currentProjectId;
    window.__G4_DATA_PROBE__ = { urls: performance.getEntriesByType("resource").map((e) => e.name).filter((n) => n.includes("stores/data")), projectId, initialized: store.isInitialized };
    if (!projectId) return { probe: window.__G4_DATA_PROBE__, rows: [] };
    const created = await store.createDataTable({ project_id: projectId, name: "G4 표", mockData: [{ a: 1 }, { a: 2 }] });
    const rows = await new Promise((done, fail) => {
      const req = indexedDB.open("composition");
      req.onsuccess = () => {
        const db = req.result;
        const get = db.transaction("collections").objectStore("collections").getAll();
        get.onsuccess = () => { done(get.result.filter((r) => r.project_id === projectId).map((r) => r.name)); db.close(); };
        get.onerror = () => fail(get.error);
      };
      req.onerror = () => fail(req.error);
    });
    return { projectId, created: created?.name, rows };
  });
  record("R3 data table → composition.collections", out.rows.includes("G4 표"), out);
});

// R4 export v2 zip · JSON → import into another project.
await step("R4 exchange", async () => {
  zipPath = await download(page, "Export", "p1.zip");
  jsonPath = await download(page, "Export as JSON (v1)", "p1.json");
  const bodyA = await page.evaluate(() => window.__G4__.body());
  await page.goto(`${BASE}/builder/${route2}`);
  await ready(page);
  for (const [kind, path] of [["zip", zipPath], ["json", jsonPath]]) {
    await importInput(page).setInputFiles(path);
    await toast(page, "Project loaded from a local file.");
    await ready(page);
    const out = await page.evaluate(async () => {
      const { useDataStore } = await window.__G4__.appModule("/src/builder/stores/data.ts");
      const names = [...useDataStore.getState().collections.values()].map((c) => c.name);
      return { body: window.__G4__.body(), route: window.__G4__.routeId(), names, label: window.__G4__.labelOf("tf") };
    });
    record(`R4 import ${kind} → same entries + data`, out.body === bodyA && out.names.includes("G4 표") && out.route === route2, { route: out.route, label: out.label, names: out.names });
    await page.waitForTimeout(800);
  }
});

// R5 old format refused.
await step("R5 old format", async () => {
  const before = await page.evaluate(() => window.__G4__.doc());
  await importInput(page).setInputFiles(OLD_ZIP);
  const zipToast = await toast(page, "previous format").catch(() => false);
  await page.waitForTimeout(1000);
  const oldJson = `${OUT}/old-export.json`;
  writeFileSync(oldJson, JSON.stringify({ version: "1.0.0", project: { id: "p", name: "Old" }, document: { pages: [], elements: [] } }));
  await importInput(page).setInputFiles(oldJson);
  const jsonToast = await toast(page, "previous format").catch(() => false);
  const after = await page.evaluate(() => window.__G4__.doc());
  record("R5 old project file · old JSON refused, document unchanged", zipToast && jsonToast && before === after, { zipToast, jsonToast });
  // An old-format head in the catalog store: listed, and opening it fails with the reason.
  const oldRoute = await page.evaluate(async () => {
    const projectId = "project:project:g4-old-head";
    await new Promise((done, fail) => {
      const req = indexedDB.open("composition-catalog-projects-v1");
      req.onsuccess = () => {
        const tx = req.result.transaction(["heads"], "readwrite");
        tx.objectStore("heads").put({ projectId, format: "composition", schemaVersion: 1, libraryContractVersion: 1, revision: 1, rootId: projectId, createdAt: Date.now(), updatedAt: Date.now() });
        tx.oncomplete = () => { req.result.close(); done(); };
        tx.onerror = () => fail(tx.error);
      };
      req.onerror = () => fail(req.error);
    });
    return projectId;
  });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  const listed = await page.locator(".project-card-title", { hasText: "g4-old-head" }).count();
  await page.locator(".project-card-title", { hasText: "g4-old-head" }).first().click();
  const alert = await page.getByRole("alert").filter({ hasText: "previous format" }).first().waitFor({ timeout: 20000 }).then(() => true, () => false);
  record("R5 old IDB head listed · open refused with the reason", listed > 0 && alert, { oldRoute, listed, alert });
});

// R6 forced storage failure.
await step("R6 failure", async () => {
  await page.goto(`${BASE}/builder/${route1}`);
  await ready(page);
  await waitSaved(page);
  const out = await page.evaluate(async () => {
    const states = [];
    const button = () => document.querySelector(".catalog-save-status");
    const observer = new MutationObserver(() => states.push(button()?.dataset.saveState));
    observer.observe(button(), { attributes: true, attributeFilter: ["data-save-state"] });
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (names, mode, ...rest) {
      const list = typeof names === "string" ? [names] : [...names];
      if (this.name === "composition-catalog-projects-v1" && mode === "readwrite" && list.includes("heads"))
        throw new DOMException("G4 forced failure", "UnknownError");
      return original.call(this, names, mode, ...rest);
    };
    window.__G4__.label("tf", "after failure");
    await new Promise((r) => setTimeout(r, 1500));
    const failed = window.__G4__.revision();
    IDBDatabase.prototype.transaction = original;
    observer.disconnect();
    return { states, failed, label: button()?.textContent };
  });
  const sawSaved = out.states.includes("saved");
  await page.locator('.catalog-save-status[data-save-state="failed"]').click();
  await waitSaved(page);
  await page.reload();
  await ready(page);
  const label = await page.evaluate(() => window.__G4__.labelOf("tf"));
  record("R6 failed revision never shown saved · retry saves · refresh keeps it", out.failed.state === "failed" && out.failed.durable < out.failed.revision && !sawSaved && label === "after failure", { ...out, retriedLabel: label });
});

// R7 another tab saves first.
await step("R7 conflict", async () => {
  const other = await context.newPage();
  watch(other, "p2");
  await other.goto(`${BASE}/builder/${route1}`);
  await ready(other);
  await other.evaluate(() => window.__G4__.label("tf", "from tab 2"));
  await waitSaved(other);
  await page.evaluate(() => window.__G4__.label("tf", "from tab 1"));
  const conflict = await page.waitForFunction(() => window.__G4__.revision().state === "conflict", null, { timeout: 10000 }).then(() => true, () => false);
  const shown = await page.locator('.catalog-save-status[data-save-state="conflict"]').count();
  await other.close();
  await page.reload();
  await ready(page);
  const label = await page.evaluate(() => window.__G4__.labelOf("tf"));
  record("R7 conflict stops autosave · the other tab's edit is stored", conflict && shown === 1 && label === "from tab 2", { conflict, shown, label });
});

// R8 edit then switch project at once (in-app navigation).
await step("R8 switch", async () => {
  await waitSaved(page);
  await page.evaluate((route2) => {
    window.__G4__.label("tf", "before switch");
    history.pushState(null, "", `/builder/${route2}`);
    dispatchEvent(new PopStateEvent("popstate"));
  }, route2);
  await page.waitForURL(new RegExp(`/builder/${route2}`));
  await ready(page);
  const there = await page.evaluate(() => window.__G4__.routeId());
  await page.goto(`${BASE}/builder/${route1}`);
  await ready(page);
  const label = await page.evaluate(() => window.__G4__.labelOf("tf"));
  record("R8 edit before a project switch is stored for its project", there === route2 && label === "before switch", { there, label });
});

// R9 header Preview.
await step("R9 publish entry", async () => {
  const url = page.url();
  const opened = pagesOpened;
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const shown = await toast(page, "Preview and publish cannot open the new project format yet.").catch(() => false);
  await page.waitForTimeout(800);
  record("R9 header Preview fails explicitly", shown && page.url() === url && pagesOpened === opened, { shown, url: page.url() === url, newPages: pagesOpened - opened });
});

// R10 IndexedDB stores.
await step("R10 stores", async () => {
  const out = await page.evaluate(async () => {
    const names = (await indexedDB.databases()).map((d) => d.name);
    const stores = (name) => new Promise((done) => {
      const req = indexedDB.open(name);
      req.onsuccess = () => { done([...req.result.objectStoreNames]); req.result.close(); };
      req.onerror = () => done(null);
    });
    return { databases: names, composition: names.includes("composition") ? await stores("composition") : null, catalog: await stores("composition-catalog-projects-v1") };
  });
  const c = out.composition ?? [];
  record("R10 no events/actions stores · data three stores present", !c.includes("events") && !c.includes("actions") && ["collections", "api_endpoints", "variables"].every((s) => c.includes(s)), out);
});

// R11 folder link (last: a reload would restore the OPFS handle, which crashes a temporary profile).
await step("R11 folder", async () => {
  const out = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(`g4-${Date.now()}`, { create: true });
    const linked = await window.__composition_CONNECT_FOLDER__(dir);
    window.__G4__.label("tf", "folder write");
    const list = async () => { const names = []; for await (const [name] of dir.entries()) names.push(name); return names.sort(); };
    const first = await list();
    await new Promise((r) => setTimeout(r, 3000));
    const manifest = JSON.parse(await (await (await dir.getFileHandle("manifest.json")).getFile()).text());
    return { status: linked?.status, first, after: await list(), revision: window.__G4__.revision(), manifest: { formatVersion: manifest.formatVersion, keys: Object.keys(manifest).sort() } };
  });
  record("R11 folder link writes the v2 container after a durable save", out.after.includes("manifest.json") && out.revision.state === "saved", out);
});

// R12 apps/publish diff against main.
await step("R12 publish diff", async () => {
  const diff = execSync("git diff --stat main...HEAD -- apps/publish", { encoding: "utf8" }).trim();
  record("R12 apps/publish diff 0", diff === "", { diff });
});

writeFileSync(`${OUT}/result.json`, JSON.stringify({ results, errors }, null, 1));
console.log(JSON.stringify({ pass: results.filter((r) => r.pass).length, total: results.length, errors: errors.length }));
await browser.close();
