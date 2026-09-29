#!/usr/bin/env node
// ADR-248 G0: reproduce the old production Modal reference with no system
// origin. This is a known old-app defect, not a parity target for the new graph.
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
const baseUrl = process.env.BUILDER_URL;
if (!baseUrl || !baseUrl.endsWith("/composition"))
  throw new Error(
    "BUILDER_URL must be the frozen /composition production base",
  );
const scenario = {
  id: "adr248-old-modal-missing-origin-production-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: [
    {
      op: "addElement",
      type: "ref",
      componentName: "Modal",
      ref: "component-modal",
      parent: "page-body",
      props: {
        style: {
          position: "absolute",
          left: "30px",
          top: "30px",
          width: "220px",
          height: "130px",
        },
      },
    },
  ],
};
const scenarioHash = createHash("sha256")
  .update(JSON.stringify(scenario))
  .digest("hex");
const captureClip = { x: 85, y: 95, width: 600, height: 400 };
mkdirSync(out, { recursive: true });
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
    await page
      .locator(
        '.panel-toggle-rail button[aria-pressed="true"][aria-label="components" i]',
      )
      .click();
    const observed = await page.evaluate(async (operation) => {
      const state = window.__composition_STORE__.getState();
      const body = state.elements.find(
        (entry) =>
          entry.type === "body" && entry.page_id === state.currentPageId,
      );
      if (!body) throw new Error("Current page body missing");
      const originMissingBefore = !state.elements.some(
        (entry) => entry.id === operation.ref && !entry.deleted,
      );
      const id = "adr248-modal-ref";
      const now = new Date().toISOString();
      await state.addElement({
        id,
        type: operation.type,
        ref: operation.ref,
        componentName: operation.componentName,
        props: operation.props,
        page_id: state.currentPageId,
        parent_id: body.id,
        created_at: now,
        updated_at: now,
      });
      const current = window.__composition_STORE__.getState();
      const ref = current.elements.find((entry) => entry.id === id);
      current.setSelectedElement(null);
      return {
        originMissingBefore,
        originMissingAfter: !current.elements.some(
          (entry) => entry.id === operation.ref && !entry.deleted,
        ),
        refPresent: Boolean(ref),
        refTarget: ref?.ref ?? null,
        parentIsPageBody: ref?.parent_id === body.id,
      };
    }, scenario.operations[0]);
    if (
      !observed.originMissingBefore ||
      !observed.originMissingAfter ||
      !observed.refPresent ||
      !observed.parentIsPageBody ||
      observed.refTarget !== "component-modal"
    )
      throw new Error("Old Modal missing-origin condition did not reproduce");
    await page.waitForTimeout(700);
    const screenshot = "modal-missing-origin.png";
    const png = await page.screenshot({
      path: resolve(out, screenshot),
      animations: "disabled",
      clip: captureClip,
    });
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
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      let nonWhite = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] < 254 || pixels[i + 1] < 254 || pixels[i + 2] < 254)
          nonWhite += 1;
      }
      return { width: image.width, height: image.height, nonWhite };
    }, png.toString("base64"));
    const report = {
      head,
      buildIndexSha256: buildHash,
      scenario,
      scenarioHash,
      captureClip,
      screenshot,
      pngSha256: createHash("sha256").update(png).digest("hex"),
      pixelEvidence,
      observed,
      fontState: await page.evaluate(() => ({
        bodyFamily: getComputedStyle(document.body).fontFamily,
        loadStatus: document.fonts.status,
      })),
      errors,
    };
    writeFileSync(
      resolve(out, "baseline.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    if (errors.length || pixelEvidence.nonWhite !== 0)
      throw new Error("Old Modal missing-origin screenshot is not blank");
    process.stdout.write(
      `${out}/baseline.json: missing origin and blank Canvas\n`,
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
