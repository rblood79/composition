#!/usr/bin/env node
// ADR-248 G0: exercise every old Builder palette entry through its UI.
// This tests creation and Canvas presence, not each type's visual axes.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
  openPanels,
} from "./perf-baseline.mjs";

const root = resolve(import.meta.dirname, "../../..");
const audit = JSON.parse(
  readFileSync(
    resolve(root, "docs/adr/design/248-baseline/creation-route-audit.json"),
    "utf8",
  ),
);
const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0 && !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(
  outIndex >= 0
    ? process.argv[outIndex + 1]
    : "/private/tmp/adr248-palette-sweep.json",
);
const typesIndex = process.argv.indexOf("--types");
if (typesIndex >= 0 && !process.argv[typesIndex + 1])
  throw new Error("--types requires comma-separated names");
const types =
  typesIndex >= 0
    ? process.argv[typesIndex + 1].split(",").filter(Boolean)
    : audit.paletteTypes;
if (new Set(types).size !== types.length)
  throw new Error("Sweep types must be distinct");
for (const type of types) {
  if (!audit.paletteTypes.includes(type))
    throw new Error(`${type} is not in PALETTE_ORDER`);
}
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5173";
const scenario = {
  id: "adr248-old-palette-sweep-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: types.map((type) => ({
    op: "paletteInsert",
    component: type,
    parent: "page",
  })),
};
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== audit.baselineHead) throw new Error("Creation audit HEAD changed");
const scenarioHash = createHash("sha256")
  .update(JSON.stringify(scenario))
  .digest("hex");
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
    await openPanels(page, ["components"]);
    const rows = [];
    const search = page.locator('[data-panel-id="components"] input').first();
    for (const type of types) {
      if (type === "Slot") {
        rows.push({ type, status: "LAYOUT_MODE_ONLY" });
        continue;
      }
      try {
        const before = await page.evaluate(() => {
          const state = window.__composition_STORE__.getState();
          state.setSelectedElement(null);
          return state.elements.map((element) => element.id);
        });
        await search.fill(type);
        const item = page
          .locator('[data-panel-id="components"] .list-item')
          .first();
        await item.waitFor({ state: "visible", timeout: 5_000 });
        const label = (
          await item.locator(".list-item-name").textContent()
        )?.trim();
        await item.click();
        const id = await page
          .waitForFunction(
            ({ expected, oldIds }) => {
              const state = window.__composition_STORE__.getState();
              const added = state.elements.filter(
                (element) => !oldIds.includes(element.id) && !element.deleted,
              );
              return (
                added.find(
                  (element) =>
                    (element.type === expected ||
                      element.componentName === expected) &&
                    element.id === state.selectedElementId,
                )?.id ??
                added.find(
                  (element) =>
                    element.type === expected ||
                    element.componentName === expected,
                )?.id ??
                null
              );
            },
            { expected: type, oldIds: before },
            { timeout: 8_000 },
          )
          .then((handle) => handle.jsonValue());
        await page.waitForTimeout(250);
        const observed = await page.evaluate((elementId) => {
          const state = window.__composition_STORE__.getState();
          const element = state.elements.find(
            (entry) => entry.id === elementId,
          );
          const body = state.elements.find(
            (entry) =>
              entry.type === "body" && entry.page_id === state.currentPageId,
          );
          const projectId = location.pathname.split("/").pop();
          const document = window.__canonical_STORE__
            ?.getState()
            ?.getDocument?.(projectId);
          const layout = window.__composition_LAYOUT_DEBUG__
            ?.getSharedLayoutMap?.()
            ?.get(elementId);
          return {
            type: element?.type ?? null,
            componentName: element?.componentName ?? null,
            ref: element?.ref ?? null,
            parentIsPageBody: element?.parent_id === body?.id,
            inDocument: Boolean(
              document && JSON.stringify(document).includes(elementId),
            ),
            hasCanvasLayout: Boolean(layout),
            canvasRect: layout
              ? {
                  x: layout.x,
                  y: layout.y,
                  width: layout.width,
                  height: layout.height,
                }
              : null,
          };
        }, id);
        rows.push({
          type,
          label,
          status:
            observed.parentIsPageBody &&
            observed.inDocument &&
            observed.hasCanvasLayout
              ? "CREATED_WITH_LAYOUT"
              : "CREATED_INCOMPLETE",
          observed,
        });
      } catch (error) {
        rows.push({ type, status: "ERROR", message: String(error) });
      } finally {
        await search.fill("");
      }
      process.stdout.write(`${type}: ${rows.at(-1).status}\n`);
    }
    const report = {
      head,
      scenarioHash,
      scenario,
      fontState: await page.evaluate(() => ({
        bodyFamily: getComputedStyle(document.body).fontFamily,
        loadStatus: document.fonts.status,
      })),
      rows,
      errors,
    };
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(
      `${out}: ${rows.filter((row) => row.status === "CREATED_WITH_LAYOUT").length}/${rows.length} created with layout, ${errors.length} browser errors\n`,
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
