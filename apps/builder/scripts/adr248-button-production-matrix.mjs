#!/usr/bin/env node
// ADR-248 G0: capture the old production Builder's real palette Button ref
// across its declared variant/size axes, using the public edit action.
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
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(process.argv[outIndex + 1]);
const baseUrl = process.env.BUILDER_URL;
if (!baseUrl || !baseUrl.endsWith("/composition"))
  throw new Error(
    "BUILDER_URL must be the frozen /composition production base",
  );
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
  id: "adr248-old-button-production-ref-matrix-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: [
    { op: "paletteInsert", component: "Button", parent: "page" },
    { op: "setStyle", x: 30, y: 30, width: 220, height: 130 },
    ...sizes.flatMap((size) =>
      variants.map((variant) => ({ op: "setPropsAndCapture", variant, size })),
    ),
  ],
};
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const scenarioHash = createHash("sha256")
  .update(JSON.stringify(scenario))
  .digest("hex");
const captureClip = { x: 85, y: 95, width: 600, height: 400 };
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
    await openPanels(page, ["components"]);
    await page.locator(".zoom-chevron-button").click();
    await page.locator(".zoom-menu-item").nth(4).click();
    const search = page.locator('[data-panel-id="components"] input').first();
    await search.fill("Button");
    const item = page
      .locator('[data-panel-id="components"] .list-item')
      .first();
    await item.waitFor({ state: "visible" });
    if (
      (await item.locator(".list-item-name").textContent())
        ?.trim()
        .toLowerCase() !== "button"
    )
      throw new Error("Palette search did not select Button");
    const before = await page.evaluate(() =>
      window.__composition_STORE__
        .getState()
        .elements.map((element) => element.id),
    );
    await item.click();
    const id = await page
      .waitForFunction(
        (oldIds) =>
          window.__composition_STORE__
            .getState()
            .elements.find(
              (element) =>
                !oldIds.includes(element.id) &&
                !element.deleted &&
                element.type === "ref" &&
                element.componentName === "Button",
            )?.id ?? null,
        before,
      )
      .then((handle) => handle.jsonValue());
    await page.evaluate(async (id) => {
      const store = window.__composition_STORE__.getState();
      const element = store.elements.find((entry) => entry.id === id);
      if (!element) throw new Error("Button ref missing");
      await store.updateElementProps(id, {
        style: {
          ...(element.props?.style ?? {}),
          position: "absolute",
          left: "30px",
          top: "30px",
          width: "220px",
          height: "130px",
        },
      });
      store.setSelectedElement(null);
    }, id);
    await page
      .locator(
        '.panel-toggle-rail button[aria-pressed="true"][aria-label="components" i]',
      )
      .click();
    await page.waitForTimeout(300);
    const rows = [];
    for (const operation of scenario.operations.slice(2)) {
      await page.evaluate(
        async ({ id, variant, size }) => {
          await window.__composition_STORE__.getState().updateElementProps(id, {
            variant,
            size,
          });
        },
        { id, variant: operation.variant, size: operation.size },
      );
      await page.waitForFunction(
        ({ id, variant, size }) => {
          const element = window.__composition_STORE__
            .getState()
            .elements.find((entry) => entry.id === id);
          return (
            element?.props?.variant === variant && element?.props?.size === size
          );
        },
        { id, variant: operation.variant, size: operation.size },
      );
      await page.waitForTimeout(300);
      const screenshot = `canvas/${operation.variant}-${operation.size}.png`;
      const png = await page.screenshot({
        path: resolve(out, screenshot),
        animations: "disabled",
        clip: captureClip,
      });
      rows.push({
        variant: operation.variant,
        size: operation.size,
        screenshot,
        pngSha256: createHash("sha256").update(png).digest("hex"),
      });
      process.stdout.write(`${operation.variant}/${operation.size}\n`);
    }
    const observed = await page.evaluate((id) => {
      const store = window.__composition_STORE__.getState();
      const element = store.elements.find((entry) => entry.id === id);
      const body = store.elements.find(
        (entry) =>
          entry.type === "body" && entry.page_id === store.currentPageId,
      );
      return {
        type: element?.type,
        componentName: element?.componentName,
        ref: element?.ref,
        parentIsPageBody: element?.parent_id === body?.id,
      };
    }, id);
    if (!observed.parentIsPageBody)
      throw new Error("Button ref is not owned by page body");
    const report = {
      head,
      buildIndexSha256: buildHash,
      scenarioHash,
      scenario,
      captureClip,
      zoomLabel: await page.locator(".zoom-input").inputValue(),
      fontState: await page.evaluate(() => ({
        bodyFamily: getComputedStyle(document.body).fontFamily,
        loadStatus: document.fonts.status,
      })),
      observed,
      distinctScreenshotHashes: new Set(rows.map((row) => row.pngSha256)).size,
      rows,
      errors,
    };
    writeFileSync(
      resolve(out, "baseline.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    if (rows.length !== 30 || errors.length)
      throw new Error(
        `Button matrix incomplete: ${rows.length} rows, ${errors.length} errors`,
      );
    process.stdout.write(
      `${out}/baseline.json: ${rows.length} ref captures, ${report.distinctScreenshotHashes} distinct hashes\n`,
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
