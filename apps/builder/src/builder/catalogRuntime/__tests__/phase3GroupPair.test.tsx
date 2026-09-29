// @vitest-environment node
/**
 * ADR-248 Phase 3 — G0 native-state Group horizontal/sm · vertical/lg 두 사례의
 * 새 Canvas ↔ 격리 RAC DOM L3 (ADR-198 region 규칙).
 *
 * 입력: G0 공개 조작 `insertGroupWithChildren` 2건 (Group fill #edf7ec + 2px solid #3851a4,
 * 자식 Text 2개 50×40 fill #e04747/#53a853, 글자 "1"/"2").
 * 소비자: typed graph → CatalogCompositionRoot → 실제 Rust layout → test-entry catalog binding →
 * 공용 renderCommands/CanvasKit 과, 같은 resolved 값 → 제품 경로 DOM binding (`catalogRuntime/domBinding`, RAC `Group`·`Text`, Chromium 격리 DOM).
 * 판정: region 소속은 노드 ID. 자식은 `lib:definition:text` → `text` kind (L4).
 * L3 non-text = Group 노드 상자 − 자식 텍스트 노드 상자 (VisualParityRegion.mask, Canvas leg 기하).
 * 차단 = pixelmatch 0.1 ratio > 0.001 **AND** maxByte > 2 (INITIAL_BUDGETS.nonText). L3e 는 예산 미승인.
 */
import "fake-indexeddb/auto";
import { baselineCompatibleHead } from "./support/baselineHead";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { renderCatalogDom } from "../domBinding";
import type { CanvasKit } from "canvaskit-wasm";
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { createG1Fixture } from "../../../../../../packages/shared/src/catalog/document/fixture";
import { createPencilFixtureLibrary } from "../../../../../../packages/shared/src/catalog/document/pencilFixtureLibrary";
import type {
  CatalogEntry,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import { executeRenderCommands } from "../../workspace/canvas/skia/renderCommands";
import { initCanvasKit } from "../../workspace/canvas/skia/initCanvasKit";
import { skiaFontManager } from "../../workspace/canvas/skia/fontManager";
import { bindCatalogCanvas } from "./support/catalogCanvasBinding";
import { CatalogCompositionRoot } from "../compositionRoot";
import { CatalogRuntime } from "../controller";
import { CatalogStorage } from "../storage";

const require = createRequire(import.meta.url);
const repo = resolve(process.cwd(), "../..");
const design = resolve(repo, "docs/adr/design");
const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const SCALE = 0.8;
const NON_TEXT = { maxDiffRatio: 0.001, maxByte: 2 } as const;

type Rect = { x: number; y: number; width: number; height: number };
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
    { "./engine_bg.js": glue },
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

async function canvasKit(): Promise<CanvasKit> {
  const bin = dirname(require.resolve("canvaskit-wasm/bin/canvaskit.js"));
  const initialize = require(join(bin, "canvaskit.js")) as (options: {
    locateFile(file: string): string;
  }) => Promise<CanvasKit>;
  return initialize({ locateFile: (file) => join(bin, file) });
}

function decode(ck: CanvasKit, bytes: Uint8Array) {
  const image = ck.MakeImageFromEncoded(bytes);
  if (!image) throw new Error("GROUP_PAIR_PNG_DECODE_FAILED");
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
  if (!pixels) throw new Error("GROUP_PAIR_PNG_PIXELS_MISSING");
  // DOM PNG 는 RGB — alpha 만 255 로 맞춘다 (색 보정·리사이즈 없음).
  for (let index = 3; index < pixels.length; index += 4) pixels[index] = 255;
  return { width, height, pixels };
}
type Image = ReturnType<typeof decode>;

/** ADR-198 regionBox: 노드 상자 합집합의 floor/ceil. */
function nodeBox(rect: Rect): Rect {
  const x = Math.floor(rect.x);
  const y = Math.floor(rect.y);
  return {
    x,
    y,
    width: Math.ceil(rect.x + rect.width) - x,
    height: Math.ceil(rect.y + rect.height) - y,
  };
}
const inside = (rect: Rect, x: number, y: number) =>
  x >= rect.x &&
  x < rect.x + rect.width &&
  y >= rect.y &&
  y < rect.y + rect.height;

/** pixelmatch 0.1 on the region rectangle; masked pixels leave numerator and denominator. */
function measure(a: Image, b: Image, region: Rect, masks: Rect[] = []) {
  if (a.width !== b.width || a.height !== b.height)
    throw new Error("GROUP_PAIR_GRID_MISMATCH");
  const { width: w, height: h } = region;
  const left = new Uint8Array(w * h * 4);
  const right = new Uint8Array(w * h * 4);
  for (let row = 0; row < h; row++) {
    const source = ((region.y + row) * a.width + region.x) * 4;
    left.set(a.pixels.subarray(source, source + w * 4), row * w * 4);
    right.set(b.pixels.subarray(source, source + w * 4), row * w * 4);
  }
  const out = new Uint8ClampedArray(w * h * 4);
  pixelmatch(left, right, out, w, h, { threshold: 0.1, diffMask: true });
  let denominator = 0;
  let differentPixels = 0;
  let maxByte = 0;
  const diffCoordinates: Array<[number, number]> = [];
  for (let index = 0; index < w * h; index++) {
    const x = region.x + (index % w);
    const y = region.y + Math.floor(index / w);
    if (masks.some((mask) => inside(mask, x, y))) continue;
    denominator++;
    for (let channel = 0; channel < 3; channel++)
      maxByte = Math.max(
        maxByte,
        Math.abs(left[index * 4 + channel] - right[index * 4 + channel]),
      );
    if (out[index * 4 + 3]) {
      differentPixels++;
      diffCoordinates.push([x, y]);
    }
  }
  const diffRatio = differentPixels / denominator;
  return {
    region,
    masks,
    denominator,
    differentPixels,
    diffRatio,
    maxByte,
    blockedAtNonTextBudget:
      diffRatio > NON_TEXT.maxDiffRatio && maxByte > NON_TEXT.maxByte,
    diffCoordinatesSample: diffCoordinates.slice(0, 16),
  };
}

it("measures G0 Group horizontal/sm and vertical/lg new Canvas against isolated RAC Group DOM with ADR-198 regions", async () => {
  const old = JSON.parse(
    readFileSync(
      join(design, "248-baseline/native-state-pinned/baseline.json"),
      "utf8",
    ),
  );
  const head = baselineCompatibleHead(repo, old.head);
  expect(old.scenario.viewport).toEqual({ width: 1440, height: 900 });
  const operations = old.scenario.operations.filter(
    (operation: { op: string }) => operation.op === "insertGroupWithChildren",
  ) as Array<{
    id: string;
    x: number;
    y: number;
    orientation: "horizontal" | "vertical";
    size: "sm" | "lg";
  }>;
  expect(operations.map((operation) => operation.id)).toEqual([
    "group-horizontal",
    "group-vertical",
  ]);

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
        new CatalogStorage(indexedDB, `adr248-group-pair-${Date.now()}`),
      ),
      engine,
      old.scenario.viewport,
    );
    const nodes: NodeEntry[] = operations.flatMap((operation) => {
      const id = `project:node:${operation.id}` as NodeEntry["id"];
      const childIds = [0, 1].map(
        (index) =>
          `project:node:${operation.id}-child-${index}` as NodeEntry["id"],
      );
      return [
        {
          kind: "node",
          id,
          name: operation.id,
          definitionId: "lib:definition:group",
          children: childIds,
          props: {
            orientation: { kind: "set", value: operation.orientation },
            size: { kind: "set", value: operation.size },
          },
          visual: {
            fill: { kind: "set", value: "#edf7ec" },
            borderColor: { kind: "set", value: "#3851a4" },
            borderWidth: { kind: "set", value: 2 },
          },
          sizing: {
            width: { kind: "set", value: 170 },
            height: { kind: "set", value: 110 },
          },
          placement: { kind: "absolute", x: operation.x, y: operation.y },
          descendantOverrides: [],
        },
        ...childIds.map((childId, index): NodeEntry => ({
          kind: "node",
          id: childId,
          definitionId: "lib:definition:text",
          children: [],
          props: { children: { kind: "set", value: String(index + 1) } },
          visual: {
            fill: { kind: "set", value: index ? "#53a853" : "#e04747" },
          },
          sizing: {
            width: { kind: "set", value: 50 },
            height: { kind: "set", value: 40 },
          },
          descendantOverrides: [],
        })),
      ];
    });
    root.dispatch("G0 public Group inserts: horizontal/sm and vertical/lg", [
      ...nodes.map((entry) => ({ kind: "put" as const, entry })),
      {
        kind: "put",
        entry: {
          ...page,
          children: operations.map(
            (operation) => `project:node:${operation.id}` as NodeEntry["id"],
          ),
        },
      },
    ]);
    const bySource = new Map(
      [...root.canvasInputs.values()].map((input) => [input.sourceId, input]),
    );
    const domBySource = new Map(
      [...root.domInputs.values()].map((input) => [input.sourceId, input]),
    );
    const geometry = root.getGeometry(root.canvasInputs.keys());
    const roots = operations.map(
      (operation) => bySource.get(`project:node:${operation.id}`)!.id,
    );

    // ── 새 Canvas: 공용 renderCommands/CanvasKit, G0 camera 0.8 ──────────
    const bound = bindCatalogCanvas(root, roots);
    let canvasBytes: Uint8Array;
    try {
      const surface = ck.MakeSurface(900, 480)!;
      try {
        const canvas = surface.getCanvas();
        canvas.clear(ck.WHITE);
        canvas.scale(SCALE, SCALE);
        executeRenderCommands(
          ck,
          canvas,
          bound.stream.commands,
          { x: 0, y: 0, width: 900, height: 480 } as DOMRect,
          skiaFontManager.getFontMgr(),
        );
        surface.flush();
        const bytes = surface.makeImageSnapshot().encodeToBytes();
        if (!bytes) throw new Error("GROUP_PAIR_CANVAS_PNG_MISSING");
        canvasBytes = bytes;
        writeFileSync(join(design, "248-phase3-group-pair-canvas.png"), bytes);
      } finally {
        surface.delete();
      }
    } finally {
      bound.dispose();
    }

    // ── 격리 DOM: 같은 resolved 값 → 제품 경로 DOM binding (RAC Group + RAC Text) ─────
    const domTargets = operations.map((operation) => {
      const group = domBySource.get(`project:node:${operation.id}`)!;
      return { id: operation.id, groupId: group.id, childIds: group.children };
    });
    const markup = domTargets
      .map((target) =>
        renderToStaticMarkup(renderCatalogDom(root, target.groupId)),
      )
      .join("");
    const context = await browser.newContext({
      viewport: old.scenario.viewport,
      deviceScaleFactor: 1,
      colorScheme: "light",
    });
    const tab = await context.newPage();
    const fontUrl = `data:font/ttf;base64,${fontBytes.toString("base64")}`;
    await tab.setContent(
      `<style>@font-face{font-family:Pretendard;src:url('${fontUrl}')}html,body{margin:0;background:#fff;font-family:Pretendard,sans-serif;font-size:16px;color:#000}</style><div id="stage" style="width:900px;height:480px;position:relative;overflow:hidden"><div id="scene" style="position:absolute;inset:0;transform:scale(.8);transform-origin:0 0">${markup}</div></div>`,
    );
    await tab.evaluate(() => document.fonts.ready);
    const domBytes = await tab.locator("#stage").screenshot();
    writeFileSync(join(design, "248-phase3-group-pair-dom.png"), domBytes);
    const dom = await tab.evaluate(
      (targets) =>
        targets.map(({ id, groupId, childIds }) => {
          const byId = (catalogId: string) =>
            document.querySelector(`[data-catalog-id="${catalogId}"]`)!;
          const group = byId(groupId);
          const rect = (element: Element) => {
            const value = element.getBoundingClientRect();
            return {
              x: value.x,
              y: value.y,
              width: value.width,
              height: value.height,
            };
          };
          const style = getComputedStyle(group);
          return {
            id,
            role: group.getAttribute("role"),
            ariaOrientation: group.getAttribute("aria-orientation"),
            ariaLabel: group.getAttribute("aria-label"),
            className: group.className,
            groupRect: rect(group),
            childRects: childIds.map((childId) => rect(byId(childId))),
            computed: {
              flexDirection: style.flexDirection,
              gap: style.gap,
              border: style.border,
              backgroundColor: style.backgroundColor,
            },
          };
        }),
      domTargets,
    );
    await context.close();

    const oldBytes = readFileSync(
      join(design, "248-baseline/native-state-pinned/canvas.png"),
    );
    const oldImage = decode(ck, oldBytes);
    const newImage = decode(ck, canvasBytes);
    const domImage = decode(ck, domBytes);
    const scaled = (rect: Rect): Rect => ({
      x: rect.x * SCALE,
      y: rect.y * SCALE,
      width: rect.width * SCALE,
      height: rect.height * SCALE,
    });

    const results = operations.map((operation, index) => {
      const group = bySource.get(`project:node:${operation.id}`)!;
      const children = [0, 1].map((child) =>
        bySource.get(`project:node:${operation.id}-child-${child}`)!,
      );
      const rustGroup = geometry.get(group.id)!;
      const rustChildren = children.map((child) => geometry.get(child.id)!);
      const expected = old.observations.find(
        (item: { semanticId: string }) => item.semanticId === operation.id,
      )!;
      // 절대 좌표 (Rust 자식 layout 은 부모 상대).
      const absoluteChildren = rustChildren.map((child) => ({
        x: rustGroup.x + child.x,
        y: rustGroup.y + child.y,
        width: child.width,
        height: child.height,
      }));
      const groupBox = nodeBox(scaled(rustGroup));
      const textNodeBoxes = absoluteChildren.map((child) =>
        nodeBox(scaled(child)),
      );
      const crop = {
        x: index === 0 ? 20 : 220,
        y: 170,
        width: 150,
        height: 100,
      };
      const l3 = measure(newImage, domImage, groupBox, textNodeBoxes);
      return {
        id: operation.id,
        orientation: operation.orientation,
        size: operation.size,
        resolved: {
          gap: group.visual.gap,
          flexDirection:
            group.props.orientation === "horizontal" ? "row" : "column",
          fill: group.visual.fill,
          border: `${group.visual.borderWidth}px solid ${group.visual.borderColor}`,
        },
        oldG0: { layout: expected.layout, children: expected.children },
        rustGroup,
        rustChildren,
        dom: dom[index],
        geometryDeltaMaxCssPx: Math.max(
          ...[
            [dom[index].groupRect, rustGroup],
            ...dom[index].childRects.map(
              (rect, child) => [rect, absoluteChildren[child]] as const,
            ),
          ].flatMap(([domRect, rust]) =>
            (["x", "y", "width", "height"] as const).map((key) =>
              Math.abs(domRect[key] / SCALE - rust[key]),
            ),
          ),
        ),
        l3NonTextGroupMinusTextNodes: l3,
        l3Verdict: l3.blockedAtNonTextBudget ? "FAIL" : "PASS",
        referenceUnmaskedGroupBox: measure(newImage, domImage, groupBox),
        referenceTextNodeBoxesL4: textNodeBoxes.map((box) =>
          measure(newImage, domImage, box),
        ),
        l3eVerdict: "UNVERIFIED_NO_APPROVED_GROUP_EDGE_BUDGET",
        oldCanvasVsNewCanvasCrop: {
          ...measure(oldImage, newImage, crop),
          disposition:
            "KNOWN_OLD_DEFECT_§6.1_GROUP_ORIENTATION_AND_SIZE_GAP — old/new FAIL recorded, not exempted",
        },
        newCanvasVsDomCrop: measure(newImage, domImage, crop),
      };
    });

    for (const result of results) {
      expect(result.dom.role).toBe("group");
      expect(result.dom.ariaOrientation).toBe(result.orientation);
      expect(result.dom.computed.flexDirection).toBe(
        result.resolved.flexDirection,
      );
      expect(result.dom.computed.gap).toBe(`${result.resolved.gap}px`);
      expect(result.dom.computed.border).toBe("2px solid rgb(56, 81, 164)");
      expect(result.dom.computed.backgroundColor).toBe("rgb(237, 247, 236)");
      expect(result.rustGroup).toMatchObject(result.oldG0.layout);
      expect(result.geometryDeltaMaxCssPx).toBeLessThanOrEqual(1);
    }
    // 새 방향·gap 교정: horizontal/sm 둘째 자식 (58,2), vertical/lg (2,54).
    expect(results[0].rustChildren[1]).toMatchObject({ x: 58, y: 2 });
    expect(results[1].rustChildren[1]).toMatchObject({ x: 2, y: 54 });

    writeFileSync(
      join(design, "248-phase3-group-pair.json"),
      `${JSON.stringify(
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
            screenScale: SCALE,
          },
          method: {
            regions:
              "ADR-198 node-ID regions: Group non-text = Group box − child text-node boxes (mask, Canvas leg geometry); child Text nodes = text kind (L4, reference only)",
            blocking:
              "pixelmatch 0.1; ratio > 0.001 AND maxByte > 2 (INITIAL_BUDGETS.nonText)",
            edge: "L3e budget not applied — no approved Group edge budget",
          },
          old: { screenshotSha256: sha(oldBytes) },
          new: {
            canvasSha256: sha(canvasBytes),
            domSha256: sha(domBytes),
            commandCount: bound.stream.commands.length,
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
                  dirname(require.resolve("canvaskit-wasm/bin/canvaskit.js")),
                  "canvaskit.wasm",
                ),
              ),
            ),
          },
          results,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await browser.close();
    raw.free();
  }
}, 120_000);
