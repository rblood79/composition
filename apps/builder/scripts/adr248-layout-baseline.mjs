#!/usr/bin/env node
// ADR-248 G0: old Builder's reusable layout Slot baseline. Canvas only.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
  openPanels,
} from "./perf-baseline.mjs";

const root = resolve(import.meta.dirname, "../../..");
const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0 && !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(
  outIndex >= 0
    ? process.argv[outIndex + 1]
    : "/private/tmp/adr248-layout-baseline.json",
);
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5173";
const scenario = {
  id: "adr248-layout-slot-empty-filled-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: [
    { op: "createLayout", semanticId: "layout" },
    { op: "applyPreset", target: "layout", preset: "2-Row" },
    { op: "inspectSlots", target: "layout", expectedCount: 2 },
    {
      op: "setSlotDescription",
      target: "layout.content",
      value: "첫째 줄\n둘째 줄",
    },
    { op: "inspectSlotDescription", target: "layout.content" },
    { op: "applyLayout", target: "page", layout: "layout" },
    {
      op: "insert",
      id: "content",
      component: "Text",
      parent: "page",
      slot: "content",
      text: "채운 내용",
    },
    { op: "inspectFill", slot: "content", child: "content" },
  ],
};
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sourcePaths = execFileSync(
  "git",
  ["ls-files", "-z", "apps/builder/src", "packages/shared/src", "packages/specs/src", "packages/engine/src"],
  { cwd: root },
).toString().split("\0").filter(Boolean);
const sourceDigest = createHash("sha256");
for (const path of sourcePaths) {
  sourceDigest.update(path).update("\0").update(readFileSync(resolve(root, path))).update("\0");
}
const scenarioHash = createHash("sha256")
  .update(JSON.stringify(scenario))
  .digest("hex");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const { context, page, errors } = await createInstrumentedContext(browser, {
    storageState: loadStorageState(
      resolve(root, "apps/builder/scripts/.auth-session.json"),
      baseUrl,
    ),
    frameCapture: false,
  });
  await createIsolatedProject(page, baseUrl);
  const servedIndexSha256 = sha256(await (await page.request.get(baseUrl)).body());
  await openPanels(page, ["navigator", "properties"]);
  await page.locator(".navigator-panel-tab", { hasText: /^Layouts$/ }).click();
  await page.locator('button[aria-label="Add Layout"]').click();
  await page
    .locator(
      '.section[data-section-id="navigator-layouts"] .elementItemLabel',
      { hasText: /^Layout 1$/ },
    )
    .click();
  const preset = page.locator('[data-panel-id="properties"] .section', {
    hasText: "Layout Preset",
  });
  await preset.first().waitFor();
  await preset
    .locator(".preset-card", {
      has: page.locator(".list-item-name", { hasText: /^2-Row$/ }),
    })
    .first()
    .click();
  await page.waitForTimeout(1_200);
  const slots = await page.evaluate(() => {
    const store = window.__composition_STORE__.getState();
    const map = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.();
    return store.elements
      .filter((element) => element.type === "Slot")
      .map((element) => ({
        id: element.id,
        name: element.props?.name ?? null,
        required: element.props?.required ?? null,
        description: element.props?.description ?? null,
        parentId: element.parent_id,
        layout: map?.get(element.id) ?? null,
      }));
  });
  if (slots.length !== 2 || slots.some((slot) => !slot.layout)) {
    throw new Error(`2-Row Slot baseline invalid: ${JSON.stringify(slots)}`);
  }
  await page.evaluate(() =>
    window.__composition_APPLY_VIEWPORT__?.({ scale: 0.5, x: 300, y: 120 }),
  );
  await page.waitForTimeout(600);
  const viewportState = await page.evaluate(
    () => window.__composition_VIEWPORT__?.() ?? null,
  );
  const fontState = await page.evaluate(() => ({
    bodyFamily: getComputedStyle(document.body).fontFamily,
    loadStatus: document.fonts.status,
  }));
  const defaultPng = await page.screenshot({
    path: out.replace(/\.json$/, ".png"),
    animations: "disabled",
    clip: { x: 300, y: 120, width: 850, height: 540 },
  });
  const semanticSlots = slots.map((slot) => ({
    name: slot.name,
    required: slot.required,
    description: slot.description,
    geometry: {
      x: slot.layout.x,
      y: slot.layout.y,
      width: slot.layout.width,
      height: slot.layout.height,
    },
  }));
  const contentSlot = slots.find((slot) => slot.name === "content");
  if (!contentSlot) throw new Error("Content Slot missing");
  await page.evaluate((slotId) => {
    window.__composition_STORE__.getState().updateElementProps(slotId, {
      description: "첫째 줄\n둘째 줄",
    });
  }, contentSlot.id);
  await page.waitForTimeout(600);
  const describedSlot = await page.evaluate((slotId) => {
    const state = window.__composition_STORE__.getState();
    const slot = state.elements.find((element) => element.id === slotId);
    const layout = window.__composition_LAYOUT_DEBUG__
      ?.getSharedLayoutMap?.()
      ?.get(slotId);
    return {
      description: slot?.props?.description ?? null,
      layout: layout ?? null,
    };
  }, contentSlot.id);
  if (
    describedSlot.description !== "첫째 줄\n둘째 줄" ||
    !describedSlot.layout
  ) {
    throw new Error(
      `Slot description baseline invalid: ${JSON.stringify(describedSlot)}`,
    );
  }
  const descriptionPng = await page.screenshot({
    path: out.replace(/\.json$/, "-description.png"),
    animations: "disabled",
    clip: { x: 300, y: 120, width: 850, height: 540 },
  });
  await page.locator(".navigator-panel-tab", { hasText: /^Pages$/ }).click();
  const pageInfo = await page.evaluate(() => {
    const state = window.__composition_STORE__.getState();
    const pageId = state.currentPageId;
    const body = state.elements.find(
      (element) => element.page_id === pageId && element.type === "body",
    );
    if (!body) throw new Error("Page body missing");
    state.setSelectedElement(body.id);
    return { pageId, bodyId: body.id };
  });
  const applyLayout = page
    .locator('[data-panel-id="properties"] button[aria-label="Apply Layout"]')
    .first();
  await applyLayout.waitFor();
  await applyLayout.click();
  await page.locator('[role="option"]', { hasText: /^Layout 1$/ }).click();
  await page.evaluate(async ({ pageId, bodyId }) => {
    const state = window.__composition_STORE__.getState();
    const now = new Date().toISOString();
    await state.addComplexElement(
      {
        id: "adr248-filled-text",
        customId: "content",
        type: "Text",
        parent_id: bodyId,
        page_id: pageId,
        created_at: now,
        updated_at: now,
        props: {
          children: "채운 내용",
          style: { width: "200px", height: "40px" },
        },
      },
      [],
    );
    const projectId = location.pathname.split("/").pop();
    const authored = window.__canonical_STORE__
      ?.getState()
      ?.getDocument?.(projectId);
    if (!authored || !JSON.stringify(authored).includes("adr248-filled-text")) {
      throw new Error("Filled content missing from authored document");
    }
  }, pageInfo);
  await page.evaluate(() =>
    window.__composition_APPLY_VIEWPORT__?.({ scale: 0.5, x: 300, y: 120 }),
  );
  await page.waitForTimeout(1_000);
  const filledGeometry = await page.evaluate(
    () =>
      window.__composition_LAYOUT_DEBUG__
        ?.getSharedLayoutMap?.()
        ?.get("adr248-filled-text") ?? null,
  );
  if (!filledGeometry)
    throw new Error("Filled content missing from Canvas layout");
  const filledPng = await page.screenshot({
    path: out.replace(/\.json$/, "-filled.png"),
    animations: "disabled",
    clip: { x: 300, y: 120, width: 850, height: 540 },
  });
  const report = {
    head,
    executionBuildIdentity: `dev-source:${sourceDigest.digest("hex")}:index:${servedIndexSha256}`,
    buildIndexSha256: sha256(readFileSync(resolve(root, "apps/builder/dist/index.html"))),
    scenarioHash,
    scenario,
    runtimeEnvironment: await page.evaluate(async () => ({
      viewport: { width: innerWidth, height: innerHeight },
      dpr: devicePixelRatio,
      theme: document.documentElement.dataset.theme ?? "default-light",
      font: getComputedStyle(document.body).fontFamily,
      fontLoadStatus: await document.fonts.ready.then(() => document.fonts.status),
    })),
    screenshots: {
      default: sha256(defaultPng),
      description: sha256(descriptionPng),
      filled: sha256(filledPng),
    },
    viewportState,
    fontState,
    slots: semanticSlots,
    describedSlot: {
      description: describedSlot.description,
      geometry: {
        x: describedSlot.layout.x,
        y: describedSlot.layout.y,
        width: describedSlot.layout.width,
        height: describedSlot.layout.height,
      },
    },
    filled: {
      slot: "content",
      child: "content",
      geometry: {
        x: filledGeometry.x,
        y: filledGeometry.y,
        width: filledGeometry.width,
        height: filledGeometry.height,
      },
    },
    errors,
  };
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  await context.close();
  if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
  process.stdout.write(`${out}: ${slots.length} Slot layouts, 0 errors\n`);
} finally {
  await browser.close();
}
