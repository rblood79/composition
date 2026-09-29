#!/usr/bin/env node
// ADR-248 Phase 0: old public data binding and project-switch output.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createInstrumentedContext, createIsolatedProject, loadStorageState, waitReady } from "./perf-baseline.mjs";

const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const inventory = JSON.parse(readFileSync(resolve(baselineDir, "inventory.json"), "utf8"));
assert.equal(head, inventory.baselineHead);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const sourcePaths = execFileSync("git", ["ls-files", "-z", "apps/builder/src", "packages/shared/src", "packages/specs/src", "packages/engine/src"], { cwd: root })
  .toString().split("\0").filter(Boolean);
const sourceDigest = createHash("sha256");
for (const path of sourcePaths) sourceDigest.update(path).update("\0").update(readFileSync(resolve(root, path))).update("\0");
const scenario = {
  id: "adr248-old-binding-project-switch-v1", seed: 248,
  viewport: { width: 1440, height: 900 }, dpr: 1, theme: "default-light", font: "app-default",
  operations: [
    { op: "createProject", id: "first" },
    { op: "insertRef", id: "bound-list", origin: "component-listbox" },
    { op: "createCollection", id: "bound-collection", schema: ["label"], rows: [{ label: "Alpha" }] },
    { op: "bindElement", element: "bound-list", collection: "bound-collection" },
    { op: "refresh" }, { op: "createProject", id: "second" }, { op: "switchProject", id: "first" },
  ],
  expectedRelations: [["bound-list", "bound-collection"]],
};
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1]) throw new Error("--out path required");
const out = resolve(process.argv[outIndex + 1]);
mkdirSync(out, { recursive: true });
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const { context, page, errors } = await createInstrumentedContext(browser, {
    storageState: loadStorageState(resolve(root, "apps/builder/scripts/.auth-session.json"), baseUrl),
    frameCapture: false, deviceScaleFactor: scenario.dpr,
  });
  try {
    await page.setViewportSize(scenario.viewport);
    await createIsolatedProject(page, baseUrl);
    const firstUrl = page.url();
    const firstProjectId = new URL(firstUrl).pathname.split("/").pop();
    const servedIndexSha256 = hash(await (await page.request.get(baseUrl)).body());
    const authored = await page.evaluate(async ({ firstProjectId }) => {
      const store = window.__composition_STORE__.getState();
      const body = store.elements.find((item) => item.type === "body" && item.page_id === store.currentPageId);
      if (!body) throw new Error("Page body missing");
      const now = new Date().toISOString();
      await store.addElement({
        id: "adr248-bound-list", type: "ref", ref: "component-listbox", parent_id: body.id,
        page_id: store.currentPageId, created_at: now, updated_at: now,
        props: { style: { position: "absolute", left: "100px", top: "100px", width: "240px", height: "180px" } },
      });
      const { useDataStore } = await import("/src/builder/stores/data.ts");
      const result = await useDataStore.getState().applyDataChange({
        ops: [
          { op: "create_collection", id: "adr248-bound-collection", projectId: firstProjectId, name: "G0 rows", schema: [{ id: "label-field", key: "label", type: "string", label: "Label" }], rows: [{ label: "Alpha" }], source: "manual" },
          { op: "bind_element", elementId: "adr248-bound-list", collectionId: "adr248-bound-collection" },
        ], origin: "user",
      }, { projectId: firstProjectId });
      return { operations: result?.change?.ops?.map((item) => item.op) ?? null };
    }, { firstProjectId });
    const read = () => page.evaluate(async ({ firstProjectId }) => {
      const doc = window.__canonical_STORE__.getState().getDocument(firstProjectId);
      const find = (nodes, id) => {
        for (const node of nodes ?? []) { if (node.id === id) return node; const nested = find(node.children, id); if (nested) return nested; }
        return null;
      };
      const ref = find(doc?.children, "adr248-bound-list");
      const { resolveCanonicalDocument } = await import("/src/resolvers/canonical/index.ts");
      const resolved = find(resolveCanonicalDocument(doc), "adr248-bound-list");
      const { useDataStore } = await import("/src/builder/stores/data.ts");
      const collection = useDataStore.getState().collections?.get?.("adr248-bound-collection") ?? null;
      const layout = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.()?.get("adr248-bound-list") ?? null;
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("composition");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      let persistedCollection = null;
      try {
        persistedCollection = await new Promise((resolve, reject) => {
          const request = db.transaction("collections", "readonly").objectStore("collections").get("adr248-bound-collection");
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => reject(request.error);
        });
      } finally { db.close(); }
      return {
        ref: ref?.ref ?? null,
        binding: ref?.props?.dataBinding ?? ref?.["x-composition"]?.dataBinding ?? null,
        resolvedBinding: resolved?.props?.dataBinding ?? null,
        collection: collection ? { id: collection.id, rows: collection.mockData ?? null, schema: collection.schema?.map((field) => field.key) } : null,
        persistedCollection: persistedCollection ? { id: persistedCollection.id, rows: persistedCollection.mockData ?? null, schema: persistedCollection.schema?.map((field) => field.key) } : null,
        geometry: layout ? { x: layout.x, y: layout.y, width: layout.width, height: layout.height } : null,
      };
    }, { firstProjectId });
    const after = await read();
    assert.equal(after.binding?.collectionId, "adr248-bound-collection");
    assert.deepEqual(after.persistedCollection?.rows, [{ label: "Alpha" }]);
    const capture = { animations: "disabled", clip: { x: 70, y: 70, width: 420, height: 300 } };
    await page.locator('[data-testid="skia-canvas-unified"]').waitFor({ state: "visible" });
    const afterPng = await page.screenshot({ ...capture, path: resolve(out, "after.png") });
    await page.reload({ waitUntil: "networkidle" });
    await waitReady(page, { settleMs: 0 });
    const refreshed = await read();
    assert.equal(refreshed.binding?.collectionId, "adr248-bound-collection");
    assert.deepEqual(refreshed.persistedCollection?.rows, [{ label: "Alpha" }]);
    const refreshedPng = await page.screenshot({ ...capture, path: resolve(out, "after-refresh.png") });
    await createIsolatedProject(page, baseUrl);
    const secondProjectId = new URL(page.url()).pathname.split("/").pop();
    assert.notEqual(secondProjectId, firstProjectId);
    await page.goto(firstUrl, { waitUntil: "networkidle" });
    await waitReady(page, { settleMs: 0 });
    const switchedBack = await read();
    assert.equal(switchedBack.binding?.collectionId, "adr248-bound-collection");
    assert.deepEqual(switchedBack.persistedCollection?.rows, [{ label: "Alpha" }]);
    const switchedPng = await page.screenshot({ ...capture, path: resolve(out, "after-switch.png") });
    const environment = await page.evaluate(async () => ({
      viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio,
      theme: document.documentElement.dataset.theme ?? "default-light",
      font: getComputedStyle(document.body).fontFamily,
      fontLoadStatus: await document.fonts.ready.then(() => document.fonts.status),
    }));
    const report = {
      head, runtime: "old Builder dev public DataChange and project navigation",
      executionBuildIdentity: `dev-source:${sourceDigest.digest("hex")}:index:${servedIndexSha256}`,
      buildIndexSha256: hash(readFileSync(resolve(root, "apps/builder/dist/index.html"))),
      scenario, scenarioHash: hash(JSON.stringify(scenario)), runtimeEnvironment: environment,
      oldOutput: { authored, after, refreshed, switchedBack },
      screenshots: { after: hash(afterPng), refreshed: hash(refreshedPng), switchedBack: hash(switchedPng) },
      errors,
    };
    writeFileSync(resolve(out, "baseline.json"), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(JSON.stringify({ after, refreshed, switchedBack, screenshots: report.screenshots, errors }) + "\n");
  } finally { await context.close(); }
} finally { await browser.close(); }
