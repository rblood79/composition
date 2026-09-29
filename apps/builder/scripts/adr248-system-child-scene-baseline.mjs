#!/usr/bin/env node
// ADR-248 G0: observe child scene/layout for old reusable origins in the live Builder.
// Section roots are inserted under their required ListBox/Menu/GridList host.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
  openPanels,
} from "./perf-baseline.mjs";

const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const manifest = JSON.parse(
  readFileSync(resolve(baselineDir, "coverage-manifest.json"), "utf8"),
);
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== manifest.source.baselineHead)
  throw new Error("Child scene baseline uses another HEAD");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sourcePaths = execFileSync("git", ["ls-files", "-z", "apps/builder/src", "packages/shared/src", "packages/specs/src", "packages/engine/src"], { cwd: root })
  .toString().split("\0").filter(Boolean);
const sourceDigest = createHash("sha256");
for (const path of sourcePaths) sourceDigest.update(path).update("\0").update(readFileSync(resolve(root, path))).update("\0");
const indirect = manifest.types.filter(
  (entry) => entry.oldFixtureCoverage === "INDIRECT_PARENT_CONTEXT_ONLY",
);
if (indirect.length !== 33)
  throw new Error(`Expected 33 indirect types, got ${indirect.length}`);
const sectionHosts = {
  "component-listbox-section": "ListBox",
  "component-menu-section": "Menu",
  "component-gridlist-section": "GridList",
};
const byRoot = new Map();
for (const entry of indirect)
  for (const context of entry.oldSystemSubpartContexts) {
    const group = byRoot.get(context.rootId) ?? [];
    group.push({ type: entry.type, context });
    byRoot.set(context.rootId, group);
  }
const scenario = {
  id: "adr248-old-system-child-scene-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: [{ op: "setViewport", scale: 0.8, x: 300, y: 180 }, ...[...byRoot.keys()].sort().map((rootId) => ({
    op: sectionHosts[rootId] ? "addHostThenSectionRef" : "addElement",
    type: "ref",
    ref: rootId,
    parent: sectionHosts[rootId] ?? "page-body",
    then: "readSceneLayoutAndRemoveOwner",
  }))],
};
const scenarioHash = createHash("sha256")
  .update(JSON.stringify(scenario))
  .digest("hex");
const baseUrl = process.env.BUILDER_URL;
if (!baseUrl || !baseUrl.startsWith("http://localhost:"))
  throw new Error("BUILDER_URL must be localhost dev Builder root");
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(process.argv[outIndex + 1]);
const pngDir = out.replace(/\.json$/, "-png");
mkdirSync(pngDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const { context, page, errors } = await createInstrumentedContext(browser, {
    storageState: loadStorageState(
      resolve(root, "apps/builder/scripts/.auth-session.json"),
      new URL(baseUrl).origin,
    ),
    frameCapture: false,
    deviceScaleFactor: 1,
  });
  try {
    await createIsolatedProject(page, baseUrl);
    const servedIndexSha256 = sha256(await (await page.request.get(baseUrl)).body());
    await openPanels(page, ["components"]);
    await page.evaluate(() => window.__composition_APPLY_VIEWPORT__?.({ scale: 0.8, x: 300, y: 180 }));
    const rows = [];
    for (const rootId of [...byRoot.keys()].sort()) {
      const observed = await page.evaluate(async ({ rootId, cases, hostType }) => {
        const store = window.__composition_STORE__.getState();
        const body = store.elements.find(
          (entry) =>
            entry.type === "body" && entry.page_id === store.currentPageId,
        );
        const origin = store.elements.find((entry) => entry.id === rootId);
        if (!body || !origin) throw new Error(`${rootId}: body/origin missing`);
        const id = `adr248-child-scene-${rootId}`;
        const hostId = `adr248-child-scene-host-${rootId}`;
        const now = new Date().toISOString();
        const style = {
          position: "absolute",
          left: "30px",
          top: "30px",
          width: "220px",
          height: "130px",
        };
        if (hostType)
          await store.addElement({
            id: hostId,
            type: hostType,
            props: { style },
            page_id: store.currentPageId,
            parent_id: body.id,
            created_at: now,
            updated_at: now,
          });
        await store.addElement({
          id,
          type: "ref",
          ref: rootId,
          componentName: origin.type,
          props: hostType ? {} : { style },
          page_id: store.currentPageId,
          parent_id: hostType ? hostId : body.id,
          created_at: now,
          updated_at: now,
        });
        const current = window.__composition_STORE__.getState();
        const authored = current.elements.find((entry) => entry.id === id);
        if (!authored)
          return {
            id,
            removeId: hostType ? hostId : id,
            rootId,
            originType: origin.type,
            hostType: hostType ?? null,
            status: "REJECTED_BY_OLD_STORE",
            targets: [],
          };
        const nodes = new Map(current.elements.map((entry) => [entry.id, entry]));
        const targets = cases.map(({ type, context }) => {
          const originNode = nodes.get(context.id);
          if (!originNode || originNode.type !== type)
            throw new Error(`${rootId}/${context.id}: origin child drift`);
          const segments = [];
          let cursor = originNode;
          while (cursor && cursor.id !== rootId) {
            segments.unshift(
              cursor.customId ||
                cursor.metadata?.customId ||
                cursor.componentName ||
                cursor.name ||
                cursor.id,
            );
            cursor = nodes.get(cursor.parent_id);
          }
          if (cursor?.id !== rootId)
            throw new Error(`${rootId}/${context.id}: origin path broken`);
          return {
            type,
            originId: context.id,
            rootId,
            expectedSceneId: `${id}/${segments.join("/")}`,
            existingParentCanvasFixture: context.existingRootCanvasFixture,
          };
        });
        return {
          id,
          removeId: hostType ? hostId : id,
          rootId,
          originType: origin.type,
          hostType: hostType ?? null,
          status: "AUTHORED",
          targets,
        };
      }, { rootId, cases: byRoot.get(rootId), hostType: sectionHosts[rootId] });
      if (observed.status === "REJECTED_BY_OLD_STORE") {
        if (observed.removeId !== observed.id)
          await page.evaluate(async (id) => {
            await window.__composition_STORE__.getState().removeElement(id);
          }, observed.removeId);
        rows.push({ rootId, rootType: observed.originType, status: observed.status, children: [] });
        process.stdout.write(`${rootId}: rejected by old store\n`);
        continue;
      }
      if (!observed.hostType)
        await page.waitForFunction(
          (id) =>
            Boolean(
              window.__composition_LAYOUT_DEBUG__
                ?.getSharedLayoutMap?.()
                ?.get(id),
            ),
          observed.id,
          { timeout: 15_000 },
        );
      else await page.waitForTimeout(500);
      await page.waitForTimeout(150);
      const scene = await page.evaluate((observed) => {
        const map = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.();
        const scene = window.__composition_SCENE_DEBUG__;
        return observed.targets.map((target) => {
          const layout = map?.get(target.expectedSceneId) ?? null;
          const node = scene?.readNode?.(target.expectedSceneId) ?? null;
          return {
            ...target,
            scenePresent: Boolean(node),
            layout: layout
              ? {
                  x: layout.x,
                  y: layout.y,
                  width: layout.width,
                  height: layout.height,
                }
              : null,
            props: node?.props ?? null,
            stateDeps: node?.stateDeps ?? null,
            candidateSceneIds: layout
              ? []
              : [...(map?.keys() ?? [])]
                  .filter((key) => key.startsWith(`${observed.id}/`))
                  .slice(0, 40),
          };
        });
      }, observed);
      const pngName = `${rootId.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`;
      const png = await page.screenshot({
        path: resolve(pngDir, pngName),
        animations: "disabled",
        clip: { x: 0, y: 0, width: 1440, height: 900 },
      });
      rows.push({
        rootId,
        rootType: observed.originType,
        status: "AUTHORED",
        children: scene,
        screenshot: { path: `${pngDir.split("/").at(-1)}/${pngName}`, sha256: sha256(png) },
      });
      await page.evaluate(async (id) => {
        await window.__composition_STORE__.getState().removeElement(id);
      }, observed.removeId);
      process.stdout.write(`${rootId}: ${scene.length} child contexts\n`);
    }
    const normalizedRows = rows.map((row) => {
      const ids = new Map();
      const json = JSON.stringify(row).replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
        (id) => {
          if (!ids.has(id)) ids.set(id, `<generated-id-${ids.size + 1}>`);
          return ids.get(id);
        },
      );
      return JSON.parse(json);
    });
    const report = {
      head,
      executionBuildIdentity: `dev-source:${sourceDigest.digest("hex")}:index:${servedIndexSha256}`,
      buildIndexSha256: manifest.source.buildIndexSha256,
      scenarioHash,
      scenario,
      runtimeEnvironment: await page.evaluate(async () => ({
        viewport: { width: innerWidth, height: innerHeight },
        dpr: devicePixelRatio,
        theme: document.documentElement.dataset.theme ?? "default-light",
        font: getComputedStyle(document.body).fontFamily,
        fontLoadStatus: await document.fonts.ready.then(() => document.fonts.status),
      })),
      source: "live old Builder dev Canvas scene/layout; no Preview iframe",
      generatedIdNormalization:
        "UUID values use per-root order-preserving markers; equal references share a marker",
      rows: normalizedRows,
      summary: {
        roots: rows.length,
        rootsRejectedByOldStore: rows.filter((row) => row.status === "REJECTED_BY_OLD_STORE").map((row) => row.rootId),
        childContexts: rows.reduce((count, row) => count + row.children.length, 0),
        typesWithScene: [
          ...new Set(
            rows.flatMap((row) =>
              row.children.filter((child) => child.scenePresent).map((child) => child.type),
            ),
          ),
        ].sort(),
        typesWithLayout: [
          ...new Set(
            rows.flatMap((row) =>
              row.children.filter((child) => child.layout).map((child) => child.type),
            ),
          ),
        ].sort(),
        missingScenePaths: rows.flatMap((row) =>
          row.children
            .filter((child) => !child.scenePresent)
            .map((child) => child.expectedSceneId),
        ),
      },
      errors,
    };
    writeFileSync(
      out,
      `${JSON.stringify(report, null, 2)}\n`,
    );
    process.stdout.write(`${JSON.stringify(report.summary)}\n`);
    if (errors.length) throw new Error("Builder emitted browser errors");
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
