#!/usr/bin/env node
// ADR-248 G0: capture system origin roots whose child types have no existing
// Canvas context. Authored refs use the old app's addElement command.
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
const subparts = JSON.parse(
  readFileSync(resolve(baselineDir, "system-subpart-coverage.json"), "utf8"),
);
const roots = new Map();
for (const row of subparts.rows) {
  if (
    !row.occurrences.length ||
    row.occurrences.some((item) => item.existingRootCanvasFixture)
  )
    continue;
  for (const occurrence of row.occurrences) {
    if (occurrence.rootId === "page-components-body") continue;
    roots.set(occurrence.rootId, occurrence.rootType);
  }
}
const expectedRootIds = [
  "component-colorswatch",
  "component-colorswatchpicker",
  "component-dialog",
  "component-gridlist-section",
  "component-listbox-section",
  "component-menu-section",
  "component-table-column",
  "component-table-row",
];
const rootIds = [...roots.keys()].sort();
if (JSON.stringify(rootIds) !== JSON.stringify(expectedRootIds))
  throw new Error("System origin root inventory changed");
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
const style = {
  position: "absolute",
  left: "30px",
  top: "30px",
  width: "220px",
  height: "130px",
};
const scenario = {
  id: "adr248-old-system-root-ref-production-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: [
    { op: "captureEmptyPageBody" },
    ...rootIds.map((rootId) => ({
      op: "addElement",
      type: "ref",
      ref: rootId,
      componentName: roots.get(rootId),
      parent: "page-body",
      props: { style },
      then: "removeElement",
    })),
  ],
};
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
    await page
      .locator(
        '.panel-toggle-rail button[aria-pressed="true"][aria-label="components" i]',
      )
      .click();
    const capture = async (fileName) => {
      await page.waitForTimeout(700);
      const screenshot = `canvas/${fileName}.png`;
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
        return { width: image.width, height: image.height, nonWhite };
      }, png.toString("base64"));
      return {
        screenshot,
        pngSha256: createHash("sha256").update(png).digest("hex"),
        pixelEvidence,
      };
    };
    const body = await page.evaluate(() => {
      const state = window.__composition_STORE__.getState();
      const node = state.elements.find(
        (entry) =>
          entry.type === "body" && entry.page_id === state.currentPageId,
      );
      return { exists: Boolean(node), type: node?.type ?? null };
    });
    if (!body.exists) throw new Error("Current page body missing");
    const bodyCapture = await capture("body");
    const rows = [];
    for (const operation of scenario.operations.slice(1)) {
      const observed = await page.evaluate(async (operation) => {
        const store = window.__composition_STORE__.getState();
        const body = store.elements.find(
          (entry) =>
            entry.type === "body" && entry.page_id === store.currentPageId,
        );
        const origin = store.elements.find(
          (entry) => entry.id === operation.ref,
        );
        if (!body || !origin) throw new Error("Root or page body missing");
        const id = `adr248-system-ref-${operation.ref}`;
        const now = new Date().toISOString();
        await store.addElement({
          id,
          type: "ref",
          ref: operation.ref,
          componentName: operation.componentName,
          props: operation.props,
          page_id: store.currentPageId,
          parent_id: body.id,
          created_at: now,
          updated_at: now,
        });
        const current = window.__composition_STORE__.getState();
        const node = current.elements.find((entry) => entry.id === id);
        current.setSelectedElement(null);
        return {
          id,
          originType: origin.type,
          originPageId: origin.page_id,
          refPresent: Boolean(node),
          refTarget: node?.ref ?? null,
          parentIsPageBody: node?.parent_id === body.id,
        };
      }, operation);
      if (!observed.refPresent) {
        rows.push({
          rootId: operation.ref,
          type: operation.componentName,
          status: "REJECTED_BY_OLD_STORE",
          observed,
        });
        process.stdout.write(
          `${operation.ref}: rejected by page-body nesting\n`,
        );
        continue;
      }
      if (
        observed.refTarget !== operation.ref ||
        observed.originType !== operation.componentName ||
        observed.originPageId !== "page-components" ||
        !observed.parentIsPageBody
      )
        throw new Error(
          `${operation.ref}: ref command relation differs ${JSON.stringify(observed)}`,
        );
      const captured = await capture(operation.ref);
      await page.evaluate(async (id) => {
        await window.__composition_STORE__.getState().removeElement(id);
      }, observed.id);
      const remains = await page.evaluate(
        (id) =>
          window.__composition_STORE__
            .getState()
            .elements.some((entry) => entry.id === id && !entry.deleted),
        observed.id,
      );
      if (remains) throw new Error(`${operation.ref}: remove did not complete`);
      rows.push({
        rootId: operation.ref,
        type: operation.componentName,
        status: "CAPTURED",
        observed,
        ...captured,
      });
      process.stdout.write(
        `${operation.ref}: ${captured.pixelEvidence.nonWhite} nonwhite pixels\n`,
      );
    }
    const report = {
      head,
      buildIndexSha256: buildHash,
      scenario,
      scenarioHash,
      captureClip,
      body: { ...body, ...bodyCapture },
      rows,
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
    if (rows.length !== expectedRootIds.length || errors.length)
      throw new Error("System root ref baseline is incomplete");
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
