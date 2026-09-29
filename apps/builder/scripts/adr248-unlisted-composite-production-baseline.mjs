#!/usr/bin/env node
// ADR-248 G0: old production Canvas baseline for two registered composite
// types absent from the palette and system origins. Uses existing addElement
// commands with explicit parent/child props; does not claim factory execution.
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
const parentStyle = {
  position: "absolute",
  left: "30px",
  top: "30px",
  width: "220px",
  height: "230px",
};
const cases = [
  {
    type: "ColorPicker",
    parentProps: {
      style: {
        ...parentStyle,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      },
    },
    children: [
      {
        id: "area",
        type: "ColorArea",
        props: { style: { width: "100%", height: "180px" } },
      },
      {
        id: "slider",
        type: "ColorSlider",
        props: {
          channel: "hue",
          style: { display: "block", width: "100%" },
        },
      },
      {
        id: "field",
        type: "ColorField",
        props: { placeholder: "#000000", style: { display: "block" } },
      },
    ],
  },
  {
    type: "Toast",
    parentProps: {
      style: {
        ...parentStyle,
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "12px 16px",
      },
    },
    children: [
      {
        id: "heading",
        type: "Heading",
        props: {
          children: "Toast Title",
          level: 3,
          size: "sm",
          style: { display: "block", fontWeight: "600" },
        },
      },
      {
        id: "description",
        type: "Description",
        props: {
          children: "Toast message content.",
          size: "lg",
          style: { display: "block" },
        },
      },
    ],
  },
];
const scenario = {
  id: "adr248-old-unlisted-composite-command-production-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: cases.map((item) => ({
    op: "addParentAndChildren",
    parent: "page-body",
    type: item.type,
    parentProps: item.parentProps,
    children: item.children,
    then: "removeParent",
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
    for (const item of cases) {
      const observed = await page.evaluate(async (item) => {
        const store = window.__composition_STORE__.getState();
        store.setSelectedElement(null);
        const body = store.elements.find(
          (entry) =>
            entry.type === "body" && entry.page_id === store.currentPageId,
        );
        if (!body) throw new Error("Current page body missing");
        const pageId = store.currentPageId;
        const rootId = `adr248-${item.type.toLowerCase()}`;
        const now = new Date().toISOString();
        await store.addElement({
          id: rootId,
          type: item.type,
          props: item.parentProps,
          page_id: pageId,
          parent_id: body.id,
          created_at: now,
          updated_at: now,
        });
        for (const child of item.children) {
          await window.__composition_STORE__.getState().addElement({
            id: `${rootId}-${child.id}`,
            type: child.type,
            props: child.props,
            page_id: pageId,
            parent_id: rootId,
            created_at: now,
            updated_at: now,
          });
        }
        const current = window.__composition_STORE__.getState();
        const ids = [
          rootId,
          ...item.children.map((child) => `${rootId}-${child.id}`),
        ];
        return {
          rootId,
          ids,
          nodes: ids.map((id) => {
            const entry = current.elements.find((node) => node.id === id);
            return {
              id,
              type: entry?.type ?? null,
              parentId: entry?.parent_id ?? null,
              pageIsCurrent: entry?.page_id === current.currentPageId,
            };
          }),
          bodyId: body.id,
        };
      }, item);
      if (
        observed.nodes.some(
          (node, index) =>
            node.type !== (index ? item.children[index - 1].type : item.type) ||
            node.parentId !== (index ? observed.rootId : observed.bodyId) ||
            !node.pageIsCurrent,
        )
      )
        throw new Error(`${item.type}: parent/child command did not persist`);
      await page.waitForTimeout(700);
      const screenshot = `canvas/${item.type}.png`;
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
      await page.evaluate(async (rootId) => {
        await window.__composition_STORE__.getState().removeElement(rootId);
      }, observed.rootId);
      const active = await page.evaluate(
        (ids) =>
          window.__composition_STORE__
            .getState()
            .elements.filter(
              (entry) => ids.includes(entry.id) && !entry.deleted,
            )
            .map((entry) => entry.id),
        observed.ids,
      );
      if (active.length)
        throw new Error(`${item.type}: removal left nodes ${active.join(",")}`);
      rows.push({
        type: item.type,
        status: "CAPTURED",
        observed,
        screenshot,
        pngSha256: createHash("sha256").update(png).digest("hex"),
        pixelEvidence,
      });
      process.stdout.write(
        `${item.type}: ${pixelEvidence.nonWhite} nonwhite pixels\n`,
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
    if (rows.length !== cases.length || errors.length)
      throw new Error("Unlisted composite command baseline is incomplete");
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
