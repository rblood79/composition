// Reconstruct the frozen child-scene inputs on the unchanged G0 checkout and retain pixels.
// Supplemental evidence only: never replaces the original G0 scene or PNGs.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
} from "./perf-baseline.mjs";
const root = resolve(import.meta.dirname, "../../..");
const source = JSON.parse(
  readFileSync(
    resolve(root, "docs/adr/design/248-baseline/system-child-scene.json"),
    "utf8",
  ),
);
const worktree = process.env.WORKTREE;
const baseUrl = process.env.BUILDER_URL;
const output = process.argv[2];
if (!worktree || !baseUrl || !output)
  throw new Error("WORKTREE, BUILDER_URL and output directory required");
const git = (...args) =>
  execFileSync("git", args, { cwd: worktree, encoding: "utf8" }).trim();
if (git("rev-parse", "HEAD") !== source.head || git("status", "--porcelain"))
  throw new Error("G0 checkout identity mismatch");
const out = resolve(output);
mkdirSync(out, { recursive: true });
const hosts = {
  "component-listbox-section": "ListBox",
  "component-menu-section": "Menu",
  "component-gridlist-section": "GridList",
};
const clip = { x: 85, y: 95, width: 600, height: 400 };
const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows = [];
let errors = [];
try {
  const context = await createInstrumentedContext(browser, {
    storageState: loadStorageState(
      resolve(root, "apps/builder/scripts/.auth-session.json"),
      new URL(baseUrl).origin,
    ),
    frameCapture: false,
    deviceScaleFactor: 1,
  });
  const { page } = context;
  await page.clock.setFixedTime(new Date(2026, 8, 28, 12));
  await createIsolatedProject(page, baseUrl);
  await page.evaluate(() =>
    window.__composition_APPLY_VIEWPORT__({ scale: 0.675, x: 72, y: 85.5 }),
  );
  await page.mouse.move(1435, 895);
  for (const row of source.rows) {
    if (row.status !== "AUTHORED") continue;
    const result = await page.evaluate(
      async ({ row, host }) => {
        const state = window.__composition_STORE__.getState();
        const body = state.elements.find(
          (e) => e.type === "body" && e.page_id === state.currentPageId,
        );
        const id = `g3-child-pixel-${row.rootId}`;
        const hostId = `${id}-host`;
        const props = {
          style: {
            position: "absolute",
            left: "30px",
            top: "30px",
            width: "220px",
            height: "130px",
          },
        };
        const dates = {
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (host)
          await state.addElement({
            id: hostId,
            type: host,
            props,
            parent_id: body.id,
            page_id: state.currentPageId,
            ...dates,
          });
        await state.addElement({
          id,
          type: "ref",
          ref: row.rootId,
          componentName: row.rootType,
          props: host ? {} : props,
          parent_id: host ? hostId : body.id,
          page_id: state.currentPageId,
          ...dates,
        });
        state.setSelectedElement(null);
        return { id, removeId: host ? hostId : id };
      },
      { row, host: hosts[row.rootId] },
    );
    await page.waitForTimeout(450);
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    const observed = await page.evaluate(
      ({ id, host }) => {
        const debug = window.__composition_LAYOUT_DEBUG__;
        const layout = debug.getSharedLayoutMap();
        const children = debug.getSharedFilteredChildrenMap();
        const nodes = [];
        const rootId = host ? `${id}-host` : id;
        const pathOf = (key) =>
          key === rootId
            ? ""
            : host
              ? `subject${key === id ? "" : key.slice(id.length)}`
              : key.slice(id.length + 1);
        const visit = (key, parent, px, py) => {
          const r = layout.get(key);
          const x = px + (r?.x ?? 0);
          const y = py + (r?.y ?? 0);
          nodes.push({
            path: pathOf(key),
            parent: parent === null ? null : pathOf(parent),
            rect: r ? { x, y, width: r.width, height: r.height } : null,
            engineInput: debug.getEngineInput(key) ?? null,
          });
          for (const child of children.get(key) ?? []) visit(child, key, x, y);
        };
        visit(rootId, null, 0, 0);
        const v = window.__composition_VIEWPORT__();
        return { nodes, camera: { zoom: v.zoom, pan: v.panOffset } };
      },
      { id: result.id, host: hosts[row.rootId] },
    );
    if (!observed.nodes[0]?.rect)
      throw new Error(`Missing old root geometry: ${row.rootId}`);
    const png = await page.screenshot({ clip });
    writeFileSync(resolve(out, `${row.rootId}.png`), png);
    rows.push({
      id: row.rootId,
      type: row.rootType,
      status: "AUTHORED",
      ref: row.rootId,
      host: hosts[row.rootId],
      pngSha256: createHash("sha256").update(png).digest("hex"),
      frozenPngMatch: false,
      ...observed,
    });
    console.log(`${row.rootId}: captured ${observed.nodes.length} nodes`);
    await page.evaluate(async (id) => {
      await window.__composition_STORE__.getState().removeElement(id);
    }, result.removeId);
  }
  errors = context.errors;
} finally {
  await browser.close();
}
const scenario = {
  id: "adr248-child-pixel-supplement-v1",
  originalScenarioHash: source.scenarioHash,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  date: "2026-09-28T12:00:00",
  clip,
  camera: { zoom: 0.675, pan: { x: 72, y: 85.5 } },
  rootIds: rows.map((r) => r.id),
};
writeFileSync(
  resolve(out, "replay.json"),
  JSON.stringify(
    {
      head: source.head,
      worktreeDirty: 0,
      scenarioId: scenario.id,
      scenarioHash: createHash("sha256")
        .update(JSON.stringify(scenario))
        .digest("hex"),
      scenario,
      captureClip: clip,
      rows,
      errors,
    },
    null,
    2,
  ) + "\n",
);
