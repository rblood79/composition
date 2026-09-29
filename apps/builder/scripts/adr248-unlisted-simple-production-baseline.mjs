#!/usr/bin/env node
// ADR-248 G0: old production Canvas baseline for non-palette simple types via
// the existing Zustand addElement command. These are explicitly authored
// values, not a claim that the palette/useElementCreator branch was exercised.
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
const readJson = (name) =>
  JSON.parse(readFileSync(resolve(baselineDir, name), "utf8"));
const uncovered = readJson("system-subpart-coverage.json")
  .rows.filter(
    (row) =>
      row.status === "ABSENT_FROM_SYSTEM_ORIGINS" &&
      row.oldCreationRoute === "simple",
  )
  .map((row) => row.type);
const expectedTypes = [
  "Code",
  "ColorArea",
  "ColorSlider",
  "ColorWheel",
  "Field",
  "FormField",
  "Kbd",
  "Paragraph",
  "TableCell",
  "TableRow",
  "TailSwatch",
];
if (JSON.stringify(uncovered) !== JSON.stringify(expectedTypes))
  throw new Error("Unlisted simple type inventory changed");
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
const typesIndex = process.argv.indexOf("--types");
if (typesIndex >= 0 && !process.argv[typesIndex + 1])
  throw new Error("--types requires comma-separated type names");
const types =
  typesIndex >= 0 ? process.argv[typesIndex + 1].split(",") : uncovered;
if (
  new Set(types).size !== types.length ||
  types.some((type) => !uncovered.includes(type))
)
  throw new Error("Requested type differs from the frozen simple inventory");
const baseUrl = process.env.BUILDER_URL;
if (!baseUrl || !baseUrl.endsWith("/composition"))
  throw new Error(
    "BUILDER_URL must be the frozen /composition production base",
  );
const authoredPropsByType = {
  Code: { children: "ADR-248 Code" },
  ColorArea: {},
  ColorSlider: {},
  ColorWheel: {},
  Field: { key: "field", label: "Field", type: "string" },
  FormField: {},
  Kbd: { children: "ADR-248 Kbd" },
  Paragraph: { children: "ADR-248 Paragraph" },
  TableCell: { children: "ADR-248 Cell" },
  TableRow: { children: "ADR-248 Row" },
  TailSwatch: { value: "#3b82f6", colorSpace: "hsb", isDisabled: false },
};
const style = {
  position: "absolute",
  left: "30px",
  top: "30px",
  width: "220px",
  height: "130px",
};
const scenario = {
  id: "adr248-old-unlisted-simple-command-production-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: types.map((type) => ({
    op: "addElement",
    type,
    parent: "page-body",
    props: { ...authoredPropsByType[type], style },
    then: "removeElement",
  })),
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
    const rows = [];
    for (const operation of scenario.operations) {
      const observed = await page.evaluate(async ({ type, props }) => {
        const state = window.__composition_STORE__.getState();
        state.setSelectedElement(null);
        const beforeIds = state.elements.map((entry) => entry.id);
        const body = state.elements.find(
          (entry) =>
            entry.type === "body" && entry.page_id === state.currentPageId,
        );
        if (!body) throw new Error("Current page body missing");
        const id = `adr248-${type.toLowerCase()}`;
        await state.addElement({
          id,
          type,
          props,
          page_id: state.currentPageId,
          parent_id: body.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        const current = window.__composition_STORE__.getState();
        const element = current.elements.find((entry) => entry.id === id);
        return {
          id,
          added: Boolean(element),
          parentIsPageBody: element?.parent_id === body.id,
          pageIsCurrent: element?.page_id === current.currentPageId,
          propsEqual: JSON.stringify(element?.props) === JSON.stringify(props),
          addedNodeTypes: current.elements
            .filter((entry) => !beforeIds.includes(entry.id) && !entry.deleted)
            .map((entry) => entry.type),
        };
      }, operation);
      if (!observed.added) {
        rows.push({
          type: operation.type,
          status: "REJECTED_BY_OLD_STORE",
          observed,
        });
        process.stdout.write(`${operation.type}: rejected\n`);
        continue;
      }
      if (
        !observed.parentIsPageBody ||
        !observed.pageIsCurrent ||
        !observed.propsEqual
      )
        throw new Error(`${operation.type}: authored command result differs`);
      await page.waitForTimeout(700);
      const screenshot = `canvas/${operation.type}.png`;
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
        return {
          width: image.width,
          height: image.height,
          nonWhite,
          threshold: "any RGB channel < 254",
        };
      }, png.toString("base64"));
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
      if (remains)
        throw new Error(`${operation.type}: remove did not complete`);
      rows.push({
        type: operation.type,
        status: "CAPTURED",
        observed,
        screenshot,
        pngSha256: createHash("sha256").update(png).digest("hex"),
        pixelEvidence,
      });
      process.stdout.write(
        `${operation.type}: ${pixelEvidence.nonWhite} nonwhite pixels\n`,
      );
    }
    const report = {
      head,
      buildIndexSha256: buildHash,
      scenario,
      scenarioHash,
      captureClip,
      zoomLabel: await page.locator(".zoom-input").inputValue(),
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
    if (rows.length !== types.length || errors.length)
      throw new Error("Unlisted simple command baseline is incomplete");
    process.stdout.write(`${out}/baseline.json: ${rows.length} commands\n`);
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
