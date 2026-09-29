#!/usr/bin/env node
// ADR-248 G0: freeze the old Builder Canvas result from semantic operations.
// The scenario carries no canonical or catalog serialization.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
} from "./perf-baseline.mjs";

const root = resolve(import.meta.dirname, "../../..");
const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0 && !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(
  outIndex >= 0 ? process.argv[outIndex + 1] : "/private/tmp/adr248-g0-canvas",
);
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5173";
const scenario = {
  id: "adr248-structural-baseline-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: [
    {
      op: "insert",
      id: "frame",
      component: "frame",
      parent: "page",
      x: 40,
      y: 40,
      width: 440,
      height: 260,
      fill: "#dbe7ff",
      border: "#3851a4",
    },
    {
      op: "insert",
      id: "group",
      component: "Group",
      parent: "frame",
      x: 20,
      y: 20,
      width: 380,
      height: 120,
      orientation: "horizontal",
    },
    {
      op: "insert",
      id: "slot",
      component: "Slot",
      parent: "frame",
      x: 20,
      y: 150,
      width: 160,
      height: 80,
      size: "md",
      description: "내용",
    },
    {
      op: "insert",
      id: "text",
      component: "Text",
      parent: "group",
      x: 180,
      y: 0,
      width: 160,
      height: 40,
      text: "저장",
    },
  ],
  expectedRelations: [
    ["frame", "page"],
    ["group", "frame"],
    ["slot", "frame"],
    ["text", "group"],
  ],
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
    storageState: JSON.parse(
      readFileSync(
        resolve(root, "apps/builder/scripts/.auth-session.json"),
        "utf8",
      ),
    ),
    frameCapture: false,
    deviceScaleFactor: scenario.dpr,
  });
  await createIsolatedProject(page, baseUrl);
  const result = await page.evaluate(async (operations) => {
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
        ...(operation.orientation
          ? { orientation: operation.orientation }
          : {}),
        ...(operation.size ? { size: operation.size } : {}),
        ...(operation.description
          ? { description: operation.description }
          : {}),
        ...(operation.text ? { children: operation.text } : {}),
        style: {
          position: "absolute",
          left: `${operation.x}px`,
          top: `${operation.y}px`,
          width: `${operation.width}px`,
          height: `${operation.height}px`,
          ...(operation.fill ? { backgroundColor: operation.fill } : {}),
          ...(operation.border
            ? { border: `2px solid ${operation.border}` }
            : {}),
        },
      },
    }));
    await state.addComplexElement(nodes[0], nodes.slice(1));
    return { pageId, bodyId: body.id, ids: nodes.map((node) => node.id) };
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
  }, result.ids);
  const unresolvedLayoutIds = Object.entries(geometry)
    .filter(([, value]) => !value)
    .map(([id]) => id);
  if (unresolvedLayoutIds.some((id) => id !== "adr248-slot")) {
    throw new Error(
      `Unexpected missing Canvas layout: ${JSON.stringify(geometry)}`,
    );
  }
  const canvas = page.locator('[data-testid="skia-canvas-unified"]');
  await canvas.waitFor({ state: "visible" });
  await page.screenshot({
    path: resolve(out, "canvas.png"),
    animations: "disabled",
    clip: { x: 100, y: 100, width: 620, height: 400 },
  });
  const semanticTree = scenario.operations.map((op) => ({
    id: op.id,
    type: op.component,
    parent: op.parent,
    children: scenario.operations
      .filter((child) => child.parent === op.id)
      .map((child) => child.id),
  }));
  const projectId = new URL(page.url()).pathname.split("/").pop();
  const documentBytes = await page.evaluate((id) => {
    const document = window.__canonical_STORE__?.getState()?.getDocument?.(id);
    if (!document)
      throw new Error("Canonical document unavailable for byte baseline");
    return new TextEncoder().encode(JSON.stringify(document)).byteLength;
  }, projectId);
  const report = {
    head,
    scenarioHash,
    scenario,
    viewportState,
    fontState,
    geometry,
    unresolvedLayoutIds,
    semanticTree,
    documentBytes,
    errors,
  };
  writeFileSync(
    resolve(out, "baseline.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await context.close();
  if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
  process.stdout.write(
    `${out}/baseline.json: ${result.ids.length} nodes, ${documentBytes} bytes, unresolved layout ${unresolvedLayoutIds.join(",") || "none"}, 0 errors\n`,
  );
} finally {
  await browser.close();
}
