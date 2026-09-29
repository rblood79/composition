#!/usr/bin/env node
// ADR-248 G0: freeze old Frame clip/overflow and Group orientation inputs.
// The shared scenario names semantic operations, not a document serialization.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
  waitReady,
} from "./perf-baseline.mjs";

const root = resolve(import.meta.dirname, "../../..");
const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0 && !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(
  outIndex >= 0
    ? process.argv[outIndex + 1]
    : "/private/tmp/adr248-native-state",
);
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5173";
const scenario = {
  id: "adr248-old-native-state-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: [
    {
      op: "insertFrameWithOverflowChild",
      id: "clip-true-overflow-visible",
      x: 30,
      y: 30,
      clip: true,
      overflow: "visible",
    },
    {
      op: "insertFrameWithOverflowChild",
      id: "clip-false-overflow-hidden",
      x: 280,
      y: 30,
      clip: false,
      overflow: "hidden",
    },
    {
      op: "insertFrameWithOverflowChild",
      id: "clip-true-overflow-hidden",
      x: 530,
      y: 30,
      clip: true,
      overflow: "hidden",
    },
    {
      op: "insertGroupWithChildren",
      id: "group-horizontal",
      x: 30,
      y: 220,
      orientation: "horizontal",
      size: "sm",
    },
    {
      op: "insertGroupWithChildren",
      id: "group-vertical",
      x: 280,
      y: 220,
      orientation: "vertical",
      size: "lg",
    },
  ],
};
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const sourcePaths = execFileSync(
  "git",
  [
    "ls-files",
    "-z",
    "apps/builder/src",
    "packages/shared/src",
    "packages/specs/src",
    "packages/engine/src",
  ],
  { cwd: root },
)
  .toString()
  .split("\0")
  .filter(Boolean);
const sourceDigest = createHash("sha256");
for (const path of sourcePaths)
  sourceDigest
    .update(path)
    .update("\0")
    .update(readFileSync(resolve(root, path)))
    .update("\0");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const scenarioHash = createHash("sha256")
  .update(JSON.stringify(scenario))
  .digest("hex");
const pixelPoints = {
  clipTrueVisibleOutside: [150, 60],
  clipFalseHiddenOutside: [350, 60],
  clipTrueHiddenOutside: [550, 60],
};
async function readPixelSamples(page, png) {
  return page.evaluate(
    async ({ base64, points }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Screenshot 2D context missing");
      context.drawImage(image, 0, 0);
      return Object.fromEntries(
        Object.entries(points).map(([name, [x, y]]) => [
          name,
          Array.from(context.getImageData(x, y, 1, 1).data),
        ]),
      );
    },
    { base64: png.toString("base64"), points: pixelPoints },
  );
}
function assertOldClipPixels(samples) {
  const red = ([r, g, b]) => r > 170 && g < 120 && b < 120;
  const white = ([r, g, b]) => r >= 245 && g >= 245 && b >= 245;
  if (
    !red(samples.clipTrueVisibleOutside) ||
    !white(samples.clipFalseHiddenOutside) ||
    !white(samples.clipTrueHiddenOutside)
  )
    throw new Error(
      `Old Frame overflow pixel baseline changed: ${JSON.stringify(samples)}`,
    );
}
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const { context, page, errors } = await createInstrumentedContext(browser, {
    storageState: loadStorageState(
      resolve(root, "apps/builder/scripts/.auth-session.json"),
      baseUrl,
    ),
    frameCapture: false,
    deviceScaleFactor: scenario.dpr,
  });
  try {
    await createIsolatedProject(page, baseUrl);
    await page.setViewportSize(scenario.viewport);
    const servedIndexSha256 = sha256(
      await (await page.request.get(baseUrl)).body(),
    );
    const authored = await page.evaluate(async (operations) => {
      const state = window.__composition_STORE__.getState();
      const pageId = state.currentPageId;
      const body = state.elements.find(
        (element) => element.type === "body" && element.page_id === pageId,
      );
      if (!body) throw new Error("Current page body missing");
      const now = new Date().toISOString();
      const ids = [];
      for (const operation of operations) {
        const id = `adr248-${operation.id}`;
        const group = operation.op === "insertGroupWithChildren";
        const root = {
          id,
          customId: operation.id,
          type: group ? "Group" : "frame",
          parent_id: body.id,
          page_id: pageId,
          created_at: now,
          updated_at: now,
          ...(group ? {} : { clip: operation.clip }),
          props: {
            ...(group
              ? { orientation: operation.orientation, size: operation.size }
              : {}),
            style: {
              position: "absolute",
              left: `${operation.x}px`,
              top: `${operation.y}px`,
              width: group ? "170px" : "130px",
              height: group ? "110px" : "100px",
              backgroundColor: group ? "#edf7ec" : "#dbe7ff",
              border: "2px solid #3851a4",
              ...(!group ? { overflow: operation.overflow } : {}),
            },
          },
        };
        const children = (group ? [0, 1] : [0]).map((index) => ({
          id: `${id}-child-${index}`,
          customId: `${operation.id}-child-${index}`,
          type: "Text",
          parent_id: id,
          page_id: pageId,
          order_num: index,
          created_at: now,
          updated_at: now,
          props: {
            children: `${index + 1}`,
            style: {
              ...(group
                ? {}
                : { position: "absolute", left: "90px", top: "30px" }),
              width: group ? "50px" : "100px",
              height: "40px",
              backgroundColor: index ? "#53a853" : "#e04747",
            },
          },
        }));
        await window.__composition_STORE__
          .getState()
          .addComplexElement(root, children);
        ids.push({ id, children: children.map((child) => child.id) });
      }
      return { pageId, bodyId: body.id, ids };
    }, scenario.operations);
    await page.evaluate(() =>
      window.__composition_APPLY_VIEWPORT__?.({ scale: 0.8, x: 300, y: 180 }),
    );
    await page.waitForTimeout(1_000);
    const readObservations = () =>
      page.evaluate((cases) => {
        const state = window.__composition_STORE__.getState();
        const projectId = location.pathname.split("/").pop();
        const doc = window.__canonical_STORE__
          ?.getState()
          ?.getDocument?.(projectId);
        if (!doc) throw new Error("Old canonical document unavailable");
        const findNode = (value, id) => {
          if (!value || typeof value !== "object") return null;
          if (value.id === id && typeof value.type === "string") return value;
          if (Array.isArray(value)) {
            for (const item of value) {
              const found = findNode(item, id);
              if (found) return found;
            }
          } else {
            for (const child of Object.values(value)) {
              if (!child || typeof child !== "object") continue;
              const found = findNode(child, id);
              if (found) return found;
            }
          }
          return null;
        };
        const layout =
          window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.();
        const scene = window.__composition_SCENE_DEBUG__;
        const rect = (id) => {
          const value = layout?.get(id);
          return value
            ? {
                x: value.x,
                y: value.y,
                width: value.width,
                height: value.height,
              }
            : null;
        };
        return cases.map(({ id, children }) => {
          const canonical = findNode(doc, id);
          const element = state.elements.find((item) => item.id === id);
          return {
            semanticId: id.replace(/^adr248-/, ""),
            canonical: canonical
              ? { type: canonical.type, clip: canonical.clip ?? null }
              : null,
            mirror: element
              ? {
                  type: element.type,
                  clip: element.clip ?? null,
                  overflow: element.props?.style?.overflow ?? null,
                  orientation: element.props?.orientation ?? null,
                }
              : null,
            scene: scene?.readNode?.(id) ?? null,
            layout: rect(id),
            children: children.map((childId) => ({
              parentIsExpected:
                state.elements.find((item) => item.id === childId)
                  ?.parent_id === id,
              layout: rect(childId),
            })),
          };
        });
      }, authored.ids);
    const observations = await readObservations();
    if (
      observations.some(
        (item) =>
          !item.canonical ||
          !item.mirror ||
          !item.layout ||
          item.children.some(
            (child) => !child.parentIsExpected || !child.layout,
          ),
      )
    )
      throw new Error("Old native state fixture was not fully authored");
    const beforeScreenshot = await page.screenshot({
      path: resolve(out, "canvas.png"),
      animations: "disabled",
      clip: { x: 300, y: 180, width: 900, height: 480 },
    });
    const beforePixels = await readPixelSamples(page, beforeScreenshot);
    assertOldClipPixels(beforePixels);
    await page.reload({ waitUntil: "networkidle" });
    await waitReady(page);
    const afterRefresh = await readObservations();
    if (
      afterRefresh.some(
        (item) =>
          !item.canonical ||
          !item.mirror ||
          !item.layout ||
          item.children.some(
            (child) => !child.parentIsExpected || !child.layout,
          ),
      )
    )
      throw new Error("Native state fixture did not survive refresh");
    const byId = new Map(observations.map((item) => [item.semanticId, item]));
    const refreshedById = new Map(
      afterRefresh.map((item) => [item.semanticId, item]),
    );
    for (const operation of scenario.operations) {
      const before = byId.get(operation.id);
      const after = refreshedById.get(operation.id);
      if (operation.op === "insertFrameWithOverflowChild") {
        if (
          before?.canonical.clip !== operation.clip ||
          before.mirror.clip !== operation.clip ||
          after?.canonical.clip !== operation.clip ||
          after.mirror.clip !== null ||
          after.scene?.props?.style?.overflow !== operation.overflow ||
          Object.hasOwn(after.scene?.props ?? {}, "clip")
        )
          throw new Error(
            `${operation.id}: old clip/overflow baseline changed`,
          );
      } else if (
        before?.mirror.orientation !== operation.orientation ||
        after?.mirror.orientation !== operation.orientation
      ) {
        throw new Error(`${operation.id}: old orientation baseline changed`);
      }
    }
    const horizontal = refreshedById.get("group-horizontal");
    const vertical = refreshedById.get("group-vertical");
    if (
      JSON.stringify(horizontal?.children.map((child) => child.layout)) !==
      JSON.stringify(vertical?.children.map((child) => child.layout))
    )
      throw new Error(
        "Old Group children no longer share the same vertical layout",
      );
    await page.evaluate(() =>
      window.__composition_APPLY_VIEWPORT__?.({ scale: 0.8, x: 300, y: 180 }),
    );
    await page.waitForTimeout(600);
    const afterScreenshot = await page.screenshot({
      path: resolve(out, "canvas-after-refresh.png"),
      animations: "disabled",
      clip: { x: 300, y: 180, width: 900, height: 480 },
    });
    const afterPixels = await readPixelSamples(page, afterScreenshot);
    assertOldClipPixels(afterPixels);
    const report = {
      head,
      executionBuildIdentity: `dev-source:${sourceDigest.digest("hex")}:index:${servedIndexSha256}`,
      buildIndexSha256: sha256(
        readFileSync(resolve(root, "apps/builder/dist/index.html")),
      ),
      scenarioHash,
      scenario,
      runtimeEnvironment: await page.evaluate(async () => ({
        viewport: { width: innerWidth, height: innerHeight },
        dpr: devicePixelRatio,
        theme: document.documentElement.dataset.theme ?? "default-light",
        font: getComputedStyle(document.body).fontFamily,
        fontLoadStatus: await document.fonts.ready.then(
          () => document.fonts.status,
        ),
      })),
      screenshots: {
        before: sha256(beforeScreenshot),
        afterRefresh: sha256(afterScreenshot),
      },
      viewportState: await page.evaluate(
        () => window.__composition_VIEWPORT__?.() ?? null,
      ),
      fontState: await page.evaluate(() => ({
        bodyFamily: getComputedStyle(document.body).fontFamily,
        loadStatus: document.fonts.status,
      })),
      observations,
      afterRefresh,
      clipPixelSamples: { before: beforePixels, afterRefresh: afterPixels },
      errors,
    };
    writeFileSync(
      resolve(out, "baseline.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
    process.stdout.write(
      `${out}/baseline.json: ${observations.length} cases, 0 browser errors\n`,
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
