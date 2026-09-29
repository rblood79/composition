#!/usr/bin/env node
// ADR-248 G0: capture each old palette base component from the frozen production
// Builder. The scenario is semantic; no canonical/catalog payload crosses drivers.
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
  readFileSync(resolve(baselineDir, "creation-route-audit.json"), "utf8"),
);
const readme = readFileSync(resolve(baselineDir, "README.md"), "utf8");
const expectedBuildHash =
  /production `dist\/index\.html` SHA-256: `([a-f0-9]{64})`/.exec(readme)?.[1];
const buildHash = createHash("sha256")
  .update(readFileSync(resolve(root, "apps/builder/dist/index.html")))
  .digest("hex");
if (!expectedBuildHash || buildHash !== expectedBuildHash)
  throw new Error("Frozen production build hash changed");
const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0 && !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(
  outIndex >= 0
    ? process.argv[outIndex + 1]
    : "/private/tmp/adr248-palette-production-base",
);
const typesIndex = process.argv.indexOf("--types");
if (typesIndex >= 0 && !process.argv[typesIndex + 1])
  throw new Error("--types requires comma-separated type names");
const types =
  typesIndex >= 0
    ? process.argv[typesIndex + 1].split(",").filter(Boolean)
    : audit.paletteTypes;
if (
  new Set(types).size !== types.length ||
  types.some((type) => !audit.paletteTypes.includes(type))
)
  throw new Error("Production palette types differ from frozen audit");
const baseUrl = process.env.BUILDER_URL;
if (!baseUrl || !baseUrl.endsWith("/composition"))
  throw new Error(
    "BUILDER_URL must be the frozen /composition production base",
  );
const scenario = {
  id: "adr248-old-palette-production-base-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: types.map((type) =>
    type === "Slot"
      ? { op: "deferToLayoutFixture", component: type }
      : {
          op: "paletteInsert",
          component: type,
          parent: "page",
          style: { x: 30, y: 30, width: 220, height: 130 },
          then: "remove",
        },
  ),
};
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== audit.baselineHead)
  throw new Error("Production baseline HEAD changed");
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
    const rows = [];
    for (const operation of scenario.operations) {
      const type = operation.component;
      if (operation.op === "deferToLayoutFixture") {
        rows.push({ type, status: "LAYOUT_MODE_ONLY" });
        continue;
      }
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
      const label = (
        await item.locator(".list-item-name").textContent()
      )?.trim();
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
      await page.evaluate(
        async ({ id, style }) => {
          const state = window.__composition_STORE__.getState();
          const element = state.elements.find((entry) => entry.id === id);
          if (!element) throw new Error(`Palette element missing: ${id}`);
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
        },
        { id, style: operation.style },
      );
      await page.waitForTimeout(400);
      const observed = await page.evaluate((id) => {
        const state = window.__composition_STORE__.getState();
        const element = state.elements.find((entry) => entry.id === id);
        const body = state.elements.find(
          (entry) =>
            entry.type === "body" && entry.page_id === state.currentPageId,
        );
        const projectId = location.pathname.split("/").pop();
        const doc = window.__canonical_STORE__
          ?.getState()
          ?.getDocument?.(projectId);
        return {
          type: element?.type ?? null,
          componentName: element?.componentName ?? null,
          ref: element?.ref ?? null,
          parentIsPageBody: element?.parent_id === body?.id,
          inDocument: doc ? JSON.stringify(doc).includes(id) : null,
        };
      }, id);
      if (!observed.parentIsPageBody || observed.inDocument === false)
        throw new Error(
          `${type}: authored relation/document missing ${JSON.stringify(observed)}`,
        );
      await page
        .locator(
          '.panel-toggle-rail button[aria-pressed="true"][aria-label="components" i]',
        )
        .click();
      await page.waitForTimeout(250);
      const png = await page.screenshot({
        path: resolve(out, "canvas", `${type}.png`),
        animations: "disabled",
        clip: captureClip,
      });
      const pngSha256 = createHash("sha256").update(png).digest("hex");
      const pixelEvidence = await page.evaluate(async (base64) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Screenshot decoder missing");
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(
          0,
          0,
          image.width,
          image.height,
        ).data;
        let nonWhite = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] < 254 || pixels[i + 1] < 254 || pixels[i + 2] < 254)
            nonWhite += 1;
        }
        return {
          width: image.width,
          height: image.height,
          nonWhite,
          threshold: "any RGB channel < 254",
        };
      }, png.toString("base64"));
      await page.evaluate(async (id) => {
        await window.__composition_STORE__.getState().removeElement(id);
      }, id);
      const activeNew = await page.evaluate(
        (oldIds) =>
          window.__composition_STORE__
            .getState()
            .elements.filter(
              (element) => !oldIds.includes(element.id) && !element.deleted,
            )
            .map((element) => element.type),
        before,
      );
      if (activeNew.length)
        throw new Error(
          `${type}: removal left active nodes ${activeNew.join(",")}`,
        );
      await page.waitForTimeout(200);
      await page
        .locator(
          '.panel-toggle-rail button[aria-pressed="false"][aria-label="components" i]',
        )
        .click();
      rows.push({
        type,
        label,
        status: "CAPTURED",
        observed,
        screenshot: `canvas/${type}.png`,
        pngSha256,
        pixelEvidence,
      });
      await search.fill("");
      process.stdout.write(
        `${type}: ${pixelEvidence.nonWhite} non-white pixels\n`,
      );
    }
    const report = {
      head,
      buildIndexSha256: buildHash,
      scenarioHash,
      scenario,
      cameraAction: "fit-to-screen menu before palette insertion",
      zoomLabel: await page.locator(".zoom-input").inputValue(),
      captureClip,
      fontState: await page.evaluate(() => ({
        bodyFamily: getComputedStyle(document.body).fontFamily,
        loadStatus: document.fonts.status,
      })),
      rows,
      errors,
    };
    writeFileSync(
      resolve(out, "baseline.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
    process.stdout.write(
      `${out}/baseline.json: ${rows.filter((row) => row.status === "CAPTURED").length}/${rows.length} production bases captured\n`,
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
