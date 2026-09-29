#!/usr/bin/env node
// ADR-248 G0: freeze the old production Canvas appearance of seeded state origins.
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
const readme = readFileSync(resolve(baselineDir, "README.md"), "utf8");
const expectedBuildHash =
  /production `dist\/index\.html` SHA-256: `([a-f0-9]{64})`/.exec(readme)?.[1];
const buildHash = createHash("sha256")
  .update(readFileSync(resolve(root, "apps/builder/dist/index.html")))
  .digest("hex");
if (!expectedBuildHash || buildHash !== expectedBuildHash)
  throw new Error("Frozen production build hash changed");
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(process.argv[outIndex + 1]);
const idsIndex = process.argv.indexOf("--ids");
if (idsIndex >= 0 && !process.argv[idsIndex + 1])
  throw new Error("--ids requires comma-separated origin IDs");
const requestedIds =
  idsIndex >= 0 ? process.argv[idsIndex + 1].split(",") : null;
const baseUrl = process.env.BUILDER_URL;
if (!baseUrl || !baseUrl.endsWith("/composition"))
  throw new Error(
    "BUILDER_URL must be the frozen /composition production base",
  );
const captureClip = { x: 320, y: 180, width: 800, height: 600 };
const scenario = {
  id: "adr248-old-seeded-state-origins-production-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: [
    { op: "openSystemComponentsPage", input: "Navigator double click" },
    { op: "zoomToSelection", input: "Shift+2", then: "clearSelection" },
  ],
};
const scenarioHash = createHash("sha256")
  .update(JSON.stringify(scenario))
  .digest("hex");
mkdirSync(resolve(out, "canvas"), { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const { context, page, errors } = await createInstrumentedContext(browser, {
    storageState: loadStorageState(
      resolve(root, "apps/builder/scripts/.auth-session.json"),
      new URL(baseUrl).origin,
    ),
    frameCapture: false,
    deviceScaleFactor: scenario.dpr,
  });
  try {
    await createIsolatedProject(page, baseUrl);
    await openPanels(page, ["navigator"]);
    await page
      .locator('[data-panel-id="navigator"]')
      .getByText("Components", { exact: true })
      .dblclick();
    await page.waitForFunction(
      () =>
        window.__composition_STORE__.getState().currentPageId ===
        "page-components",
    );
    const origins = await page.evaluate(() => {
      const state = window.__composition_STORE__.getState();
      return state.elements
        .filter(
          (entry) =>
            !entry.deleted &&
            entry.page_id === "page-components" &&
            typeof entry.metadata?.variant === "string",
        )
        .map((entry) => ({
          id: entry.id,
          type: entry.type,
          componentName: entry.componentName ?? null,
          state: entry.metadata.variant,
          role: entry.type === "ref" ? "variant-ref" : "base-origin",
          variantOf: entry.metadata.variantOf ?? entry.ref ?? null,
          ref: entry.ref ?? null,
          parentId: entry.parent_id ?? null,
          pageId: entry.page_id,
        }));
    });
    const ids = origins.map((entry) => entry.id);
    if (ids.length !== 75 || new Set(ids).size !== ids.length)
      throw new Error(
        `Expected 75 unique seeded states, observed ${ids.length}`,
      );
    const missingBase = origins.filter(
      (entry) => entry.role === "variant-ref" && !entry.variantOf,
    );
    if (missingBase.length)
      throw new Error(
        `Seeded state origins without base ref: ${JSON.stringify(missingBase)}`,
      );
    if (requestedIds?.some((id) => !ids.includes(id)))
      throw new Error("Requested origin ID is not seeded in the old app");
    await page
      .locator('.panel-toggle-rail button[aria-label="Navigator"]')
      .click();
    await page.locator('[data-testid="skia-canvas-unified"]').click({
      position: { x: 300, y: 300 },
    });
    const rows = [];
    for (const origin of origins) {
      if (requestedIds && !requestedIds.includes(origin.id)) continue;
      await page.evaluate((id) => {
        window.__composition_STORE__.getState().setSelectedElement(id);
      }, origin.id);
      await page.keyboard.press("Shift+2");
      await page.waitForTimeout(250);
      const zoomLabel = await page.locator(".zoom-input").inputValue();
      await page.evaluate(() => {
        window.__composition_STORE__.getState().setSelectedElement(null);
      });
      await page.waitForTimeout(250);
      const screenshot = `canvas/${origin.id}.png`;
      const png = await page.screenshot({
        path: resolve(out, screenshot),
        clip: captureClip,
        animations: "disabled",
      });
      const selectedAfterCapture = await page.evaluate(
        () => window.__composition_STORE__.getState().selectedElement,
      );
      if (selectedAfterCapture)
        throw new Error(`${origin.id}: selection overlay was not cleared`);
      rows.push({
        id: origin.id,
        state: origin.state,
        variantOf: origin.variantOf,
        zoomLabel,
        screenshot,
        pngSha256: createHash("sha256").update(png).digest("hex"),
      });
      process.stdout.write(
        `${rows.length}/${requestedIds?.length ?? origins.length} ${origin.id}\n`,
      );
    }
    const report = {
      head,
      buildIndexSha256: buildHash,
      scenarioHash,
      scenario,
      captureClip,
      fontState: await page.evaluate(() => ({
        bodyFamily: getComputedStyle(document.body).fontFamily,
        loadStatus: document.fonts.status,
      })),
      originCount: origins.length,
      origins,
      rows,
      errors,
    };
    writeFileSync(
      resolve(out, "baseline.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    if (
      rows.length !== (requestedIds?.length ?? origins.length) ||
      errors.length
    )
      throw new Error(
        `State origin capture incomplete: ${rows.length} rows, ${errors.length} errors`,
      );
    process.stdout.write(
      `${out}/baseline.json: ${rows.length} state origins\n`,
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
