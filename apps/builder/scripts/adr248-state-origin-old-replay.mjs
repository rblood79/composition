#!/usr/bin/env node
// ADR-248 G3: supplement the frozen state-origin PNGs with the old camera and layout tree.
// The G0 baseline is read only. Run against the clean G0 worktree's existing dev server.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
  openPanels,
} from "./perf-baseline.mjs";

const root = resolve(import.meta.dirname, "../../..");
const frozenPath = resolve(
  root,
  "docs/adr/design/248-baseline/state-origins-production/baseline.json",
);
const frozen = JSON.parse(readFileSync(frozenPath, "utf8"));
const worktree = process.env.WORKTREE;
const baseUrl = process.env.BUILDER_URL;
if (!worktree || !baseUrl?.startsWith("http://localhost:"))
  throw new Error("WORKTREE and localhost BUILDER_URL are required");
const git = (...args) =>
  execFileSync("git", args, { cwd: worktree, encoding: "utf8" }).trim();
if (git("rev-parse", "HEAD") !== frozen.head)
  throw new Error("State-origin replay worktree is not the G0 HEAD");
if (git("status", "--porcelain"))
  throw new Error("State-origin replay worktree is dirty");
const scenarioHash = createHash("sha256")
  .update(JSON.stringify(frozen.scenario))
  .digest("hex");
if (scenarioHash !== frozen.scenarioHash)
  throw new Error("Frozen state-origin scenario hash changed");
const flag = process.argv.indexOf("--ids");
const ids = flag < 0 ? null : new Set(process.argv[flag + 1]?.split(","));
if (flag >= 0 && (!ids?.size || [...ids].some((id) => !frozen.rows.some((r) => r.id === id))))
  throw new Error("--ids must name frozen state-origin IDs");
const outFlag = process.argv.indexOf("--out");
const out = resolve(
  outFlag >= 0 ? process.argv[outFlag + 1] :
    resolve(root, "docs/adr/design/248-phase3-state-origin-old-replay.json"),
);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const observe = (id) => {
  const debug = window.__composition_LAYOUT_DEBUG__;
  const layout = debug?.getSharedLayoutMap?.();
  const children = debug?.getSharedFilteredChildrenMap?.();
  const state = window.__composition_STORE__.getState();
  const origin = state.elements.find((entry) => entry.id === id);
  const nodes = [];
  const visit = (key, parent, parentX, parentY) => {
    const rect = layout?.get(key);
    const x = parentX + (rect?.x ?? 0);
    const y = parentY + (rect?.y ?? 0);
    nodes.push({
      path: key === id ? "" : key.slice(id.length + 1),
      parent: parent === null ? null : parent === id ? "" : parent.slice(id.length + 1),
      relative: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      rect: rect ? { x, y, width: rect.width, height: rect.height } : null,
      engineInput: debug?.getEngineInput?.(key) ?? null,
    });
    for (const child of children?.get(key) ?? []) visit(child, key, x, y);
  };
  visit(id, null, 0, 0);
  const viewport = window.__composition_VIEWPORT__();
  const canvasRect = document.querySelector('[data-testid="skia-canvas-unified"]')?.getBoundingClientRect();
  return {
    origin: origin ? {
      type: origin.type,
      ref: origin.ref ?? null,
      state: origin.metadata?.variant ?? null,
      style: origin.props?.style ?? null,
    } : null,
    camera: {
      zoom: viewport.zoom,
      pan: viewport.panOffset,
      canvasRect: canvasRect ? { x: canvasRect.x, y: canvasRect.y, width: canvasRect.width, height: canvasRect.height } : null,
    },
    nodes,
  };
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows = [];
let errors = [];
try {
  const { context, page, errors: capturedErrors } = await createInstrumentedContext(browser, {
    storageState: loadStorageState(
      resolve(root, "apps/builder/scripts/.auth-session.json"),
      new URL(baseUrl).origin,
    ),
    frameCapture: false,
    deviceScaleFactor: frozen.scenario.dpr,
  });
  try {
    await createIsolatedProject(page, baseUrl);
    await openPanels(page, ["navigator"]);
    // The G0 focus click lands on the Home page when it arrives before the camera settles on
    // Components, so the click is repeated until the Components page stays current.
    for (let attempt = 0; ; attempt++) {
      await page.locator('[data-panel-id="navigator"]').getByText("Components", { exact: true }).dblclick();
      await page.waitForFunction(() => window.__composition_STORE__.getState().currentPageId === "page-components");
      await page.locator('.panel-toggle-rail button[aria-label="Navigator"]').click();
      await page.waitForTimeout(250 * (attempt + 1));
      await page.locator('[data-testid="skia-canvas-unified"]').click({ position: { x: 300, y: 300 } });
      if (await page.evaluate(() => window.__composition_STORE__.getState().currentPageId === "page-components")) break;
      if (attempt === 4) throw new Error("Components page did not stay current after the focus click");
      await page.locator('.panel-toggle-rail button[aria-label="Navigator"]').click();
    }
    for (const frozenRow of frozen.rows) {
      if (ids && !ids.has(frozenRow.id)) continue;
      await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), frozenRow.id);
      await page.waitForFunction((id) => window.__composition_STORE__.getState().selectedElementId === id, frozenRow.id);
      // Let the Canvas shortcut handler see the selected ID before dispatching the public key.
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      await page.keyboard.press("Shift+2");
      await page.waitForTimeout(250);
      const zoomLabel = await page.locator(".zoom-input").inputValue();
      await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));
      await page.waitForTimeout(250);
      const png = await page.screenshot({ clip: frozen.captureClip, animations: "disabled" });
      const observed = await page.evaluate(observe, frozenRow.id);
      const pngSha256 = sha256(png);
      if (process.env.PNG_DIR) writeFileSync(resolve(process.env.PNG_DIR, `${frozenRow.id}.png`), png);
      rows.push({
        id: frozenRow.id,
        state: frozenRow.state,
        variantOf: frozenRow.variantOf,
        zoomLabel,
        frozenPngMatch: pngSha256 === frozenRow.pngSha256,
        pngSha256,
        frozenPngSha256: frozenRow.pngSha256,
        ...observed,
      });
      process.stdout.write(`${rows.length}/${ids?.size ?? frozen.rows.length} ${frozenRow.id}: ${pngSha256 === frozenRow.pngSha256}\n`);
    }
    errors = capturedErrors;
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
writeFileSync(out, `${JSON.stringify({
  adr: 248,
  phase: 3,
  check: "state-origin old replay (camera and layout only; G0 PNG unchanged)",
  frozenBaseline: "docs/adr/design/248-baseline/state-origins-production/baseline.json",
  head: frozen.head,
  worktreeDirty: 0,
  scenarioId: frozen.scenario.id,
  scenarioHash,
  captureClip: frozen.captureClip,
  summary: {
    rows: rows.length,
    frozenPngMatch: rows.filter((row) => row.frozenPngMatch).length,
    rootsWithLayout: rows.filter((row) => row.nodes[0]?.relative).length,
  },
  rows,
  errors,
}, null, 2)}\n`);
if (errors.length) throw new Error(`State-origin replay browser errors: ${errors.length}`);
