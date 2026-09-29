#!/usr/bin/env node
// ADR-248 G0: exercise the old Builder's actual palette creation command.
// Semantic input is independent of either document serialization.
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
const audit = JSON.parse(
  readFileSync(resolve(baselineDir, "creation-route-audit.json")),
);
const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0 && !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(
  outIndex >= 0 ? process.argv[outIndex + 1] : "/private/tmp/adr248-palette",
);
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5173";
const scenario = {
  id: "adr248-old-palette-creation-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: [
    {
      op: "paletteInsert",
      component: "Text",
      parent: "page",
      style: { left: 30, top: 20, width: 160, height: 40 },
      text: "저장",
    },
    {
      op: "paletteInsert",
      component: "Image",
      parent: "page",
      style: { left: 220, top: 20, width: 160, height: 100 },
    },
    {
      op: "paletteInsert",
      component: "frame",
      parent: "page",
      style: { left: 30, top: 150, width: 350, height: 170 },
    },
    {
      op: "paletteInsert",
      component: "Button",
      parent: "page",
      style: { left: 400, top: 150, width: 160, height: 64 },
    },
  ],
};
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== audit.baselineHead) throw new Error("Creation audit HEAD changed");
for (const operation of scenario.operations) {
  if (
    !audit.routes.find((route) => route.type === operation.component)
      ?.paletteEntry
  )
    throw new Error(`${operation.component} is not a palette entry`);
}
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
    await openPanels(page, ["components"]);
    const rows = [];
    for (const operation of scenario.operations) {
      const before = await page.evaluate(() => {
        const state = window.__composition_STORE__.getState();
        state.setSelectedElement(null);
        return state.elements.map((element) => element.id);
      });
      const search = page.locator('[data-panel-id="components"] input').first();
      await search.fill(operation.component);
      const item = page
        .locator('[data-panel-id="components"] .list-item')
        .first();
      await item.waitFor({ state: "visible" });
      const paletteLabel = await item.locator(".list-item-name").textContent();
      await item.click();
      const createdId = await page
        .waitForFunction(
          (oldIds) =>
            window.__composition_STORE__
              .getState()
              .elements.find(
                (element) => !oldIds.includes(element.id) && !element.deleted,
              )?.id ?? null,
          before,
          { timeout: 20_000 },
        )
        .then((handle) => handle.jsonValue());
      await page.evaluate(
        async ({ id, style, text }) => {
          const state = window.__composition_STORE__.getState();
          const element = state.elements.find((entry) => entry.id === id);
          if (!element) throw new Error(`Created element missing: ${id}`);
          await state.updateElementProps(id, {
            ...(text ? { children: text } : {}),
            style: {
              ...(element.props?.style ?? {}),
              position: "absolute",
              left: `${style.left}px`,
              top: `${style.top}px`,
              width: `${style.width}px`,
              height: `${style.height}px`,
              ...(element.type === "frame"
                ? { backgroundColor: "#dbe7ff" }
                : {}),
            },
          });
        },
        { id: createdId, style: operation.style, text: operation.text },
      );
      await page.waitForTimeout(600);
      const observed = await page.evaluate((id) => {
        const state = window.__composition_STORE__.getState();
        const element = state.elements.find((entry) => entry.id === id);
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
          ?.get(id);
        return {
          type: element?.type ?? null,
          componentName: element?.componentName ?? null,
          ref: element?.ref ?? null,
          parentIsPageBody: element?.parent_id === body?.id,
          inDocument: Boolean(
            document && JSON.stringify(document).includes(id),
          ),
          layout: layout
            ? {
                x: layout.x,
                y: layout.y,
                width: layout.width,
                height: layout.height,
              }
            : null,
        };
      }, createdId);
      if (
        !observed.parentIsPageBody ||
        !observed.inDocument ||
        !observed.layout
      )
        throw new Error(
          `${operation.component}: creation relation/persist failed`,
        );
      if (
        observed.type !== operation.component &&
        observed.componentName !== operation.component
      )
        throw new Error(
          `${operation.component}: unexpected created ${observed.type}`,
        );
      if (
        operation.component === "Button" &&
        (observed.type !== "ref" || observed.ref !== "component-button")
      )
        throw new Error("Button did not take the reusable origin branch");
      rows.push({
        component: operation.component,
        paletteLabel: paletteLabel?.trim() ?? "",
        observed,
      });
      await search.fill("");
    }
    const fontState = await page.evaluate(() => ({
      bodyFamily: getComputedStyle(document.body).fontFamily,
      loadStatus: document.fonts.status,
    }));
    await page.evaluate(() =>
      window.__composition_APPLY_VIEWPORT__?.({ scale: 0.8, x: 300, y: 180 }),
    );
    await page.evaluate(() =>
      window.__composition_STORE__.getState().setSelectedElement(null),
    );
    await page
      .locator(
        '.panel-toggle-rail button[aria-pressed="true"][aria-label="components" i]',
      )
      .click();
    await page.waitForTimeout(600);
    const viewportState = await page.evaluate(
      () => window.__composition_VIEWPORT__?.() ?? null,
    );
    const semanticTree = scenario.operations.map((operation) => ({
      type: operation.component,
      parent: operation.parent,
    }));
    await page.screenshot({
      path: resolve(out, "canvas.png"),
      animations: "disabled",
      clip: { x: 300, y: 180, width: 900, height: 600 },
    });
    const report = {
      head,
      scenarioHash,
      scenario,
      viewportState,
      fontState,
      semanticTree,
      rows,
      errors,
    };
    writeFileSync(
      resolve(out, "baseline.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
    process.stdout.write(
      `${out}/baseline.json: ${rows.length} palette commands, 0 errors\n`,
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
