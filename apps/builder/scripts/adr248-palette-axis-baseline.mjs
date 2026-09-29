#!/usr/bin/env node
// ADR-248 G0: capture old production palette-authored base-relative variant
// and size axes. Each case starts from the same authored props snapshot.
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
const read = (path) =>
  JSON.parse(readFileSync(resolve(baselineDir, path), "utf8"));
const coverage = read("coverage-manifest.json");
const creation = read("creation-route-audit.json");
const productionBase = read("palette-production-base/baseline.json");
const readme = readFileSync(resolve(baselineDir, "README.md"), "utf8");
const expectedBuildHash =
  /production `dist\/index\.html` SHA-256: `([a-f0-9]{64})`/.exec(readme)?.[1];
const buildHash = createHash("sha256")
  .update(readFileSync(resolve(root, "apps/builder/dist/index.html")))
  .digest("hex");
if (
  !expectedBuildHash ||
  buildHash !== expectedBuildHash ||
  productionBase.buildIndexSha256 !== buildHash
)
  throw new Error("Frozen production build hash changed");
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(process.argv[outIndex + 1]);
const typesIndex = process.argv.indexOf("--types");
if (typesIndex >= 0 && !process.argv[typesIndex + 1])
  throw new Error("--types requires comma-separated palette types");
const paletteTypes = creation.paletteTypes.filter((type) => type !== "Slot");
const types =
  typesIndex >= 0
    ? process.argv[typesIndex + 1].split(",").filter(Boolean)
    : paletteTypes;
if (
  new Set(types).size !== types.length ||
  types.some((type) => !paletteTypes.includes(type))
)
  throw new Error("Requested type differs from frozen Page palette universe");
const baseUrl = process.env.BUILDER_URL;
if (!baseUrl || !baseUrl.endsWith("/composition"))
  throw new Error(
    "BUILDER_URL must be the frozen /composition production base",
  );
const typeAxes = new Map(
  coverage.types.map((entry) => [entry.type, entry.requiredAxes]),
);
const caseSpecs = types.map((type) => ({
  type,
  axes: typeAxes
    .get(type)
    .filter((axis) => axis.startsWith("variant:") || axis.startsWith("size:"))
    .map((axis) => {
      const [kind, value] = axis.split(":");
      return { axis, prop: kind, value };
    }),
}));
const scenario = {
  id: "adr248-old-palette-variant-size-production-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: caseSpecs.map(({ type, axes }) => ({
    op: "paletteInsertAndEditAxes",
    component: type,
    parent: "page",
    style: { x: 30, y: 30, width: 220, height: 130 },
    axes,
    then: "remove",
  })),
};
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== coverage.source.baselineHead)
  throw new Error("Production palette axis HEAD changed");
const scenarioHash = createHash("sha256")
  .update(JSON.stringify(scenario))
  .digest("hex");
const captureClip = productionBase.captureClip;
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
      const before = await page.evaluate(() => {
        const state = window.__composition_STORE__.getState();
        state.setSelectedElement(null);
        return state.elements.map((element) => element.id);
      });
      await search.fill(operation.component);
      const item = page
        .locator('[data-panel-id="components"] .list-item')
        .first();
      await item.waitFor({ state: "visible", timeout: 8_000 });
      await item.click();
      const id = await page
        .waitForFunction(
          ({ type, oldIds }) =>
            window.__composition_STORE__
              .getState()
              .elements.find(
                (element) =>
                  !oldIds.includes(element.id) &&
                  !element.deleted &&
                  (element.type === type || element.componentName === type),
              )?.id ?? null,
          { type: operation.component, oldIds: before },
          { timeout: 15_000 },
        )
        .then((handle) => handle.jsonValue());
      const baseProps = await page.evaluate(
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
          const updated = window.__composition_STORE__
            .getState()
            .elements.find((entry) => entry.id === id);
          return JSON.parse(JSON.stringify(updated?.props ?? {}));
        },
        { id, style: operation.style },
      );
      await page
        .locator(
          '.panel-toggle-rail button[aria-pressed="true"][aria-label="components" i]',
        )
        .click();
      await page.waitForTimeout(250);
      const captures = [];
      for (const axis of operation.axes) {
        const observed = await page.evaluate(
          async ({ id, baseProps, axis }) => {
            const store = window.__composition_STORE__.getState();
            await store.updateElement(id, {
              props: { ...baseProps, [axis.prop]: axis.value },
            });
            store.setSelectedElement(null);
            const element = window.__composition_STORE__
              .getState()
              .elements.find((entry) => entry.id === id);
            const body = window.__composition_STORE__
              .getState()
              .elements.find(
                (entry) =>
                  entry.type === "body" &&
                  entry.page_id ===
                    window.__composition_STORE__.getState().currentPageId,
              );
            return {
              propValue: element?.props?.[axis.prop] ?? null,
              otherAxisValue:
                element?.props?.[
                  axis.prop === "variant" ? "size" : "variant"
                ] ?? null,
              parentIsPageBody: element?.parent_id === body?.id,
            };
          },
          { id, baseProps, axis },
        );
        if (
          observed.propValue !== axis.value ||
          !observed.parentIsPageBody ||
          observed.otherAxisValue !==
            (baseProps[axis.prop === "variant" ? "size" : "variant"] ?? null)
        )
          throw new Error(
            `${operation.component}/${axis.axis}: authored axis differs from scenario`,
          );
        await page.waitForTimeout(300);
        const screenshot = `canvas/${operation.component}-${axis.prop}-${axis.value}.png`;
        const png = await page.screenshot({
          path: resolve(out, screenshot),
          animations: "disabled",
          clip: captureClip,
        });
        captures.push({
          axis: axis.axis,
          screenshot,
          pngSha256: createHash("sha256").update(png).digest("hex"),
          observed,
        });
      }
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
        throw new Error(`${operation.component}: removal left active nodes`);
      await page
        .locator(
          '.panel-toggle-rail button[aria-pressed="false"][aria-label="components" i]',
        )
        .click();
      await search.fill("");
      rows.push({ type: operation.component, captures });
      process.stdout.write(`${operation.component}: ${captures.length} axes\n`);
    }
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
      rows,
      errors,
    };
    writeFileSync(
      resolve(out, "baseline.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
    process.stdout.write(
      `${out}/baseline.json: ${rows.reduce((sum, row) => sum + row.captures.length, 0)} axes captured\n`,
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
