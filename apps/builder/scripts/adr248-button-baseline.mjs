#!/usr/bin/env node
// ADR-248 G0: freeze the old Builder Canvas Button variant/size matrix.
// Only the semantic scenario is shared with the future graph driver.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
} from "./perf-baseline.mjs";

const root = resolve(import.meta.dirname, "../../..");
const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0 && !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(
  outIndex >= 0 ? process.argv[outIndex + 1] : "/private/tmp/adr248-button",
);
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5173";
const variants = [
  "accent",
  "primary",
  "secondary",
  "negative",
  "premium",
  "genai",
];
const sizes = ["xs", "sm", "md", "lg", "xl"];
const scenario = {
  id: "adr248-button-variant-size-baseline-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: [
    {
      op: "insert",
      id: "matrix",
      component: "frame",
      parent: "page",
      x: 40,
      y: 40,
      width: 1090,
      height: 460,
      fill: "#f7f8fa",
    },
    ...sizes.flatMap((size, row) =>
      variants.map((variant, column) => ({
        op: "insert",
        id: `button-${variant}-${size}`,
        component: "Button",
        parent: "matrix",
        x: 20 + column * 175,
        y: 20 + row * 84,
        width: 160,
        height: 64,
        text: `${variant} ${size}`,
        variant,
        size,
      })),
    ),
  ],
  expectedRelations: sizes.flatMap((size) =>
    variants.map((variant) => [`button-${variant}-${size}`, "matrix"]),
  ),
};
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const scenarioHash = createHash("sha256")
  .update(JSON.stringify(scenario))
  .digest("hex");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const { context, page, errors } = await createInstrumentedContext(browser, {
    storageState: loadStorageState(
      resolve(root, "apps/builder/scripts/.auth-session.json"),
      baseUrl,
    ),
    frameCapture: false,
    deviceScaleFactor: scenario.dpr,
  });
  try {
    await createIsolatedProject(page, baseUrl);
    const inserted = await page.evaluate(async (operations) => {
      const state = window.__composition_STORE__.getState();
      const pageId = state.currentPageId;
      const body = state.elements.find(
        (element) => element.page_id === pageId && element.type === "body",
      );
      if (!body) throw new Error("Current page body missing");
      const now = new Date().toISOString();
      const idFor = (id) => (id === "page" ? body.id : `adr248-${id}`);
      const nodes = operations.map((operation, index) => ({
        id: idFor(operation.id),
        customId: operation.id,
        type: operation.component,
        parent_id: idFor(operation.parent),
        page_id: pageId,
        order_num: index,
        created_at: now,
        updated_at: now,
        props: {
          ...(operation.variant ? { variant: operation.variant } : {}),
          ...(operation.size ? { size: operation.size } : {}),
          ...(operation.text ? { children: operation.text } : {}),
          style: {
            position: "absolute",
            left: `${operation.x}px`,
            top: `${operation.y}px`,
            width: `${operation.width}px`,
            height: `${operation.height}px`,
            ...(operation.fill ? { backgroundColor: operation.fill } : {}),
          },
        },
      }));
      await state.addComplexElement(nodes[0], nodes.slice(1));
      const authored = window.__composition_STORE__.getState().elements;
      const actualRelations = nodes.map((node) => {
        const current = authored.find((element) => element.id === node.id);
        if (!current || current.parent_id !== node.parent_id)
          throw new Error(`Authored parent differs for ${node.id}`);
        return [current.id, current.parent_id];
      });
      return { ids: nodes.map((node) => node.id), actualRelations };
    }, scenario.operations);
    await page.evaluate(() => {
      const apply = window.__composition_APPLY_VIEWPORT__;
      if (!apply) throw new Error("Canvas viewport hook missing");
      apply({ scale: 0.8, x: 100, y: 100 });
    });
    await page.waitForTimeout(1_000);
    const viewportState = await page.evaluate(
      () => window.__composition_VIEWPORT__?.() ?? null,
    );
    const fontState = await page.evaluate(() => ({
      bodyFamily: getComputedStyle(document.body).fontFamily,
      loadStatus: document.fonts.status,
    }));
    const geometry = await page.evaluate((ids) => {
      const map = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.();
      if (!map) throw new Error("Canvas layout debug map missing");
      return Object.fromEntries(ids.map((id) => [id, map.get(id) ?? null]));
    }, inserted.ids);
    const missing = Object.entries(geometry)
      .filter(([, layout]) => !layout)
      .map(([id]) => id);
    if (missing.length)
      throw new Error(`Button Canvas layout missing: ${missing.join(",")}`);
    if (fontState.loadStatus !== "loaded")
      throw new Error("Canvas font was not loaded");
    await page.locator('[data-testid="skia-canvas-unified"]').waitFor({
      state: "visible",
    });
    await page.screenshot({
      path: resolve(out, "canvas.png"),
      animations: "disabled",
      clip: { x: 100, y: 100, width: 1150, height: 580 },
    });
    const semanticTree = scenario.operations.map((operation) => ({
      id: operation.id,
      type: operation.component,
      parent: operation.parent,
      children: scenario.operations
        .filter((child) => child.parent === operation.id)
        .map((child) => child.id),
    }));
    const report = {
      head,
      scenarioHash,
      scenario,
      viewportState,
      fontState,
      geometry,
      semanticTree,
      actualRelations: inserted.actualRelations,
      errors,
    };
    writeFileSync(
      resolve(out, "baseline.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
    process.stdout.write(
      `${out}/baseline.json: ${inserted.ids.length} nodes, 0 unresolved layout, 0 errors\n`,
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
