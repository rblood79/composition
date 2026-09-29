// @vitest-environment node
import "fake-indexeddb/auto";
import { baselineCompatibleHead } from "./support/baselineHead";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { CanvasKit } from "canvaskit-wasm";
import { chromium } from "playwright";
import { renderCatalogDom } from "../domBinding";
import { renderToStaticMarkup } from "react-dom/server";
import pixelmatch from "pixelmatch";
import { expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { createG1Fixture } from "../../../../../../packages/shared/src/catalog/document/fixture";
import { createPencilFixtureLibrary } from "../../../../../../packages/shared/src/catalog/document/pencilFixtureLibrary";
import type {
  CatalogEntry,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CanvasSceneNode } from "../../workspace/canvas/scene/canvasSceneNode";
import type { ComputedLayout } from "../../workspace/canvas/layout/engines/LayoutEngine";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import { buildBoxNodeData } from "../../workspace/canvas/skia/buildBoxNodeData";
import {
  buildRenderCommandStream,
  executeRenderCommands,
} from "../../workspace/canvas/skia/renderCommands";
import { initCanvasKit } from "../../workspace/canvas/skia/initCanvasKit";
import { skiaFontManager } from "../../workspace/canvas/skia/fontManager";
import {
  clearSkiaRegistry,
  registerSkiaNode,
} from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "./support/catalogCanvasBinding";
import { CatalogCompositionRoot } from "../compositionRoot";
import { CatalogRuntime } from "../controller";
import { CatalogStorage } from "../storage";
import { G0_BASELINE_ABSENT } from "./support/g0Baseline";
import { writeEvidence } from "./support/evidence";

const require = createRequire(import.meta.url);
const repo = resolve(process.cwd(), "../..");
const design = resolve(repo, "docs/adr/design");
const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const cases = [
  "clip-true-overflow-visible",
  "clip-false-overflow-hidden",
] as const;

type RawLayout = {
  buildTreeBatch(input: string): Uint32Array;
  createNodeRaw(input: string): number;
  updateStyleRaw(handle: number, input: string): void;
  setChildren(handle: number, children: Uint32Array): void;
  markDirty(handle: number): void;
  removeNode(handle: number): void;
  setViewport(width: number, height: number): void;
  computeLayout(handle: number, width: number, height: number): void;
  getLayout(handle: number): string;
  clear(): void;
  nodeCount(): number;
  free(): void;
};

async function layoutEngine(): Promise<{
  engine: LayoutEngineAPI;
  raw: RawLayout;
}> {
  const directory = resolve(
    process.cwd(),
    "src/builder/workspace/canvas/wasm-bindings/engine-pkg",
  );
  const glue = (await import(
    pathToFileURL(join(directory, "engine_bg.js")).href
  )) as {
    __wbg_set_wasm(value: WebAssembly.Exports): void;
    LayoutEngine: new () => RawLayout;
  };
  const instance = await WebAssembly.instantiate(
    readFileSync(join(directory, "engine_bg.wasm")),
    {
      "./engine_bg.js": glue,
    },
  );
  glue.__wbg_set_wasm(instance.instance.exports);
  const raw = new glue.LayoutEngine();
  return {
    raw,
    engine: {
      isAvailable: () => true,
      hasBinaryProtocol: () => false,
      buildTreeBatch: (input) => [...raw.buildTreeBatch(input)],
      buildTreeBatchBinary: () => {
        throw new Error("JSON harness only");
      },
      createNodeRaw: (input) => raw.createNodeRaw(input),
      updateStyleRaw: (handle, input) => raw.updateStyleRaw(handle, input),
      setChildren: (handle, children) =>
        raw.setChildren(handle, Uint32Array.from(children)),
      markDirty: (handle) => raw.markDirty(handle),
      removeNode: (handle) => raw.removeNode(handle),
      setViewport: (width, height) => raw.setViewport(width, height),
      computeLayout: (handle, width, height) =>
        raw.computeLayout(handle, width, height),
      getLayoutsBatch: (handles) =>
        new Map(
          handles.map((handle) => [handle, JSON.parse(raw.getLayout(handle))]),
        ),
      clear: () => raw.clear(),
      nodeCount: () => raw.nodeCount(),
    },
  };
}

let canvasKitPromise: Promise<CanvasKit> | undefined;
async function canvasKit(): Promise<CanvasKit> {
  const bin = dirname(require.resolve("canvaskit-wasm/bin/canvaskit.js"));
  const initialize = require(join(bin, "canvaskit.js")) as (options: {
    locateFile(file: string): string;
  }) => Promise<CanvasKit>;
  canvasKitPromise ??= initialize({ locateFile: (file) => join(bin, file) });
  return canvasKitPromise;
}

function decode(ck: CanvasKit, bytes: Uint8Array) {
  const image = ck.MakeImageFromEncoded(bytes);
  if (!image) throw new Error("FRAME_CLIP_PNG_DECODE_FAILED");
  const width = image.width();
  const height = image.height();
  const pixels = image.readPixels(0, 0, {
    width,
    height,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  });
  image.delete();
  if (!pixels) throw new Error("FRAME_CLIP_PNG_PIXELS_MISSING");
  return { width, height, pixels };
}

function compareRegion(
  first: ReturnType<typeof decode>,
  second: ReturnType<typeof decode>,
  region: { x: number; y: number; width: number; height: number },
) {
  if (first.width !== second.width || first.height !== second.height)
    throw new Error("FRAME_CLIP_GRID_MISMATCH");
  const a = new Uint8Array(region.width * region.height * 4);
  const b = new Uint8Array(a.length);
  for (let y = 0; y < region.height; y++) {
    const source = ((region.y + y) * first.width + region.x) * 4;
    a.set(
      first.pixels.subarray(source, source + region.width * 4),
      y * region.width * 4,
    );
    b.set(
      second.pixels.subarray(source, source + region.width * 4),
      y * region.width * 4,
    );
  }
  const diffMask = new Uint8ClampedArray(a.length);
  const difference = pixelmatch(a, b, diffMask, region.width, region.height, {
    threshold: 0.1,
    diffMask: true,
  });
  const changedCoordinates: Array<[number, number]> = [];
  for (let y = 0; y < region.height; y++)
    for (let x = 0; x < region.width; x++)
      if (diffMask[(y * region.width + x) * 4 + 3])
        changedCoordinates.push([region.x + x, region.y + y]);
  let maxByte = 0;
  let changedBytes = 0;
  let sum = 0;
  for (let index = 0; index < a.length; index++) {
    const delta = Math.abs(a[index] - b[index]);
    maxByte = Math.max(maxByte, delta);
    sum += delta;
    if (delta) changedBytes++;
  }
  const ratio = difference / (region.width * region.height);
  return {
    pixelmatchThreshold: 0.1,
    differentPixels: difference,
    denominator: region.width * region.height,
    ratio,
    maxByte,
    meanByte: sum / a.length,
    changedFraction: changedBytes / a.length,
    diffBounds: changedCoordinates.length
      ? {
          xMin: Math.min(...changedCoordinates.map(([x]) => x)),
          xMax: Math.max(...changedCoordinates.map(([x]) => x)),
          yMin: Math.min(...changedCoordinates.map(([, y]) => y)),
          yMax: Math.max(...changedCoordinates.map(([, y]) => y)),
        }
      : null,
    dominantColumns: [...new Set(changedCoordinates.map(([x]) => x))]
      .map((x) => ({
        x,
        count: changedCoordinates.filter(([other]) => other === x).length,
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6),
    initialNonTextBudget: { maxDiffRatio: 0.001, maxByte: 2 },
    initialBudgetVerdict: ratio > 0.001 && maxByte > 2 ? "FAIL" : "PASS",
    regionHasText: true,
    hc6L3Verdict: "UNVERIFIED_TEXT_REGION_NOT_SEPARATED",
    l3eVerdict: "UNVERIFIED_NO_APPROVED_FRAME_EDGE_BUDGET",
  };
}

it("preserves the HEAD product box clip, pixel, and hit boundary", async () => {
  const ck = await canvasKit();
  Object.assign(globalThis, {
    window: { __composition_CANVASKIT_INSTANCE__: ck },
  });
  await initCanvasKit();
  const parent = {
    id: "legacy-clip-border-parent",
    type: "Box",
    props: {
      style: {
        backgroundColor: "#dbe7ff",
        borderColor: "#3851a4",
        borderWidth: 2,
        overflow: "hidden",
      },
    },
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    deleted: false,
  } as unknown as CanvasSceneNode;
  const child = {
    id: "legacy-clip-border-child",
    type: "Box",
    props: {
      style: {
        backgroundColor: "#e04747",
      },
    },
    parent_id: parent.id,
    page_id: "page-1",
    order_num: 0,
    deleted: false,
  } as unknown as CanvasSceneNode;
  const parentLayout = { x: 0, y: 0, width: 100, height: 80 } as ComputedLayout;
  const childLayout = { x: 90, y: 30, width: 40, height: 20 } as ComputedLayout;
  const parentData = buildBoxNodeData({
    element: parent,
    layout: parentLayout,
  });
  const childData = buildBoxNodeData({ element: child, layout: childLayout });
  expect(parentData).toMatchObject({
    type: "box",
    clipChildren: true,
    box: { strokeWidth: 2 },
  });
  expect(parentData?.box?.strokeColor?.[3]).toBe(1);
  expect(parentData?.box?.strokeWidths).toBeUndefined();
  expect(parentData).not.toHaveProperty("clipBorderInset");
  expect(childData?.type).toBe("box");
  if (!parentData || !childData) throw new Error("LEGACY_BOX_BUILD_FAILED");
  registerSkiaNode(parent.id, parentData);
  registerSkiaNode(child.id, childData);
  try {
    const stream = buildRenderCommandStream(
      [parent.id],
      new Map([[parent.id, [child]]]),
      new Map([
        [parent.id, parentLayout],
        [child.id, childLayout],
      ]),
      {},
    );
    const childrenBegin = stream.commands.find((command) => command.type === 2);
    expect(childrenBegin).toMatchObject({
      clipChildren: true,
      width: 100,
      height: 80,
    });
    expect(childrenBegin).not.toHaveProperty("clipBorderInset");
    expect(stream.hitBoundsMap.get(child.id)).toEqual({
      x: 90,
      y: 30,
      width: 10,
      height: 20,
    });
    const surface = ck.MakeSurface(120, 80)!;
    try {
      const canvas = surface.getCanvas();
      canvas.clear(ck.WHITE);
      executeRenderCommands(ck, canvas, stream.commands, {
        x: 0,
        y: 0,
        width: 120,
        height: 80,
      } as DOMRect);
      surface.flush();
      const bytes = surface.makeImageSnapshot().encodeToBytes();
      if (!bytes) throw new Error("LEGACY_CLIP_PNG_MISSING");
      const image = decode(ck, bytes);
      const offset = (40 * image.width + 99) * 4;
      const borderPixel = [...image.pixels.slice(offset, offset + 4)];
      const outsidePixel = [...image.pixels.slice(offset + 4, offset + 8)];
      expect(borderPixel).toEqual([224, 71, 71, 255]);
      expect(outsidePixel).toEqual([255, 255, 255, 255]);
      // The border-inset clip is an opt-in field only the new runtime's Canvas binding writes;
      // product builders never set it, so their child clip and hit boundary stay the full box
      // (the pixels above). Readers: the field type and the render command consumer.
      const clipInsetFiles = execFileSync(
        "git",
        [
          "grep",
          "-l",
          "clipBorderInset",
          "HEAD",
          "--",
          "apps/builder/src",
          "packages",
          ":!**/__tests__/**",
        ],
        { cwd: repo, encoding: "utf8" },
      )
        .split("\n")
        .filter(Boolean)
        .map((line) => line.replace(/^HEAD:/, ""))
        .sort();
      expect(clipInsetFiles).toEqual([
        "apps/builder/src/builder/catalogRuntime/canvasBinding.ts",
        "apps/builder/src/builder/workspace/canvas/skia/nodeRendererTypes.ts",
        "apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts",
      ]);
      writeEvidence(
        join(design, "248-phase3-legacy-clip-isolation.json"),
        JSON.stringify(
          {
            head: execFileSync("git", ["rev-parse", "HEAD"], {
              cwd: repo,
              encoding: "utf8",
            }).trim(),
            route:
              "buildBoxNodeData -> registerSkiaNode -> buildRenderCommandStream -> executeRenderCommands",
            input: {
              overflow: "hidden",
              borderWidth: 2,
              borderColor: "#3851a4",
              parent: parentLayout,
              child: childLayout,
            },
            commandClip: {
              width: childrenBegin?.width,
              height: childrenBegin?.height,
              clipBorderInset: null,
            },
            childHitBounds: stream.hitBoundsMap.get(child.id),
            borderPixel,
            outsidePixel,
            pngSha256: sha(bytes),
            clipInsetFiles,
            headContract:
              "product builders never set clipBorderInset (only the new runtime Canvas binding writes it): children clip to (0,0,width,height)",
          },
          null,
          2,
        ),
      );
    } finally {
      surface.delete();
    }
  } finally {
    clearSkiaRegistry();
  }
});

it.skipIf(G0_BASELINE_ABSENT)(
  "independently compares only pinned hidden and visible Frame clip consumers",
  async () => {
    const old = JSON.parse(
      readFileSync(
        join(design, "248-baseline/native-state-pinned/baseline.json"),
        "utf8",
      ),
    );
    const paired = JSON.parse(
      readFileSync(
        join(design, "248-phase3-native-old-current/baseline.json"),
        "utf8",
      ),
    );
    const head = baselineCompatibleHead(repo, old.head);
    expect(paired.head).toBe(old.head);
    expect(paired.scenarioHash).toBe(old.scenarioHash);
    expect(paired.scenario).toEqual(old.scenario);
    expect(old.scenario.viewport).toEqual({ width: 1440, height: 900 });
    expect([
      old.scenario.dpr,
      old.scenario.theme,
      old.scenario.font,
      old.scenario.seed,
    ]).toEqual([1, "default-light", "app-default", 248]);
    const operations = cases.map((id) =>
      old.scenario.operations.find((op: { id: string }) => op.id === id),
    );
    expect(operations.every(Boolean)).toBe(true);
    const { document: seed } = createG1Fixture();
    const page = seed.entries["project:page:main"] as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    const graph = new CatalogGraph(
      {
        ...seed,
        entries: {
          [seed.projectId]: seed.entries[seed.projectId],
          [page.id]: { ...page, children: [] },
        },
      },
      createPencilFixtureLibrary(),
    );
    const { engine, raw } = await layoutEngine();
    const ck = await canvasKit();
    Object.assign(globalThis, {
      window: { __composition_CANVASKIT_INSTANCE__: ck },
    });
    await initCanvasKit();
    const fontBytes = readFileSync(
      resolve(process.cwd(), "public/fonts/PretendardVariable.ttf"),
    );
    skiaFontManager.loadFontFromBuffer(
      "Pretendard",
      fontBytes.buffer.slice(
        fontBytes.byteOffset,
        fontBytes.byteOffset + fontBytes.byteLength,
      ) as ArrayBuffer,
    );
    const browser = await chromium.launch({ headless: true });
    try {
      const root = new CatalogCompositionRoot(
        new CatalogRuntime(
          graph,
          new CatalogStorage(indexedDB, `adr248-frame-pair-${Date.now()}`),
        ),
        engine,
        old.scenario.viewport,
      );
      const nodes: NodeEntry[] = operations.flatMap(
        (operation): NodeEntry[] => {
          const id = `project:node:${operation.id}` as NodeEntry["id"];
          const childId =
            `project:node:${operation.id}-child-0` as NodeEntry["id"];
          return [
            {
              kind: "node",
              id,
              definitionId: "lib:definition:frame",
              children: [childId],
              props: {},
              visual: {
                fill: { kind: "set", value: "#dbe7ff" },
                borderColor: { kind: "set", value: "#3851a4" },
                borderWidth: { kind: "set", value: 2 },
                overflow: { kind: "set", value: operation.overflow },
              },
              sizing: {
                width: { kind: "set", value: 130 },
                height: { kind: "set", value: 100 },
              },
              placement: { kind: "absolute", x: operation.x, y: operation.y },
              descendantOverrides: [],
            },
            {
              kind: "node",
              id: childId,
              definitionId: "lib:definition:text",
              children: [],
              props: { children: { kind: "set", value: "1" } },
              visual: { fill: { kind: "set", value: "#e04747" } },
              sizing: {
                width: { kind: "set", value: 100 },
                height: { kind: "set", value: 40 },
              },
              placement: { kind: "absolute", x: 90, y: 30 },
              descendantOverrides: [],
            },
          ];
        },
      );
      root.dispatch("G0 public Frame inserts: hidden and visible", [
        ...nodes.map((entry) => ({ kind: "put" as const, entry })),
        {
          kind: "put",
          entry: {
            ...page,
            children: operations.map(
              (op) => `project:node:${op.id}` as NodeEntry["id"],
            ),
          },
        },
      ]);
      const bySource = new Map(
        [...root.canvasInputs.values()].map((input) => [input.sourceId, input]),
      );
      const geometry = root.getGeometry(root.canvasInputs.keys());
      const roots = operations.map(
        (op) => bySource.get(`project:node:${op.id}`)!.id,
      );
      const bound = bindCatalogCanvas(root, roots);
      const visibleSpan = bound.stream.childrenSpans.get(roots[0]);
      const hiddenSpan = bound.stream.childrenSpans.get(roots[1]);
      expect(visibleSpan).toBeDefined();
      expect(hiddenSpan).toBeDefined();
      expect(bound.stream.commands[visibleSpan!.start]).not.toHaveProperty(
        "clipBorderInset",
      );
      expect(bound.stream.commands[hiddenSpan!.start]).toMatchObject({
        type: 2,
        clipBorderInset: 2,
      });
      const hiddenBegin = bound.stream.commands[hiddenSpan!.start];
      let canvasBytes: Uint8Array;
      try {
        const surface = ck.MakeSurface(900, 480)!;
        try {
          const canvas = surface.getCanvas();
          canvas.clear(ck.WHITE);
          canvas.scale(0.8, 0.8);
          executeRenderCommands(
            ck,
            canvas,
            bound.stream.commands,
            {
              x: 0,
              y: 0,
              width: 900,
              height: 480,
            } as DOMRect,
            skiaFontManager.getFontMgr(),
          );
          surface.flush();
          const bytes = surface.makeImageSnapshot().encodeToBytes();
          if (!bytes) throw new Error("FRAME_CLIP_CANVAS_PNG_MISSING");
          canvasBytes = bytes;
          writeEvidence(
            join(design, "248-phase3-frame-clip-pair-canvas.png"),
            bytes,
          );
        } finally {
          surface.delete();
        }
      } finally {
        bound.dispose();
      }
      const context = await browser.newContext({
        viewport: old.scenario.viewport,
        deviceScaleFactor: 1,
        colorScheme: "light",
      });
      const browserTab = await context.newPage();
      const fontUrl = `data:font/ttf;base64,${fontBytes.toString("base64")}`;
      // Same resolved inputs → product-path DOM binding (`catalogRuntime/domBinding`).
      const domTargets = operations.map((op) => {
        const frame = bySource.get(`project:node:${op.id}`)!;
        return { id: op.id, frameId: frame.id, childId: frame.children[0] };
      });
      const frameHtml = domTargets
        .map((target) =>
          renderToStaticMarkup(renderCatalogDom(root, target.frameId)),
        )
        .join("");
      await browserTab.setContent(
        `<style>@font-face{font-family:Pretendard;src:url('${fontUrl}')}html,body{margin:0;background:#fff;font-family:Pretendard,sans-serif;font-size:16px}</style><div id="stage" style="width:900px;height:480px;position:relative;overflow:hidden"><div id="scene" style="position:absolute;inset:0;transform:scale(.8);transform-origin:0 0">${frameHtml}</div></div>`,
      );
      await browserTab.evaluate(() => document.fonts.ready);
      const domBytes = await browserTab.locator("#stage").screenshot();
      writeEvidence(
        join(design, "248-phase3-frame-clip-pair-dom.png"),
        domBytes,
      );
      const dom = await browserTab.evaluate(
        (targets) =>
          targets.map(({ id, frameId, childId }) => {
            const frame = document.querySelector<HTMLElement>(
              `[data-catalog-id="${frameId}"]`,
            )!;
            const child = document.querySelector<HTMLElement>(
              `[data-catalog-id="${childId}"]`,
            )!;
            const parent = frame.getBoundingClientRect();
            const inner = child.getBoundingClientRect();
            const style = getComputedStyle(frame);
            return {
              id,
              frameRect: {
                x: parent.x,
                y: parent.y,
                width: parent.width,
                height: parent.height,
              },
              childRect: {
                x: inner.x,
                y: inner.y,
                width: inner.width,
                height: inner.height,
              },
              computed: {
                overflow: style.overflow,
                border: style.border,
                backgroundColor: style.backgroundColor,
                display: style.display,
              },
              role: frame.getAttribute("role"),
              childText: child.textContent,
              outsideHit:
                document.elementFromPoint(
                  parent.x + 150 * 0.8,
                  parent.y + 55 * 0.8,
                ) === child,
            };
          }),
        domTargets.filter((target) => cases.includes(target.id as never)),
      );
      await context.close();
      const oldBytes = readFileSync(
        join(design, "248-baseline/native-state-pinned/canvas.png"),
      );
      const oldImage = decode(ck, oldBytes);
      const newImage = decode(ck, canvasBytes);
      const domImage = decode(ck, domBytes);
      const pixel = (
        image: ReturnType<typeof decode>,
        x: number,
        y: number,
      ) => [
        ...image.pixels.slice(
          (y * image.width + x) * 4,
          (y * image.width + x) * 4 + 4,
        ),
      ];
      // CSS clips descendants inside the 2px Frame border; that border must
      // remain visible after the child paints at the hidden right edge.
      expect(pixel(newImage, 327, 55)).toEqual(pixel(domImage, 327, 55));
      const results = operations.map((op, index) => {
        const frame = bySource.get(`project:node:${op.id}`)!;
        const child = bySource.get(`project:node:${op.id}-child-0`)!;
        const expected = old.observations.find(
          (item: { semanticId: string }) => item.semanticId === op.id,
        )!;
        const rustFrame = geometry.get(frame.id)!;
        const rustChild = geometry.get(child.id)!;
        const canvasHitBounds = bound.stream.hitBoundsMap.get(child.id);
        const sceneOutside = { x: op.x + 150, y: op.y + 55 };
        const canvasOutsideHit =
          !!canvasHitBounds &&
          sceneOutside.x >= canvasHitBounds.x &&
          sceneOutside.x < canvasHitBounds.x + canvasHitBounds.width &&
          sceneOutside.y >= canvasHitBounds.y &&
          sceneOutside.y < canvasHitBounds.y + canvasHitBounds.height;
        const region = {
          x: index === 0 ? 20 : 220,
          y: 20,
          width: 180,
          height: 110,
        };
        return {
          id: op.id,
          overflow: op.overflow,
          publicOperation: op.op,
          expectedFrame: expected.layout,
          rustFrame,
          expectedChild: expected.children[0].layout,
          rustChild,
          dom: dom[index],
          canvasHitBounds,
          canvasOutsideHit,
          canvasOutsidePixel: pixel(newImage, index === 0 ? 150 : 350, 60),
          region,
          oldCanvasVsNewCanvas: compareRegion(oldImage, newImage, region),
          newCanvasVsDom: compareRegion(newImage, domImage, region),
        };
      });
      for (const result of results) {
        expect(result.rustFrame).toMatchObject(result.expectedFrame);
        expect(result.rustChild).toMatchObject(result.expectedChild);
        expect(result.dom.computed.overflow).toBe(result.overflow);
        expect(result.dom.computed.border).toBe("2px solid rgb(56, 81, 164)");
        expect(result.dom.computed.backgroundColor).toBe("rgb(219, 231, 255)");
        expect(result.dom.role).toBeNull();
        expect(result.dom.childText).toBe("1");
        expect(result.dom.outsideHit).toBe(result.overflow === "visible");
        expect(result.canvasOutsideHit).toBe(result.overflow === "visible");
        for (const key of ["x", "y", "width", "height"] as const)
          expect(result.dom.frameRect[key] / 0.8).toBeCloseTo(
            result.expectedFrame[key],
            2,
          );
        expect(
          (result.dom.childRect.x - result.dom.frameRect.x) / 0.8,
        ).toBeCloseTo(result.expectedChild.x, 2);
        expect(
          (result.dom.childRect.y - result.dom.frameRect.y) / 0.8,
        ).toBeCloseTo(result.expectedChild.y, 2);
        expect(result.dom.childRect.width / 0.8).toBeCloseTo(
          result.expectedChild.width,
          2,
        );
        expect(result.dom.childRect.height / 0.8).toBeCloseTo(
          result.expectedChild.height,
          2,
        );
        expect(result.canvasOutsidePixel).toEqual(
          result.overflow === "visible"
            ? [224, 71, 71, 255]
            : [255, 255, 255, 255],
        );
      }
      writeEvidence(
        join(design, "248-phase3-frame-clip-pair.json"),
        JSON.stringify(
          {
            scenarioId: old.scenario.id,
            scenarioHash: old.scenarioHash,
            head,
            environment: {
              viewport: old.scenario.viewport,
              dpr: 1,
              theme: old.scenario.theme,
              font: old.scenario.font,
              fontSha256: sha(fontBytes),
              seed: old.scenario.seed,
            },
            old: {
              executionBuildIdentity: old.executionBuildIdentity,
              buildIndexSha256: old.buildIndexSha256,
              screenshotSha256: sha(oldBytes),
            },
            new: {
              execution: "independent Vitest Node + Playwright isolated DOM",
              sourceAssetsSha256: {
                testEntry: sha(
                  readFileSync(
                    resolve(
                      process.cwd(),
                      "src/builder/catalogRuntime/__tests__/phase3FrameClipPair.test.tsx",
                    ),
                  ),
                ),
                canvasBinding: sha(
                  readFileSync(
                    resolve(
                      process.cwd(),
                      "src/builder/catalogRuntime/__tests__/support/catalogCanvasBinding.ts",
                    ),
                  ),
                ),
                renderCommands: sha(
                  readFileSync(
                    resolve(
                      process.cwd(),
                      "src/builder/workspace/canvas/skia/renderCommands.ts",
                    ),
                  ),
                ),
                rustWasm: sha(
                  readFileSync(
                    resolve(
                      process.cwd(),
                      "src/builder/workspace/canvas/wasm-bindings/engine-pkg/engine_bg.wasm",
                    ),
                  ),
                ),
                canvasKitWasm: sha(
                  readFileSync(
                    join(
                      dirname(
                        require.resolve("canvaskit-wasm/bin/canvaskit.js"),
                      ),
                      "canvaskit.wasm",
                    ),
                  ),
                ),
              },
              canvasSha256: sha(canvasBytes),
              domSha256: sha(domBytes),
              commandCount: bound.stream.commands.length,
              hiddenFrameClipBorderInset:
                hiddenBegin.type === 2 ? hiddenBegin.clipBorderInset : null,
            },
            results,
          },
          null,
          2,
        ),
      );
    } finally {
      await browser.close();
      raw.free();
    }
  },
);
