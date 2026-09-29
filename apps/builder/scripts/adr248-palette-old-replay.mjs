#!/usr/bin/env node
// ADR-248 G3 (Phase 3 pre-cutover evidence): replay the frozen G0 palette-production-base
// scenario on the old app built from the G0 baseline commit, and record what the frozen capture
// did not: the camera (zoom/pan) and the old layout rects of each inserted subtree.
//
// The frozen G0 artifacts are not modified. A replay row is usable as the camera/geometry oracle
// only when its PNG is byte-identical to the frozen PNG (same old state); other rows are kept
// with `frozenPngMatch: false` and their reason is recorded by the consumer.
//
// Usage: WORKTREE=<baseline worktree> BUILDER_URL=http://localhost:<port> \
//   node apps/builder/scripts/adr248-palette-old-replay.mjs [--scenario base|axis] [--types A,B] [--out file]
// `--scenario axis` replays the frozen palette-variant-size scenario (386 single variant/size
// axes, `adr248-palette-axis-baseline.mjs` edit order) and records the rect set per axis.
// The baseline worktree must be `git worktree add` of the G0 baseline commit with its own
// lockfile install and engine wasm build, dirty 0 (gitignored .env/license copied only).
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
const argValue = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const axisMode = argValue("--scenario") === "axis";
const baseDir = resolve(
  root,
  axisMode
    ? "docs/adr/design/248-baseline/palette-variant-size"
    : "docs/adr/design/248-baseline/palette-production-base",
);
const frozen = JSON.parse(
  readFileSync(resolve(baseDir, "baseline.json"), "utf8"),
);
const worktree = process.env.WORKTREE;
const baseUrl = process.env.BUILDER_URL;
if (!worktree || !baseUrl)
  throw new Error("WORKTREE and BUILDER_URL are required");
const git = (...args) =>
  execFileSync("git", args, { cwd: worktree, encoding: "utf8" }).trim();
const head = git("rev-parse", "HEAD");
if (head !== frozen.head)
  throw new Error(
    `Replay worktree HEAD ${head} is not the G0 baseline ${frozen.head}`,
  );
const dirty = git("status", "--porcelain").split("\n").filter(Boolean);
if (dirty.length)
  throw new Error(`Replay worktree is dirty: ${dirty.join(", ")}`);
const scenarioHash = createHash("sha256")
  .update(JSON.stringify(frozen.scenario))
  .digest("hex");
if (scenarioHash !== frozen.scenarioHash)
  throw new Error("Frozen scenario hash does not reproduce");
const captured = axisMode
  ? frozen.rows
  : frozen.rows.filter((row) => row.status === "CAPTURED");
const types =
  argValue("--types")?.split(",").filter(Boolean) ??
  captured.map((row) => row.type);
const out = resolve(
  argValue("--out") ??
    resolve(
      root,
      axisMode
        ? "docs/adr/design/248-phase3-palette-axis-old-replay.json"
        : "docs/adr/design/248-phase3-palette-old-replay.json",
    ),
);

const OBSERVE = (id) => {
  const debug = window.__composition_LAYOUT_DEBUG__;
  const layout = debug.getSharedLayoutMap();
  const children = debug.getSharedFilteredChildrenMap();
  const state = window.__composition_STORE__.getState();
  const element = state.elements.find((entry) => entry.id === id);
  const nodes = [];
  // Layout rects are parent-relative; accumulate to page coordinates (body at 0,0).
  // Path segments may contain "/" (named ref children), so the parent link is explicit.
  const pathOf = (key) => (key === id ? "" : key.slice(id.length + 1));
  const visit = (key, parent, parentX, parentY) => {
    const rect = layout.get(key);
    const x = parentX + (rect?.x ?? 0);
    const y = parentY + (rect?.y ?? 0);
    nodes.push({
      path: pathOf(key),
      parent: parent === null ? null : pathOf(parent),
      rect: rect ? { x, y, width: rect.width, height: rect.height } : null,
      // The old engine input style of this node (layout-input oracle, diagnostic).
      engineInput: debug.getEngineInput(key) ?? null,
    });
    for (const child of children.get(key) ?? []) visit(child, key, x, y);
  };
  visit(id, null, 0, 0);
  const viewport = window.__composition_VIEWPORT__();
  const canvas = document.querySelector('[data-testid="skia-canvas-unified"]');
  const canvasRect = canvas.getBoundingClientRect();
  return {
    elementType: element.type,
    componentName: element.componentName ?? null,
    ref: element.ref ?? null,
    camera: {
      zoom: viewport.zoom,
      pan: viewport.panOffset,
      canvasRect: {
        x: canvasRect.x,
        y: canvasRect.y,
        width: canvasRect.width,
        height: canvasRect.height,
      },
    },
    nodes,
  };
};

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
    deviceScaleFactor: frozen.scenario.dpr,
  });
  const { page } = context;
  await createIsolatedProject(page, baseUrl);
  await openPanels(page, ["components"]);
  // Same camera command as the frozen capture: zoom menu item 4 = Fit to screen.
  await page.locator(".zoom-chevron-button").click();
  await page.locator(".zoom-menu-item").nth(4).click();
  const search = page.locator('[data-panel-id="components"] input').first();
  for (const type of types) {
    const operation = frozen.scenario.operations.find(
      (entry) =>
        entry.component === type &&
        entry.op === (axisMode ? "paletteInsertAndEditAxes" : "paletteInsert"),
    );
    if (!operation) throw new Error(`${type}: not a frozen palette insert`);
    const before = await page.evaluate(() => {
      const state = window.__composition_STORE__.getState();
      state.setSelectedElement(null);
      return state.elements.map((element) => element.id);
    });
    await search.fill(type);
    const item = page
      .locator('[data-panel-id="components"] .list-item')
      .first();
    await item.waitFor({ state: "visible", timeout: 8_000 });
    await item.click();
    const id = await page
      .waitForFunction(
        ({ type, oldIds }) => {
          const state = window.__composition_STORE__.getState();
          return (
            state.elements.find(
              (element) =>
                !oldIds.includes(element.id) &&
                !element.deleted &&
                (element.type === type || element.componentName === type),
            )?.id ?? null
          );
        },
        { type, oldIds: before },
        { timeout: 15_000 },
      )
      .then((handle) => handle.jsonValue());
    const baseProps = await page.evaluate(
      async ({ id, style }) => {
        const state = window.__composition_STORE__.getState();
        const element = state.elements.find((entry) => entry.id === id);
        await state.updateElementProps(id, {
          style: {
            ...(element.props?.style ?? {}),
            position: "absolute",
            left: `${style.x}px`,
            top: `${style.y}px`,
            width: `${style.width}px`,
            height: `${style.height}px`,
          },
        });
        state.setSelectedElement(null);
        const updated = window.__composition_STORE__
          .getState()
          .elements.find((entry) => entry.id === id);
        return JSON.parse(JSON.stringify(updated?.props ?? {}));
      },
      { id, style: operation.style },
    );
    await page.waitForTimeout(400);
    await page
      .locator(
        '.panel-toggle-rail button[aria-pressed="true"][aria-label="components" i]',
      )
      .click();
    await page.waitForTimeout(250);
    const captureOnce = async () => {
      const png = await page.screenshot({
        animations: "disabled",
        clip: frozen.captureClip,
      });
      const observed = await page.evaluate(OBSERVE, id);
      return {
        pngSha256: createHash("sha256").update(png).digest("hex"),
        observed,
      };
    };
    if (axisMode) {
      const frozenRow = frozen.rows.find((row) => row.type === type);
      const axes = [];
      for (const axis of operation.axes) {
        await page.evaluate(
          async ({ id, baseProps, axis }) => {
            const store = window.__composition_STORE__.getState();
            await store.updateElement(id, {
              props: { ...baseProps, [axis.prop]: axis.value },
            });
            store.setSelectedElement(null);
          },
          { id, baseProps, axis },
        );
        await page.waitForTimeout(300);
        const { pngSha256, observed } = await captureOnce();
        const frozenCapture = frozenRow.captures.find(
          (entry) => entry.axis === axis.axis,
        );
        axes.push({
          axis: axis.axis,
          frozenPngMatch: pngSha256 === frozenCapture?.pngSha256,
          pngSha256,
          frozenPngSha256: frozenCapture?.pngSha256 ?? null,
          ...observed,
        });
      }
      rows.push({ type, axes });
      process.stdout.write(
        `${type}: frozen PNG match ${axes.filter((a) => a.frozenPngMatch).length}/${axes.length}\n`,
      );
    } else {
      const { pngSha256, observed } = await captureOnce();
      const frozenRow = frozen.rows.find((row) => row.type === type);
      rows.push({
        type,
        frozenPngMatch: pngSha256 === frozenRow.pngSha256,
        pngSha256,
        frozenPngSha256: frozenRow.pngSha256,
        ...observed,
      });
      process.stdout.write(
        `${type}: frozen PNG match ${pngSha256 === frozenRow.pngSha256}\n`,
      );
    }
    await page.evaluate(async (id) => {
      await window.__composition_STORE__.getState().removeElement(id);
    }, id);
    await page.waitForTimeout(200);
    await page
      .locator(
        '.panel-toggle-rail button[aria-pressed="false"][aria-label="components" i]',
      )
      .click();
    await search.fill("");
  }
  errors = context.errors;
} finally {
  await browser.close();
}
writeFileSync(
  out,
  `${JSON.stringify(
    {
      adr: 248,
      phase: 3,
      check: axisMode
        ? "palette-variant-size old replay (camera + old geometry per axis)"
        : "palette-production-base old replay (camera + old geometry supplement)",
      frozenBaseline: axisMode
        ? "docs/adr/design/248-baseline/palette-variant-size/baseline.json"
        : "docs/adr/design/248-baseline/palette-production-base/baseline.json",
      head,
      worktreeDirty: 0,
      serve:
        "vite dev server of the baseline worktree (DEV hooks expose viewport/layout)",
      scenarioId: frozen.scenario.id,
      scenarioHash,
      captureClip: frozen.captureClip,
      summary: (() => {
        const captures = axisMode ? rows.flatMap((row) => row.axes) : rows;
        return {
          rows: rows.length,
          captures: captures.length,
          frozenPngMatch: captures.filter((row) => row.frozenPngMatch).length,
          cameras: [
            ...new Set(captures.map((row) => JSON.stringify(row.camera))),
          ].map((camera) => JSON.parse(camera)),
        };
      })(),
      rows,
      errors,
    },
    null,
    2,
  )}\n`,
);
