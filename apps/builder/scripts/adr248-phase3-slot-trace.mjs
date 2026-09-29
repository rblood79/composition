#!/usr/bin/env node
// ADR-248 Phase 3: inspect the old public insert -> store -> scene -> layout Slot path.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
  waitReady,
} from "./perf-baseline.mjs";

const root = resolve(import.meta.dirname, "../../..");
const baseline = JSON.parse(
  readFileSync(
    resolve(root, "docs/adr/design/248-baseline/baseline.json"),
    "utf8",
  ),
);
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const { context, page, errors } = await createInstrumentedContext(browser, {
    storageState: loadStorageState(
      resolve(root, "apps/builder/scripts/.auth-session.json"),
      baseUrl,
    ),
    frameCapture: false,
    deviceScaleFactor: baseline.scenario.dpr,
  });
  try {
    await createIsolatedProject(page, baseUrl);
    await page.setViewportSize(baseline.scenario.viewport);
    const servedIndexSha256 = createHash("sha256")
      .update(await (await page.request.get(baseUrl)).body())
      .digest("hex");
    const builderDistIndexSha256 = createHash("sha256")
      .update(readFileSync(resolve(root, "apps/builder/dist/index.html")))
      .digest("hex");
    const authored = await page.evaluate(async (operations) => {
      const state = window.__composition_STORE__.getState();
      const pageId = state.currentPageId;
      const body = state.elements.find(
        (element) => element.page_id === pageId && element.type === "body",
      );
      if (!body) throw new Error("G0_PAGE_BODY_REQUIRED");
      const now = new Date().toISOString();
      const idFor = (id) => (id === "page" ? body.id : `adr248-${id}`);
      const nodes = operations.map((operation, index) => ({
        id: idFor(operation.id),
        customId: operation.id,
        type: operation.component,
        parent_id: idFor(operation.parent),
        page_id: pageId,
        order_num: index,
        created_at: now,
        updated_at: now,
        props: {
          ...(operation.orientation
            ? { orientation: operation.orientation }
            : {}),
          ...(operation.size ? { size: operation.size } : {}),
          ...(operation.description
            ? { description: operation.description }
            : {}),
          ...(operation.text ? { children: operation.text } : {}),
          style: {
            position: "absolute",
            left: `${operation.x}px`,
            top: `${operation.y}px`,
            width: `${operation.width}px`,
            height: `${operation.height}px`,
            ...(operation.fill ? { backgroundColor: operation.fill } : {}),
            ...(operation.border
              ? { border: `2px solid ${operation.border}` }
              : {}),
          },
        },
      }));
      await state.addComplexElement(nodes[0], nodes.slice(1));
      return {
        pageId,
        bodyId: body.id,
        slotId: idFor("slot"),
        frameId: idFor("frame"),
        textId: idFor("text"),
      };
    }, baseline.scenario.operations);
    await page.evaluate(() =>
      window.__composition_APPLY_VIEWPORT__?.({ scale: 0.8, x: 100, y: 100 }),
    );
    await page.waitForTimeout(800);
    const capture = () =>
      page.evaluate(({ pageId, bodyId, slotId, frameId, textId }) => {
        const state = window.__composition_STORE__.getState();
        const projectId = location.pathname.split("/").pop();
        const canonical = window.__canonical_STORE__
          ?.getState()
          ?.getDocument?.(projectId);
        const find = (value, id) => {
          if (!value || typeof value !== "object") return null;
          if (value.id === id && typeof value.type === "string") return value;
          for (const child of Object.values(value)) {
            const found = find(child, id);
            if (found) return found;
          }
          return null;
        };
        const slot = state.elements.find((element) => element.id === slotId);
        const layout =
          window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.();
        const scene = window.__composition_SCENE_DEBUG__;
        const skia = window.__composition_SKIA_DEBUG__;
        const command = window.__composition_RENDER_COMMAND_DEBUG__;
        return {
          pageId,
          slotId,
          selectedElementIds: state.selectedElementIds ?? null,
          selectedElementId: state.selectedElementId ?? null,
          borderCss: getComputedStyle(document.documentElement)
            .getPropertyValue("--border")
            .trim(),
          state: slot
            ? {
                type: slot.type,
                parent_id: slot.parent_id,
                page_id: slot.page_id,
                props: slot.props,
              }
            : null,
          canonical: find(canonical, slotId),
          canonicalHasProps: Object.hasOwn(
            find(canonical, slotId) ?? {},
            "props",
          ),
          sceneDebugAvailable: typeof scene?.readNode === "function",
          sceneSlot: scene?.readNode?.(slotId) ?? null,
          sceneFrame: scene?.readNode?.(frameId) ?? null,
          pageFrames: scene?.readPageFrames?.() ?? null,
          bodyLayout: layout?.get(bodyId) ?? null,
          bodySkia: skia?.getSkiaNode?.(bodyId)
            ? {
                type: skia.getSkiaNode(bodyId).type,
                width: skia.getSkiaNode(bodyId).width,
                height: skia.getSkiaNode(bodyId).height,
              }
            : null,
          slotLayout: layout?.get(slotId) ?? null,
          frameLayout: layout?.get(frameId) ?? null,
          frameSkia: skia?.getSkiaNode?.(frameId)
            ? {
                type: skia.getSkiaNode(frameId).type,
                box: skia.getSkiaNode(frameId).box,
              }
            : null,
          skiaSlot: skia?.getSkiaNode?.(slotId)
            ? {
                type: skia.getSkiaNode(slotId).type,
                visible: skia.getSkiaNode(slotId).visible,
                width: skia.getSkiaNode(slotId).width,
                height: skia.getSkiaNode(slotId).height,
              }
            : null,
          textSkia: skia?.getSkiaNode?.(textId)
            ? {
                type: skia.getSkiaNode(textId).type,
                width: skia.getSkiaNode(textId).width,
                height: skia.getSkiaNode(textId).height,
                text: skia.getSkiaNode(textId).text,
              }
            : null,
          commandSlot: command?.readNode?.(slotId) ?? null,
        };
      }, authored);
    const before = await capture();
    const beforeResourceUrls = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => entry.name),
    );
    await page.reload({ waitUntil: "networkidle" });
    await waitReady(page);
    await page.waitForTimeout(500);
    const afterRefresh = await capture();
    const executionResourceUrls = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((url) =>
          /(?:main\.tsx|renderCommands\.ts|engine_bg\.wasm|canvaskit\.wasm|PretendardVariable\.ttf)(?:\?|$)/.test(
            url,
          ),
        ),
    );
    const executionResources = [];
    for (const url of [
      ...new Set([...beforeResourceUrls, ...executionResourceUrls]),
    ]) {
      if (
        !/(?:main\.tsx|renderCommands\.ts|engine_bg\.wasm|canvaskit\.wasm|PretendardVariable\.ttf)(?:\?|$)/.test(
          url,
        )
      )
        continue;
      const response = await page.request.get(url);
      if (!response.ok()) continue;
      const bytes = await response.body();
      executionResources.push({
        url: new URL(url).pathname,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
    const result = {
      head: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim(),
      scenarioId: baseline.scenario.id,
      scenarioHash: baseline.scenarioHash,
      servedIndexSha256,
      builderDistIndexSha256,
      executionResources,
      viewport: baseline.scenario.viewport,
      dpr: baseline.scenario.dpr,
      theme: baseline.scenario.theme,
      font: baseline.scenario.font,
      seed: baseline.scenario.seed,
      before,
      afterRefresh,
      browserErrors: errors,
    };
    writeFileSync(
      resolve(root, "docs/adr/design/248-phase3-slot-old-trace.json"),
      JSON.stringify(result, null, 2),
    );
    console.log(
      JSON.stringify({
        before: {
          state: !!before.state,
          canonical: !!before.canonical,
          scene: !!before.sceneSlot,
          layout: !!before.slotLayout,
          skia: !!before.skiaSlot,
          command: before.commandSlot,
        },
        after: {
          state: !!afterRefresh.state,
          canonical: !!afterRefresh.canonical,
          scene: !!afterRefresh.sceneSlot,
          layout: !!afterRefresh.slotLayout,
          skia: !!afterRefresh.skiaSlot,
          command: afterRefresh.commandSlot,
        },
        errors: errors.length,
      }),
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
