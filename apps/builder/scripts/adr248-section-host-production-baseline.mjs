#!/usr/bin/env node
// ADR-248 G0: capture old Canvas section origins inside their collection hosts.
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
const cases = [
  {
    host: "ListBox",
    section: "ListBoxSection",
    origin: "component-listbox-section",
  },
  { host: "Menu", section: "MenuSection", origin: "component-menu-section" },
  {
    host: "GridList",
    section: "GridListSection",
    origin: "component-gridlist-section",
  },
];
const hostStyle = {
  position: "absolute",
  left: "30px",
  top: "30px",
  width: "220px",
  height: "130px",
};
const scenario = {
  id: "adr248-old-section-host-production-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: cases.map((item) => ({
    op: "addHostThenSectionRef",
    hostType: item.host,
    hostProps: { style: hostStyle },
    sectionType: item.section,
    sectionRef: item.origin,
    hostParent: "page-body",
    then: "removeHost",
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
      const observed = await page.evaluate(async (operation) => {
        const store = window.__composition_STORE__.getState();
        store.setSelectedElement(null);
        const body = store.elements.find(
          (entry) =>
            entry.type === "body" && entry.page_id === store.currentPageId,
        );
        const origin = store.elements.find(
          (entry) => entry.id === operation.sectionRef,
        );
        if (!body || !origin) throw new Error("Body or section origin missing");
        const hostId = `adr248-host-${operation.hostType}`;
        const sectionId = `adr248-section-${operation.sectionType}`;
        const now = new Date().toISOString();
        await store.addElement({
          id: hostId,
          type: operation.hostType,
          props: operation.hostProps,
          page_id: store.currentPageId,
          parent_id: body.id,
          created_at: now,
          updated_at: now,
        });
        await window.__composition_STORE__.getState().addElement({
          id: sectionId,
          type: "ref",
          ref: operation.sectionRef,
          componentName: operation.sectionType,
          props: {},
          page_id: store.currentPageId,
          parent_id: hostId,
          created_at: now,
          updated_at: now,
        });
        const current = window.__composition_STORE__.getState();
        const host = current.elements.find((entry) => entry.id === hostId);
        const section = current.elements.find(
          (entry) => entry.id === sectionId,
        );
        current.setSelectedElement(null);
        return {
          hostId,
          sectionId,
          originType: origin.type,
          hostType: host?.type ?? null,
          hostParentIsPageBody: host?.parent_id === body.id,
          sectionType: section?.componentName ?? null,
          sectionParentIsHost: section?.parent_id === hostId,
          sectionRef: section?.ref ?? null,
          samePage:
            host?.page_id === current.currentPageId &&
            section?.page_id === current.currentPageId,
        };
      }, operation);
      if (
        observed.originType !== operation.sectionType ||
        observed.hostType !== operation.hostType ||
        observed.sectionType !== operation.sectionType ||
        observed.sectionRef !== operation.sectionRef ||
        !observed.hostParentIsPageBody ||
        !observed.sectionParentIsHost ||
        !observed.samePage
      )
        throw new Error(
          `${operation.sectionType}: host command relation differs`,
        );
      await page.waitForTimeout(700);
      const screenshot = `canvas/${operation.sectionType}.png`;
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
      await page.evaluate(async (id) => {
        await window.__composition_STORE__.getState().removeElement(id);
      }, observed.hostId);
      const active = await page.evaluate(
        (ids) =>
          window.__composition_STORE__
            .getState()
            .elements.filter(
              (entry) => ids.includes(entry.id) && !entry.deleted,
            )
            .map((entry) => entry.id),
        [observed.hostId, observed.sectionId],
      );
      if (active.length)
        throw new Error(
          `${operation.sectionType}: removal left ${active.join(",")}`,
        );
      rows.push({
        hostType: operation.hostType,
        sectionType: operation.sectionType,
        status: "CAPTURED",
        observed,
        screenshot,
        pngSha256: createHash("sha256").update(png).digest("hex"),
        pixelEvidence,
      });
      process.stdout.write(
        `${operation.sectionType}: ${pixelEvidence.nonWhite} nonwhite pixels\n`,
      );
    }
    const report = {
      head,
      buildIndexSha256: buildHash,
      scenario,
      scenarioHash,
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
    if (rows.length !== cases.length || errors.length)
      throw new Error("Collection section host baseline is incomplete");
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
