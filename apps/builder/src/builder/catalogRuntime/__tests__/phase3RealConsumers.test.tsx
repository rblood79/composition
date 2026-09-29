// @vitest-environment node
import "fake-indexeddb/auto";
import { baselineCompatibleHead } from "./support/baselineHead";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CanvasKit } from "canvaskit-wasm";
import { Slot } from "../../../../../../packages/shared/src/components/Slot";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { createG1Fixture } from "../../../../../../packages/shared/src/catalog/document/fixture";
import { createPencilFixtureLibrary } from "../../../../../../packages/shared/src/catalog/document/pencilFixtureLibrary";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { createCodeCatalogScenarioLibrary } from "./support/codeCatalogFixtureLibrary";
import { resolveCatalogNode } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import type {
  CatalogEntry,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import { executeRenderCommands } from "../../workspace/canvas/skia/renderCommands";
import type { RenderCommand } from "../../workspace/canvas/skia/renderCommands";
import { initCanvasKit } from "../../workspace/canvas/skia/initCanvasKit";
import { skiaFontManager } from "../../workspace/canvas/skia/fontManager";
import { renderFrameAreaBorder } from "../../workspace/canvas/skia/workflowRenderer";
import {
  renderSelectionBox,
  renderTransformHandles,
} from "../../workspace/canvas/skia/selectionRenderer";
import { cssColorToHex } from "../../workspace/canvas/utils/cssVariableCore";
import { hexToColor4fChannels } from "../../workspace/canvas/skia/themeWatcher";
import { renderBox } from "../../workspace/canvas/skia/nodeRendererBorders";
import { renderSlotHatchPattern } from "../../workspace/canvas/skia/slotMarkerRenderer";
import type { SkiaNodeData } from "../../workspace/canvas/skia/nodeRendererTypes";
import { bindCatalogCanvas } from "./support/catalogCanvasBinding";
import { deriveCatalogSlotOverlayTargets } from "./support/catalogSlotOverlay";
import { CatalogRuntime } from "../controller";
import { CatalogStorage } from "../storage";
import { CatalogCompositionRoot } from "../compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { createTypedSceneFixtures } from "./support/typedSceneFixtures";

const require = createRequire(import.meta.url);
const repoRoot = resolve(process.cwd(), "../..");
const baselineDir = resolve(repoRoot, "docs/adr/design/248-baseline");
const outputDir = resolve(repoRoot, "docs/adr/design");
const fileSha256 = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

interface RawLayout {
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
}
type EngineGlue = {
  __wbg_set_wasm(value: WebAssembly.Exports): void;
  LayoutEngine: new () => RawLayout;
};
let engineGluePromise: Promise<EngineGlue> | undefined;

async function actualLayoutEngine(): Promise<{
  engine: LayoutEngineAPI;
  raw: RawLayout;
}> {
  engineGluePromise ??= (async () => {
    const directory = resolve(
      process.cwd(),
      "src/builder/workspace/canvas/wasm-bindings/engine-pkg",
    );
    const glue = (await import(
      pathToFileURL(join(directory, "engine_bg.js")).href
    )) as EngineGlue;
    const instance = await WebAssembly.instantiate(
      readFileSync(join(directory, "engine_bg.wasm")),
      { "./engine_bg.js": glue },
    );
    glue.__wbg_set_wasm(instance.instance.exports);
    return glue;
  })();
  const glue = await engineGluePromise;
  const raw = new glue.LayoutEngine();
  const engine: LayoutEngineAPI = {
    isAvailable: () => true,
    hasBinaryProtocol: () => false,
    buildTreeBatch: (input) => {
      const handles = [...raw.buildTreeBatch(input)];
      if (!handles.length) throw new Error(`ENGINE_BATCH_EMPTY:${input}`);
      return handles;
    },
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
  };
  return { engine, raw };
}

let canvasKitPromise: Promise<CanvasKit> | undefined;
async function actualCanvasKit(): Promise<CanvasKit> {
  canvasKitPromise ??= (async () => {
    const bin = dirname(require.resolve("canvaskit-wasm/bin/canvaskit.js"));
    const initialize = require(join(bin, "canvaskit.js")) as (options: {
      locateFile(file: string): string;
    }) => Promise<CanvasKit>;
    return initialize({ locateFile: (file) => join(bin, file) });
  })();
  return canvasKitPromise;
}

const color = (hex: string): Float32Array => {
  const value = hex.replace("#", "");
  return Float32Array.of(
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
    1,
  );
};

describe("ADR-248 G3 pinned structural scenario actual consumers", () => {
  it("measures typed Slot sm/md/lg empty, filled and description through Rust and CanvasKit", async () => {
    const library = createPencilFixtureLibrary();
    const { document: seed } = createG1Fixture();
    const page = seed.entries["project:page:main"] as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    const ck = await actualCanvasKit();
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
    const { engine, raw } = await actualLayoutEngine();
    const measureChromeText = (
      text: string,
      fontSize: number,
      _maxWidth: number,
      lineHeight: number,
    ) => {
      const style = new ck.TextStyle({
        fontFamilies: ["Pretendard"],
        fontSize,
        color: ck.BLACK,
      });
      const builder = ck.ParagraphBuilder.MakeFromFontCollection(
        new ck.ParagraphStyle({ textStyle: style }),
        skiaFontManager.getFontCollection(),
      );
      try {
        builder.pushStyle(style);
        builder.addText(text);
        const paragraph = builder.build();
        try {
          paragraph.layout(100000);
          return {
            width: paragraph.getLongestLine(),
            height: paragraph.getLineMetrics().length * fontSize * lineHeight,
          };
        } finally {
          paragraph.delete();
        }
      } finally {
        builder.delete();
      }
    };
    const sizes = ["sm", "md", "lg"] as const;
    const states = ["empty", "filled", "description"] as const;
    const scenario = {
      id: "adr248-slot-typed-matrix-v1",
      sizes,
      states,
      description: "Two line note here",
      width: 160,
      placement: { x: 10, y: 10 },
      required: true,
      filledText: "Filled",
    };
    const scenarioHash = createHash("sha256")
      .update(JSON.stringify(scenario))
      .digest("hex");
    const expected = {
      sm: { minHeight: 40, padding: 8, gap: 4, radius: 6, fontSize: 12 },
      md: { minHeight: 60, padding: 12, gap: 8, radius: 6, fontSize: 14 },
      lg: { minHeight: 80, padding: 16, gap: 12, radius: 8, fontSize: 16 },
    };
    const rows: Array<Record<string, unknown>> = [];
    const emptyScenePixels = new Map<string, Uint8Array>();
    try {
      for (const size of sizes)
        for (const state of states) {
          const slotId = `project:node:slot${size}${state}` as NodeEntry["id"];
          const childId = `project:node:text${size}${state}` as NodeEntry["id"];
          const filled = state === "filled";
          const slot: NodeEntry = {
            kind: "node",
            id: slotId,
            definitionId: "lib:definition:slot",
            name: "content",
            slot: { name: "content", required: true },
            children: filled ? [childId] : [],
            props: {
              size: { kind: "set", value: size },
              ...(state === "description"
                ? {
                    description: {
                      kind: "set" as const,
                      value: scenario.description,
                    },
                  }
                : {}),
            },
            visual: {},
            sizing: { width: { kind: "set", value: scenario.width } },
            placement: { kind: "absolute", ...scenario.placement },
            descendantOverrides: [],
          };
          const child: NodeEntry = {
            kind: "node",
            id: childId,
            definitionId: "lib:definition:text",
            children: [],
            props: { children: { kind: "set", value: "Filled" } },
            visual: {},
            sizing: {
              width: { kind: "set", value: 120 },
              height: { kind: "set", value: 20 },
            },
            descendantOverrides: [],
          };
          const graph = new CatalogGraph(
            {
              ...seed,
              entries: {
                [seed.projectId]: seed.entries[seed.projectId],
                [page.id]: { ...page, children: [slotId] },
                [slotId]: slot,
                ...(filled ? { [childId]: child } : {}),
              },
            },
            library,
          );
          const root = new CatalogCompositionRoot(
            new CatalogRuntime(
              graph,
              new CatalogStorage(indexedDB, `adr248-slot-${size}-${state}`),
            ),
            engine,
            { width: 1440, height: 900 },
            undefined,
            {
              editMode: true,
              requiredLabel: "Required",
              measureText: measureChromeText,
            },
          );
          const resolved = [...root.canvasInputs.values()].find(
            (node) => node.sourceId === slotId,
          )!;
          if (size === "sm" && state === "empty") {
            const revision = graph.revision;
            let failure: unknown;
            try {
              root.dispatch("reject unknown Slot size", [
                {
                  kind: "patchNodeProp",
                  id: slotId,
                  key: "size",
                  write: { kind: "set", value: "xl" },
                },
              ]);
            } catch (error) {
              failure = error;
            }
            expect(failure).toMatchObject({ code: "PROP_CHOICE_MISMATCH" });
            expect(graph.revision).toBe(revision);
          }
          expect(resolved.visual).toMatchObject(expected[size]);
          expect(resolved.sizing.height).toBeUndefined();
          const rect = root.getGeometry([resolved.id]).get(resolved.id)!;
          expect(rect.height).toBeGreaterThanOrEqual(expected[size].minHeight);
          const chrome = root.slotChromeInputs.get(resolved.id);
          expect(Boolean(chrome)).toBe(!filled);
          if (!filled && chrome) {
            const pieces = root.getGeometry([
              chrome.id,
              chrome.iconId,
              chrome.nameId,
              chrome.descriptionId,
            ]);
            expect(pieces.get(chrome.iconId)?.height).toBe(chrome.iconSize);
            expect(pieces.get(chrome.nameId)?.height).toBe(chrome.nameHeight);
            expect(pieces.get(chrome.descriptionId)?.height).toBe(
              chrome.descriptionHeight,
            );
            expect(pieces.get(chrome.id)?.height).toBe(chrome.height);
          }
          if (size === "sm" && state === "empty") {
            const unaffected = { calls: 0 };
            const unsubscribe = root.subscribeCanvas(
              "project:node:unrelated::project:node:unrelated",
              () => unaffected.calls++,
            );
            const edit = root.dispatch("edit Slot description", [
              {
                kind: "patchNodeProp",
                id: slotId,
                key: "description",
                write: { kind: "set", value: scenario.description },
              },
            ]);
            expect(edit.changedIds).toContain(slotId);
            expect(root.metrics.layoutInputVisits).toBe(1);
            expect(
              root.getGeometry([resolved.id]).get(resolved.id)?.height,
            ).toBe(54);
            expect(
              graph.getEntry(`${resolved.id}::editor-placeholder`),
            ).toBeUndefined();
            root.undo();
            expect(
              root.getGeometry([resolved.id]).get(resolved.id)?.height,
            ).toBe(42);
            root.redo();
            expect(
              root.getGeometry([resolved.id]).get(resolved.id)?.height,
            ).toBe(54);
            root.undo();
            expect(
              root.getGeometry([resolved.id]).get(resolved.id)?.height,
            ).toBe(42);
            expect(unaffected.calls).toBe(0);
            unsubscribe();
          }
          const targets = deriveCatalogSlotOverlayTargets(root, {
            editMode: true,
            pageId: page.id,
            roles: new Map([[resolved.id, "origin"]]),
          });
          expect(targets).toHaveLength(filled ? 0 : 1);
          const bound = bindCatalogCanvas(root, [resolved.id]);
          try {
            const slotDraw = bound.stream.commands.find(
              (command) =>
                command.type === 1 &&
                command.skiaData.elementId === resolved.id,
            );
            expect(slotDraw).toMatchObject({
              skiaData: {
                box: {
                  borderRadius: expected[size].radius,
                  strokeStyle: "dashed",
                  strokeWidth: 1,
                },
              },
            });
            const textDraws = bound.stream.commands.filter(
              (command) => command.type === 1 && command.nodeType === "text",
            ).length;
            const textPaintCommands = bound.stream.commands
              .filter(
                (command): command is Extract<RenderCommand, { type: 1 }> =>
                  command.type === 1,
              )
              .filter((command) => command.nodeType === "text")
              .map((command) => ({
                id: command.skiaData.elementId,
                x: command.skiaData.x,
                y: command.skiaData.y,
                width: command.skiaData.width,
                height: command.skiaData.height,
                fontSize: command.skiaData.text?.fontSize,
                lineHeight: command.skiaData.text?.lineHeight,
                fontWeight: command.skiaData.text?.fontWeight ?? 400,
                content: command.skiaData.text?.content,
              }));
            expect(textPaintCommands).toHaveLength(textDraws);
            expect(textDraws).toBe(
              filled ? 1 : state === "description" ? 3 : 2,
            );
            expect(
              bound.stream.commands.filter(
                (command) =>
                  command.type === 1 && command.nodeType === "icon_path",
              ),
            ).toHaveLength(filled ? 0 : 1);
            if (filled) {
              const pageBinding = bindCatalogCanvas(
                root,
                [resolved.id],
                undefined,
                { slotMode: "page" },
              );
              try {
                expect(
                  pageBinding.stream.commands.some(
                    (command) =>
                      command.type === 1 &&
                      command.skiaData.elementId === resolved.id,
                  ),
                ).toBe(false);
                expect(
                  pageBinding.stream.commands.filter(
                    (command) =>
                      command.type === 1 && command.nodeType === "text",
                  ),
                ).toHaveLength(1);
                expect(
                  deriveCatalogSlotOverlayTargets(root, {
                    editMode: false,
                    pageId: page.id,
                    roles: new Map([[resolved.id, "origin"]]),
                  }),
                ).toEqual([]);
              } finally {
                pageBinding.dispose();
              }
            }
            const surface = ck.MakeSurface(220, 160)!;
            try {
              const canvas = surface.getCanvas();
              canvas.clear(ck.WHITE);
              executeRenderCommands(
                ck,
                canvas,
                bound.stream.commands,
                { x: 0, y: 0, width: 220, height: 160 } as DOMRect,
                skiaFontManager.getFontMgr(),
              );
              surface.flush();
              const readPixels = () =>
                canvas.readPixels(0, 0, {
                  width: 220,
                  height: 160,
                  colorType: ck.ColorType.RGBA_8888,
                  alphaType: ck.AlphaType.Unpremul,
                  colorSpace: ck.ColorSpace.SRGB,
                }) as Uint8Array;
              const scenePixels = readPixels();
              const chromeRect = chrome
                ? root.getGeometry([chrome.id]).get(chrome.id)
                : undefined;
              const darkPixels = (bounds: {
                x: number;
                y: number;
                width: number;
                height: number;
              }) => {
                let count = 0;
                for (
                  let y = Math.max(0, Math.floor(bounds.y));
                  y < Math.min(160, Math.ceil(bounds.y + bounds.height));
                  y++
                )
                  for (
                    let x = Math.max(0, Math.floor(bounds.x));
                    x < Math.min(220, Math.ceil(bounds.x + bounds.width));
                    x++
                  ) {
                    const index = (y * 220 + x) * 4;
                    if (
                      scenePixels[index] < 120 &&
                      scenePixels[index + 1] < 120 &&
                      scenePixels[index + 2] < 120
                    )
                      count++;
                  }
                return count;
              };
              const chromeOrigin =
                chrome && chromeRect
                  ? { x: rect.x + chromeRect.x, y: rect.y + chromeRect.y }
                  : undefined;
              const chromePaintBounds =
                chrome && chromeOrigin
                  ? {
                      icon: {
                        x: chromeOrigin.x,
                        y:
                          chromeOrigin.y +
                          Math.round((chrome.height - chrome.iconSize) / 2),
                        width: chrome.iconSize,
                        height: chrome.iconSize,
                      },
                      name: {
                        x: chromeOrigin.x + chrome.iconSize + chrome.iconGap,
                        y:
                          chromeOrigin.y +
                          (chrome.height -
                            chrome.nameHeight -
                            chrome.descriptionHeight) /
                            2,
                        width: chrome.nameWidth,
                        height: chrome.nameHeight,
                      },
                      required: {
                        x:
                          chromeOrigin.x +
                          chrome.iconSize +
                          chrome.iconGap +
                          chrome.nameWidth,
                        y:
                          chromeOrigin.y +
                          (chrome.height -
                            chrome.nameHeight -
                            chrome.descriptionHeight) /
                            2,
                        width: Math.max(1, chrome.textWidth - chrome.nameWidth),
                        height: chrome.nameHeight,
                      },
                      description: {
                        x: chromeOrigin.x + chrome.iconSize + chrome.iconGap,
                        y:
                          chromeOrigin.y +
                          (chrome.height -
                            chrome.nameHeight -
                            chrome.descriptionHeight) /
                            2 +
                          chrome.nameHeight,
                        width: chrome.textWidth,
                        height: chrome.descriptionHeight,
                      },
                    }
                  : undefined;
              const childResolved = filled
                ? [...root.canvasInputs.values()].find(
                    (node) => node.sourceId === childId,
                  )
                : undefined;
              const childRect = childResolved
                ? root.getGeometry([childResolved.id]).get(childResolved.id)
                : undefined;
              const filledTextBounds = childRect
                ? {
                    x: rect.x + childRect.x,
                    y: rect.y + childRect.y,
                    width: childRect.width,
                    height: childRect.height,
                  }
                : undefined;
              const chromeDarkPixels = chromePaintBounds
                ? Object.fromEntries(
                    Object.entries(chromePaintBounds).map(([key, bounds]) => [
                      key,
                      darkPixels(bounds),
                    ]),
                  )
                : undefined;
              if (chromeDarkPixels) {
                expect(chromeDarkPixels.icon).toBeGreaterThan(0);
                expect(chromeDarkPixels.name).toBeGreaterThan(0);
                expect(chromeDarkPixels.required).toBeGreaterThan(0);
                if (state === "description")
                  expect(chromeDarkPixels.description).toBeGreaterThan(0);
              }
              const scenePng = surface.makeImageSnapshot().encodeToBytes();
              if (!scenePng) throw new Error("SLOT_SCENE_PNG_REQUIRED");
              const sceneName = `248-phase3-slot-matrix-${size}-${state}-scene.png`;
              writeFileSync(join(outputDir, sceneName), scenePng);
              if (state === "empty") emptyScenePixels.set(size, scenePixels);
              let filledTextPixelDiff = 0;
              if (state === "filled") {
                const empty = emptyScenePixels.get(size)!;
                for (let index = 0; index < scenePixels.length; index += 4)
                  if (
                    scenePixels[index] !== empty[index] ||
                    scenePixels[index + 1] !== empty[index + 1] ||
                    scenePixels[index + 2] !== empty[index + 2]
                  )
                    filledTextPixelDiff++;
                expect(filledTextPixelDiff).toBeGreaterThan(0);
              }
              for (const target of targets)
                renderSlotHatchPattern(
                  ck,
                  canvas,
                  target.bounds,
                  1,
                  target.slotMarkerRole,
                );
              surface.flush();
              const pixels = readPixels();
              let overlayPixelDiff = 0;
              for (let index = 0; index < pixels.length; index += 4)
                if (
                  pixels[index] !== scenePixels[index] ||
                  pixels[index + 1] !== scenePixels[index + 1] ||
                  pixels[index + 2] !== scenePixels[index + 2]
                )
                  overlayPixelDiff++;
              expect(overlayPixelDiff > 0).toBe(!filled);
              const nonwhite = pixels.reduce(
                (count, value, index) =>
                  index % 4 === 0 &&
                  (value !== 255 ||
                    pixels[index + 1] !== 255 ||
                    pixels[index + 2] !== 255)
                    ? count + 1
                    : count,
                0,
              );
              expect(nonwhite).toBeGreaterThan(0);
              const png = surface.makeImageSnapshot().encodeToBytes();
              if (!png) throw new Error("SLOT_MATRIX_PNG_REQUIRED");
              const name = `248-phase3-slot-matrix-${size}-${state}.png`;
              writeFileSync(join(outputDir, name), png);
              rows.push({
                size,
                state,
                visual: resolved.visual,
                sizing: resolved.sizing,
                geometry: rect,
                chrome: root.slotChromeInputs.get(resolved.id),
                chromeGeometry: root
                  .getGeometry([`${resolved.id}::editor-placeholder`])
                  .get(`${resolved.id}::editor-placeholder`),
                canvas: {
                  png: name,
                  scenePng: sceneName,
                  nonwhite,
                  textDraws,
                  filledTextPixelDiff,
                  overlayPixelDiff,
                  chromePaintBounds,
                  filledTextBounds,
                  textPaintCommands,
                  chromeDarkPixels,
                  chromePaintCommands: bound.stream.commands.flatMap(
                    (command) =>
                      command.type === 1 &&
                      command.skiaData.elementId?.includes("::editor-")
                        ? [
                            {
                              id: command.skiaData.elementId,
                              type: command.nodeType,
                              x: command.skiaData.x,
                              y: command.skiaData.y,
                              width: command.skiaData.width,
                              height: command.skiaData.height,
                              text: command.skiaData.text?.content,
                            },
                          ]
                        : [],
                  ),
                },
                overlayTargets: targets.map((target) => ({
                  id: target.id,
                  bounds: target.bounds,
                  role: target.slotMarkerRole,
                })),
                canvasPlaceholderIconNameRequiredDescription: filled
                  ? "NOT_APPLICABLE"
                  : "PAINT_COMMANDS_PRESENT",
              });
            } finally {
              surface.delete();
            }
          } finally {
            bound.dispose();
          }
        }
      writeFileSync(
        join(outputDir, "248-phase3-slot-matrix-canvas.json"),
        JSON.stringify(
          {
            head: execFileSync("git", ["rev-parse", "HEAD"], {
              cwd: repoRoot,
              encoding: "utf8",
            }).trim(),
            scenarioId: scenario.id,
            scenarioHash,
            viewport: { width: 1440, height: 900 },
            dpr: 1,
            font: "Pretendard",
            fontSha256: fileSha256(
              resolve(process.cwd(), "public/fonts/PretendardVariable.ttf"),
            ),
            theme: "default-light",
            seed: 248,
            libraryRevision: library.revision,
            rows,
          },
          null,
          2,
        ),
      );
    } finally {
      raw.free();
    }
  });
  it("records the G0 native-state Frame and Group geometry through the real Rust consumer", async () => {
    const old = JSON.parse(
      readFileSync(
        join(baselineDir, "native-state-pinned/baseline.json"),
        "utf8",
      ),
    ) as {
      head: string;
      executionBuildIdentity: string;
      buildIndexSha256: string;
      scenarioHash: string;
      scenario: {
        id: string;
        seed: number;
        viewport: { width: number; height: number };
        dpr: number;
        theme: string;
        font: string;
        operations: Array<{
          op: string;
          id: string;
          x: number;
          y: number;
          clip?: boolean;
          overflow?: "visible" | "hidden";
          orientation?: "horizontal" | "vertical";
          size?: string;
        }>;
      };
      observations: Array<{
        semanticId: string;
        layout: { x: number; y: number; width: number; height: number };
        children: Array<{
          layout: { x: number; y: number; width: number; height: number };
        }>;
      }>;
      clipPixelSamples: Record<string, Record<string, number[]>>;
    };
    const pairedOld = JSON.parse(
      readFileSync(
        join(outputDir, "248-phase3-native-old-current/baseline.json"),
        "utf8",
      ),
    ) as typeof old;
    expect(pairedOld.scenarioHash).toBe(old.scenarioHash);
    expect(pairedOld.scenario).toEqual(old.scenario);
    const executionHead = baselineCompatibleHead(repoRoot, old.head);
    expect(pairedOld.head).toBe(old.head);
    expect(old.scenario.id).toBe("adr248-old-native-state-v1");
    const currentBuilderBuildIndexSha256 = createHash("sha256")
      .update(readFileSync(resolve(repoRoot, "apps/builder/dist/index.html")))
      .digest("hex");
    expect(pairedOld.head).toBe(old.head);
    const { document } = createG1Fixture();
    const page = document.entries["project:page:main"] as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    const library = createPencilFixtureLibrary();
    const graph = new CatalogGraph(
      {
        ...document,
        entries: {
          [document.projectId]: document.entries[document.projectId],
          [page.id]: { ...page, children: [] },
        },
      },
      library,
    );
    const { engine, raw } = await actualLayoutEngine();
    try {
      const root = new CatalogCompositionRoot(
        new CatalogRuntime(
          graph,
          new CatalogStorage(indexedDB, `adr248-native-${Date.now()}`),
        ),
        engine,
        old.scenario.viewport,
      );
      const nodes: NodeEntry[] = old.scenario.operations.flatMap(
        (operation) => {
          const group = operation.op === "insertGroupWithChildren";
          const id = `project:node:${operation.id}` as NodeEntry["id"];
          const childIds = (group ? [0, 1] : [0]).map(
            (index) =>
              `project:node:${operation.id}-child-${index}` as NodeEntry["id"],
          );
          const parent: NodeEntry = {
            kind: "node",
            id,
            definitionId: group
              ? "lib:definition:group"
              : "lib:definition:frame",
            children: childIds,
            props: {
              ...(operation.orientation
                ? {
                    orientation: {
                      kind: "set",
                      value: operation.orientation,
                    } as const,
                  }
                : {}),
              ...(operation.size
                ? { size: { kind: "set", value: operation.size } as const }
                : {}),
            },
            visual: {
              fill: { kind: "set", value: group ? "#edf7ec" : "#dbe7ff" },
              borderColor: { kind: "set", value: "#3851a4" },
              borderWidth: { kind: "set", value: 2 },
              ...(operation.overflow
                ? {
                    overflow: {
                      kind: "set",
                      value: operation.overflow,
                    } as const,
                  }
                : {}),
            },
            sizing: {
              width: { kind: "set", value: group ? 170 : 130 },
              height: { kind: "set", value: group ? 110 : 100 },
            },
            placement: {
              kind: "absolute",
              x: operation.x,
              y: operation.y,
            },
            descendantOverrides: [],
          };
          return [
            parent,
            ...childIds.map((childId, index): NodeEntry => ({
              kind: "node",
              id: childId,
              definitionId: "lib:definition:text",
              children: [],
              props: { children: { kind: "set", value: String(index + 1) } },
              visual: {
                fill: {
                  kind: "set",
                  value: index ? "#53a853" : "#e04747",
                },
              },
              sizing: {
                width: { kind: "set", value: group ? 50 : 100 },
                height: { kind: "set", value: 40 },
              },
              ...(!group
                ? { placement: { kind: "absolute" as const, x: 90, y: 30 } }
                : {}),
              descendantOverrides: [],
            })),
          ];
        },
      );
      root.dispatch("G0 native insert", [
        ...nodes.map((entry) => ({ kind: "put" as const, entry })),
        {
          kind: "put",
          entry: {
            ...page,
            children: old.scenario.operations.map(
              (operation) => `project:node:${operation.id}` as NodeEntry["id"],
            ),
          },
        },
      ]);
      const bySource = new Map(
        [...root.layoutInputs.values()].map((input) => [input.sourceId, input]),
      );
      const geometry = root.getGeometry([...root.layoutInputs.keys()]);
      const observed = old.scenario.operations.map((operation) => {
        const id = `project:node:${operation.id}`;
        const parent = bySource.get(id)!;
        return {
          semanticId: operation.id,
          overflow: parent.visual.overflow ?? null,
          layout: geometry.get(parent.id),
          children: parent.children.map((child) => geometry.get(child)),
        };
      });
      const difference = observed.map((item) => {
        const prior = pairedOld.observations.find(
          (entry) => entry.semanticId === item.semanticId,
        )!;
        const sameRect = (
          actual: typeof item.layout,
          expected: typeof prior.layout,
        ) =>
          actual?.x === expected.x &&
          actual.y === expected.y &&
          actual.width === expected.width &&
          actual.height === expected.height;
        return {
          semanticId: item.semanticId,
          parentMatches: sameRect(item.layout, prior.layout),
          childrenMatch: item.children.map((child, index) =>
            sameRect(child, prior.children[index].layout),
          ),
        };
      });
      expect(observed).toHaveLength(5);
      expect(
        difference.find((item) => item.semanticId === "group-horizontal")
          ?.childrenMatch,
      ).toEqual([true, false]);
      expect(
        difference.find((item) => item.semanticId === "group-vertical")
          ?.childrenMatch,
      ).toEqual([true, false]);
      expect(
        observed.find((item) => item.semanticId === "group-horizontal")
          ?.children[1],
      ).toMatchObject({ x: 58, y: 2 });
      expect(
        observed.find((item) => item.semanticId === "group-vertical")
          ?.children[1],
      ).toMatchObject({ x: 2, y: 54 });
      const ck = await actualCanvasKit();
      const surface = ck.MakeSurface(900, 480)!;
      const clipSamples: Record<string, number[]> = {};
      try {
        const canvas = surface.getCanvas();
        canvas.clear(ck.WHITE);
        canvas.scale(0.8, 0.8);
        for (const item of observed.slice(0, 3)) {
          const parent = item.layout!;
          const child = item.children[0]!;
          canvas.save();
          canvas.translate(parent.x, parent.y);
          if (item.overflow === "hidden")
            canvas.clipRect(
              ck.LTRBRect(0, 0, parent.width, parent.height),
              ck.ClipOp.Intersect,
              true,
            );
          canvas.save();
          canvas.translate(child.x, child.y);
          renderBox(ck, canvas, {
            type: "box",
            x: 0,
            y: 0,
            width: child.width,
            height: child.height,
            visible: true,
            box: { fillColor: color("#e04747"), borderRadius: 0 },
          });
          canvas.restore();
          canvas.restore();
        }
        surface.flush();
        const pixels = canvas.readPixels(0, 0, {
          width: 900,
          height: 480,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Unpremul,
          colorSpace: ck.ColorSpace.SRGB,
        }) as Uint8Array;
        for (const [name, x] of [
          ["clipTrueVisibleOutside", 150],
          ["clipFalseHiddenOutside", 350],
          ["clipTrueHiddenOutside", 550],
        ] as const) {
          const offset = (60 * 900 + x) * 4;
          clipSamples[name] = [...pixels.slice(offset, offset + 4)];
        }
        expect(clipSamples).toEqual(pairedOld.clipPixelSamples.before);
        const png = surface.makeImageSnapshot().encodeToBytes();
        if (!png) throw new Error("NATIVE_FRAME_CLIP_PNG_REQUIRED");
        writeFileSync(join(outputDir, "248-phase3-native-state-new.png"), png);
      } finally {
        surface.delete();
      }
      let boundScene: ReturnType<typeof bindCatalogCanvas> | undefined;
      let commandCount = 0;
      let clippedGroupCount = 0;
      const commandClipSamples: Record<string, number[]> = {};
      try {
        const rootIds = old.scenario.operations.map(
          (operation) => bySource.get(`project:node:${operation.id}`)!.id,
        );
        boundScene = bindCatalogCanvas(root, rootIds);
        const { stream } = boundScene;
        commandCount = stream.commands.length;
        clippedGroupCount = stream.commands.filter(
          (command) => command.type === 2 && command.clipChildren,
        ).length;
        expect(clippedGroupCount).toBe(2);
        const commandSurface = ck.MakeSurface(900, 480)!;
        try {
          const canvas = commandSurface.getCanvas();
          canvas.clear(ck.WHITE);
          canvas.scale(0.8, 0.8);
          executeRenderCommands(ck, canvas, stream.commands, {
            x: 0,
            y: 0,
            width: 900,
            height: 480,
          } as DOMRect);
          commandSurface.flush();
          const pixels = canvas.readPixels(0, 0, {
            width: 900,
            height: 480,
            colorType: ck.ColorType.RGBA_8888,
            alphaType: ck.AlphaType.Unpremul,
            colorSpace: ck.ColorSpace.SRGB,
          }) as Uint8Array;
          for (const [name, x] of [
            ["clipTrueVisibleOutside", 150],
            ["clipFalseHiddenOutside", 350],
            ["clipTrueHiddenOutside", 550],
          ] as const) {
            const offset = (60 * 900 + x) * 4;
            commandClipSamples[name] = [...pixels.slice(offset, offset + 4)];
          }
          expect(commandClipSamples).toEqual(pairedOld.clipPixelSamples.before);
          const png = commandSurface.makeImageSnapshot().encodeToBytes();
          if (!png) throw new Error("NATIVE_RENDER_COMMAND_PNG_REQUIRED");
          writeFileSync(
            join(outputDir, "248-phase3-native-render-commands.png"),
            png,
          );
        } finally {
          commandSurface.delete();
        }
      } finally {
        boundScene?.dispose();
      }
      writeFileSync(
        join(outputDir, "248-phase3-native-state-new.json"),
        JSON.stringify(
          {
            executionHead,
            oldExecutionBuildIdentity: old.executionBuildIdentity,
            pinnedOldBuildIndexSha256: old.buildIndexSha256,
            pairedOldExecutionBuildIdentity: pairedOld.executionBuildIdentity,
            pairedOldBuildIndexSha256: pairedOld.buildIndexSha256,
            currentBuilderBuildIndexSha256,
            newExecutionAssetsSha256: {
              compositionRoot: createHash("sha256")
                .update(
                  readFileSync(
                    resolve(
                      process.cwd(),
                      "src/builder/catalogRuntime/compositionRoot.ts",
                    ),
                  ),
                )
                .digest("hex"),
              rustWasm: createHash("sha256")
                .update(
                  readFileSync(
                    resolve(
                      process.cwd(),
                      "src/builder/workspace/canvas/wasm-bindings/engine-pkg/engine_bg.wasm",
                    ),
                  ),
                )
                .digest("hex"),
              font: createHash("sha256")
                .update(
                  readFileSync(
                    resolve(
                      process.cwd(),
                      "public/fonts/PretendardVariable.ttf",
                    ),
                  ),
                )
                .digest("hex"),
            },
            buildMatched:
              pairedOld.buildIndexSha256 === currentBuilderBuildIndexSha256,
            buildMatchScope:
              pairedOld.buildIndexSha256 === currentBuilderBuildIndexSha256
                ? "BUILDER_DIST_INDEX_ONLY"
                : "DIST_INDEX_CHANGED_AFTER_OLD_TRACE",
            executionModuleIdentityParity: "UNVERIFIED_DEV_SERVER_VS_VITEST",
            scenarioId: old.scenario.id,
            scenarioHash: old.scenarioHash,
            viewport: old.scenario.viewport,
            dpr: old.scenario.dpr,
            theme: old.scenario.theme,
            font: old.scenario.font,
            seed: old.scenario.seed,
            observed,
            oldGeometry: pairedOld.observations,
            difference,
            oldClipPixelSamples: pairedOld.clipPixelSamples,
            canvasKitClipPixelSamples: clipSamples,
            renderCommandCount: commandCount,
            renderCommandBindingIds: boundScene?.bindingIds,
            renderCommandClippedGroups: clippedGroupCount,
            renderCommandClipPixelSamples: commandClipSamples,
            actualCanvasClipPixels:
              "PASS_NATIVE_FRAME_CLIP_SAMPLES_IN_RENDER_COMMANDS; page outline and Text paint unverified in native-state fixture",
            knownOldDefect: {
              oldHorizontalSecondChild: { x: 2, y: 42 },
              newHorizontalSecondChild: { x: 58, y: 2 },
              oldVerticalSecondChild: { x: 2, y: 42 },
              newVerticalSecondChild: { x: 2, y: 54 },
              decision:
                "ADR_248_3_6_AND_6_1_HORIZONTAL_ROW_VERTICAL_COLUMN_SIZE_GAP",
              numericParity: "FAIL_NO_AUTOMATIC_EXCEPTION",
            },
            verdict: "FAIL_OLD_NUMERIC_PARITY_INTENTIONAL_GROUP_CORRECTION",
          },
          null,
          2,
        ),
      );
    } finally {
      raw.free();
    }
  });
  it("compares four G0 isolated Group/Slot semantic outputs through the product DOM binding", async () => {
    const old = JSON.parse(
      readFileSync(join(baselineDir, "dom-native-pinned.json"), "utf8"),
    ) as {
      head: string;
      executionBuildIdentity: string;
      scenarioHash: string;
      scenario: {
        id: string;
        viewport: { width: number; height: number };
        dpr: number;
        theme: string;
        font: string;
        seed: number;
      };
      html: Record<
        "groupHorizontal" | "groupVertical" | "slotEmpty" | "slotFilled",
        string
      >;
    };
    expect(old.scenario.id).toBe("adr248-native-dom-unit-v1");
    const executionHead = baselineCompatibleHead(repoRoot, old.head);
    const { document } = createG1Fixture();
    const project = document.entries[document.projectId];
    const page = document.entries["project:page:main"] as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    const groupId = "project:node:group-1" as NodeEntry["id"];
    const slotId = "project:node:slot-content" as NodeEntry["id"];
    const childId = "project:node:filled-text" as NodeEntry["id"];
    const group: NodeEntry = {
      kind: "node",
      id: groupId,
      definitionId: "lib:definition:group",
      children: [],
      props: {
        orientation: { kind: "set", value: "horizontal" },
        label: { kind: "set", value: "Example group" },
        "aria-label": { kind: "set", value: "Example group" },
        isDisabled: { kind: "set", value: true },
      },
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    const slot: NodeEntry = {
      kind: "node",
      id: slotId,
      definitionId: "lib:definition:slot",
      children: [],
      props: { description: { kind: "set", value: "첫째 줄\n둘째 줄" } },
      visual: {},
      sizing: {},
      slot: { name: "content", required: true },
      descendantOverrides: [],
    };
    const child: NodeEntry = {
      kind: "node",
      id: childId,
      definitionId: "lib:definition:text",
      children: [],
      props: { children: { kind: "set", value: "채운 내용" } },
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    const graph = new CatalogGraph(
      {
        ...document,
        entries: {
          [document.projectId]: project,
          [page.id]: { ...page, children: [groupId, slotId] },
          [groupId]: group,
          [slotId]: slot,
        },
      },
      createPencilFixtureLibrary(),
    );
    // Product-path DOM binding (`catalogRuntime/domBinding`) over the composition root.
    const { engine, raw } = await actualLayoutEngine();
    const root = new CatalogCompositionRoot(
      new CatalogRuntime(
        graph,
        new CatalogStorage(indexedDB, `adr248-native-dom-${Date.now()}`),
      ),
      engine,
      old.scenario.viewport,
    );
    const recordOf = (sourceId: string) =>
      [...root.domInputs.values()].find((node) => node.sourceId === sourceId)!;
    const wrap = (id: string, slotMode?: "edit" | "page") =>
      renderToStaticMarkup(
        createElement("div", null, renderCatalogDom(root, id, { slotMode })),
      );
    /**
     * Semantic comparison with the frozen old-app HTML. Excluded, and recorded below:
     * element identity attributes (`id`, `data-element-id`, `data-catalog-id`), inline style
     * (the resolved values; old G0 unit output had none), Group `aria-orientation` (old app never
     * emitted it — §6.1 known defect; the new value must equal the resolved orientation) and the
     * RAC `Text` class on text content (D1: RAC Text instead of a bare span).
     */
    const excluded: Record<string, string[]> = {};
    const semantic = (key: string, html: string) =>
      html.replace(
        / (id|data-element-id|data-catalog-id|style|aria-orientation)="[^"]*"| class="react-aria-Text"/g,
        (match) => {
          (excluded[key] ??= []).push(match.trim());
          return "";
        },
      );
    const groupHtml = (orientation: "horizontal" | "vertical") => {
      const input = recordOf(groupId);
      expect(input.props.orientation).toBe(orientation);
      const html = wrap(input.id);
      expect(html).toContain(`aria-orientation="${orientation}"`);
      return html;
    };
    const horizontal = groupHtml("horizontal");
    root.dispatch("Group orientation", [
      {
        kind: "patchNodeProp",
        id: groupId,
        key: "orientation",
        write: { kind: "set", value: "vertical" },
      },
    ]);
    const vertical = groupHtml("vertical");
    const empty = wrap(recordOf(slotId).id, "edit");
    root.dispatch("Fill Slot", [
      { kind: "put", entry: child },
      { kind: "put", entry: { ...slot, children: [childId] } },
    ]);
    const filled = wrap(recordOf(slotId).id, "page");
    raw.free();
    const actual = {
      groupHorizontal: horizontal,
      groupVertical: vertical,
      slotEmpty: empty,
      slotFilled: filled,
    };
    for (const key of Object.keys(actual) as Array<keyof typeof actual>)
      expect(semantic(key, actual[key])).toBe(
        old.html[key].replace(/ (id|data-element-id)="[^"]*"/g, ""),
      );
    writeFileSync(
      join(outputDir, "248-phase3-native-dom-comparison.json"),
      JSON.stringify(
        {
          oldHead: old.head,
          executionHead,
          oldExecutionBuildIdentity: old.executionBuildIdentity,
          currentBuilderBuildIndexSha256: createHash("sha256")
            .update(
              readFileSync(resolve(repoRoot, "apps/builder/dist/index.html")),
            )
            .digest("hex"),
          scenarioId: old.scenario.id,
          scenarioHash: old.scenarioHash,
          viewport: old.scenario.viewport,
          dpr: old.scenario.dpr,
          theme: old.scenario.theme,
          font: old.scenario.font,
          seed: old.scenario.seed,
          semanticCases: 4,
          consumer: "catalogRuntime/domBinding (product path)",
          actual,
          excludedFromComparison: excluded,
          old: old.html,
          result: "PASS_ISOLATED_STATIC_DOM_SEMANTIC_ONLY",
          visualGeometryPixelParity: "UNVERIFIED",
        },
        null,
        2,
      ),
    );
  });
  it("loads three typed catalog scenes (rectangle+text, clipped regions, composite ref) into real layout and CanvasKit without claiming old visual parity", async () => {
    const ck = await actualCanvasKit();
    const library = createPencilFixtureLibrary();
    const executionHead = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    const currentBuilderBuildIndexSha256 = createHash("sha256")
      .update(readFileSync(resolve(repoRoot, "apps/builder/dist/index.html")))
      .digest("hex");
    const results = [];
    for (const { name, document } of createTypedSceneFixtures()) {
      const graph = new CatalogGraph(document, library);
      const { engine, raw } = await actualLayoutEngine();
      try {
        const root = new CatalogCompositionRoot(
          new CatalogRuntime(
            graph,
            new CatalogStorage(indexedDB, `adr248-typed-scene-${name}`),
          ),
          engine,
          { width: 1440, height: 900 },
        );
        const originalIds = [...root.layoutInputs.keys()];
        const originalGeometry = root.getGeometry(originalIds);
        expect(originalGeometry.size).toBe(originalIds.length);
        const page = graph.getEntry("project:page:main");
        if (page?.kind !== "page") throw new Error("TYPED_SCENE_PAGE_REQUIRED");
        const rootNodeId = page.children[0];
        // Explicit supplemental public edit for a visible paint probe; source fixture stays unchanged.
        root.dispatch("visible consumer probe", [
          {
            kind: "patchNodeSizing",
            id: rootNodeId,
            key: "width",
            write: { kind: "set", value: 200 },
          },
          {
            kind: "patchNodeSizing",
            id: rootNodeId,
            key: "height",
            write: { kind: "set", value: 120 },
          },
        ]);
        const input = [...root.layoutInputs.values()].find(
          (item) => item.sourceId === rootNodeId,
        )!;
        const geometry = root.getGeometry([input.id]).get(input.id)!;
        expect(geometry.width).toBe(200);
        expect(geometry.height).toBe(120);
        const surface = ck.MakeSurface(220, 140)!;
        try {
          const canvas = surface.getCanvas();
          canvas.clear(ck.TRANSPARENT);
          const fill =
            typeof input.visual.fill === "string"
              ? input.visual.fill
              : undefined;
          renderBox(ck, canvas, {
            type: "box",
            x: 0,
            y: 0,
            width: geometry.width,
            height: geometry.height,
            visible: true,
            box: {
              fillColor: fill ? color(fill) : Float32Array.of(0, 0, 0, 0),
              borderRadius: 0,
            },
          });
          surface.flush();
          const pixel = canvas.readPixels(10, 10, {
            width: 1,
            height: 1,
            colorType: ck.ColorType.RGBA_8888,
            alphaType: ck.AlphaType.Unpremul,
            colorSpace: ck.ColorSpace.SRGB,
          }) as Uint8Array;
          if (name === "typed-minimal")
            expect([...pixel]).toEqual([255, 255, 255, 255]);
          const regionNames = input.regions?.map((region) => region.name) ?? [];
          const regionMarkup = regionNames.map((region) =>
            renderToStaticMarkup(
              createElement(Slot, {
                name: region,
                isEditMode: true,
              }),
            ),
          );
          if (name === "typed-slots") {
            expect(regionNames).toEqual(["title", "actions"]);
            expect(regionMarkup[0]).toContain('data-slot-name="title"');
            expect(input.visual.overflow).toBe("hidden");
          }
          results.push({
            fixture: name,
            executionHead,
            currentBuilderBuildIndexSha256,
            sourceSha256: createHash("sha256")
              .update(JSON.stringify(document))
              .digest("hex"),
            viewport: { width: 1440, height: 900 },
            dpr: 1,
            theme: "default-light",
            font: "app-default",
            seed: 248,
            sourceBytes: Buffer.byteLength(JSON.stringify(document)),
            originalInputCount: originalIds.length,
            originalGeometry: [...originalGeometry.values()],
            supplementalPublicOperation:
              "patchNodeSizing width=200 height=120 on first page root",
            actualGeometry: geometry,
            centerPixel: [...pixel],
            regionNames,
            regionMarkup,
            canvasKitRenderBoxExecuted: true,
            oldVisualComparison:
              "UNVERIFIED: typed scene; no old-app visual oracle for this structure",
          });
        } finally {
          surface.delete();
        }
      } finally {
        raw.free();
      }
    }
    writeFileSync(
      join(outputDir, "248-phase3-typed-scene-consumers.json"),
      JSON.stringify(results, null, 2),
    );
  });
  it("runs the frozen public insert through real Rust layout, CanvasKit box paint and RAC semantic DOM", async () => {
    const baseline = JSON.parse(
      readFileSync(join(baselineDir, "baseline.json"), "utf8"),
    ) as {
      head: string;
      scenarioHash: string;
      scenario: {
        id: string;
        seed: number;
        dpr: number;
        theme: string;
        font: string;
        viewport: { width: number; height: number };
        operations: Array<{
          op: string;
          id: string;
          component: string;
          parent: string;
          x: number;
          y: number;
          width: number;
          height: number;
          fill?: string;
          border?: string;
          orientation?: string;
          size?: string;
          description?: string;
          text?: string;
        }>;
      };
      geometry: Record<
        string,
        { x: number; y: number; width: number; height: number } | null
      >;
    };
    expect(baseline.head).toBe("2a5c970994cb9de2f824a729b29c08cdcd647d7b");
    const executionHead = baselineCompatibleHead(repoRoot, baseline.head);
    const oldBuild = JSON.parse(
      readFileSync(join(baselineDir, "scenario-freeze-audit.json"), "utf8"),
    ) as {
      source: { buildIndexSha256: string };
    };
    const currentBuilderBuildIndexSha256 = createHash("sha256")
      .update(readFileSync(resolve(repoRoot, "apps/builder/dist/index.html")))
      .digest("hex");
    expect(baseline.scenario.id).toBe("adr248-structural-baseline-v1");
    const { document } = createG1Fixture();
    const project = document.entries[document.projectId];
    const page = document.entries["project:page:main"] as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    const library = createPencilFixtureLibrary();
    const graph = new CatalogGraph(
      {
        ...document,
        entries: {
          [document.projectId]: project,
          [page.id]: { ...page, children: [] },
        },
      },
      library,
    );
    const { engine, raw } = await actualLayoutEngine();
    try {
      const storage = new CatalogStorage(
        indexedDB,
        `adr248-real-${Date.now()}`,
      );
      await storage.create(graph.exportDocument(), library);
      const runtime = new CatalogRuntime(graph, storage);
      const root = new CatalogCompositionRoot(
        runtime,
        engine,
        baseline.scenario.viewport,
      );
      const nodes: NodeEntry[] = baseline.scenario.operations.map(
        (operation) => ({
          kind: "node",
          id: `project:node:${operation.id}`,
          name: operation.id,
          definitionId: `lib:definition:${operation.component.toLowerCase()}`,
          children: baseline.scenario.operations
            .filter((child) => child.parent === operation.id)
            .map((child) => `project:node:${child.id}` as NodeEntry["id"]),
          props: {
            ...(operation.orientation
              ? { orientation: { kind: "set", value: operation.orientation } }
              : {}),
            ...(operation.size
              ? { size: { kind: "set", value: operation.size } }
              : {}),
            ...(operation.description
              ? { description: { kind: "set", value: operation.description } }
              : {}),
            ...(operation.text
              ? { children: { kind: "set", value: operation.text } }
              : {}),
          },
          visual: {
            ...(operation.fill
              ? { fill: { kind: "set", value: operation.fill } }
              : {}),
            ...(operation.border
              ? {
                  borderColor: { kind: "set", value: operation.border },
                  borderWidth: { kind: "set", value: 2 },
                }
              : {}),
          },
          sizing: {
            width: { kind: "set", value: operation.width },
            height: { kind: "set", value: operation.height },
          },
          placement: { kind: "absolute", x: operation.x, y: operation.y },
          descendantOverrides: [],
        }),
      );
      const first = baseline.scenario.operations[0];
      root.dispatch("G0 insert", [
        ...nodes.map((entry) => ({ kind: "put" as const, entry })),
        {
          kind: "put",
          entry: { ...page, children: [`project:node:${first.id}`] },
        },
      ]);
      await runtime.save();
      const reloaded = new CatalogGraph(
        await storage.load(graph.projectId, library),
        library,
      );
      expect(reloaded.getEntry("project:node:group")).toMatchObject({
        placement: { kind: "absolute", x: 20, y: 20 },
      });
      const inputBySource = new Map(
        [...root.layoutInputs.values()].map((input) => [input.sourceId, input]),
      );
      const layouts = root.getGeometry([...root.layoutInputs.keys()]);
      const actualGeometry = Object.fromEntries(
        baseline.scenario.operations.map((operation) => {
          const input = inputBySource.get(`project:node:${operation.id}`)!;
          return [`adr248-${operation.id}`, layouts.get(input.id) ?? null];
        }),
      );
      for (const id of ["frame", "group", "text"]) {
        const key = `adr248-${id}`;
        const old = baseline.geometry[key]!;
        expect(actualGeometry[key]).toMatchObject({
          x: old.x,
          y: old.y,
          width: old.width,
          height: old.height,
        });
      }
      const ck = await actualCanvasKit();
      const surface = ck.MakeSurface(620, 400)!;
      let differentPixels = 0;
      try {
        const canvas = surface.getCanvas();
        canvas.clear(ck.WHITE);
        // G0 public viewport command: scale 0.8, pan (100,100), clip starts at (100,100).
        // Pan and clip origin cancel for this pinned capture.
        canvas.scale(0.8, 0.8);
        for (const operation of baseline.scenario.operations) {
          const input = inputBySource.get(`project:node:${operation.id}`)!;
          const geometry = layouts.get(input.id)!;
          if (!operation.fill && !operation.border) continue;
          const box: SkiaNodeData = {
            type: "box",
            x: 0,
            y: 0,
            width: geometry.width,
            height: geometry.height,
            visible: true,
            box: {
              fillColor: operation.fill
                ? color(operation.fill)
                : Float32Array.of(0, 0, 0, 0),
              borderRadius: 0,
              ...(operation.border
                ? {
                    strokeColor: color(operation.border),
                    strokeWidth: 2,
                  }
                : {}),
            },
          };
          canvas.save();
          canvas.translate(geometry.x, geometry.y);
          renderBox(ck, canvas, box);
          canvas.restore();
        }
        surface.flush();
        const pixelOptions = {
          width: 620,
          height: 400,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Unpremul,
          colorSpace: ck.ColorSpace.SRGB,
        };
        const newPixels = canvas.readPixels(0, 0, pixelOptions) as Uint8Array;
        const oldImage = ck.MakeImageFromEncoded(
          readFileSync(join(baselineDir, "canvas.png")),
        );
        if (!oldImage) throw new Error("G0_CANVAS_PNG_REQUIRED");
        const oldPixels = oldImage.readPixels(0, 0, pixelOptions) as Uint8Array;
        oldImage.delete();
        for (let i = 0; i < newPixels.length; i += 4)
          if (
            [0, 1, 2, 3].some(
              (channel) => newPixels[i + channel] !== oldPixels[i + channel],
            )
          )
            differentPixels++;
        const png = surface.makeImageSnapshot().encodeToBytes();
        if (!png) throw new Error("CANVASKIT_PNG_REQUIRED");
        writeFileSync(join(outputDir, "248-phase3-structural-new.png"), png);
      } finally {
        surface.delete();
      }
      // Full consumer path for this scoped fixture: typed graph -> Rust layout ->
      // existing renderCommands -> CanvasKit text/box paint -> page border overlay.
      // The old standalone Slot disappearance is recorded separately; this scene
      // deliberately retains the new typed Slot so a difference remains visible.
      const oldSlotTrace = JSON.parse(
        readFileSync(join(outputDir, "248-phase3-slot-old-trace.json"), "utf8"),
      ) as {
        head: string;
        scenarioHash: string;
        builderDistIndexSha256: string;
        servedIndexSha256: string;
        executionResources: Array<{
          url: string;
          bytes: number;
          sha256: string;
        }>;
        before: {
          pageFrames: Array<{
            id: string;
            x: number;
            y: number;
            width: number;
            height: number;
          }>;
          borderCss: string;
          frameSkia: { type: string; box: Record<string, unknown> } | null;
        };
      };
      expect(oldSlotTrace.scenarioHash).toBe(baseline.scenarioHash);
      expect(oldSlotTrace.head).toBe(baseline.head);
      const previousWindow = (globalThis as { window?: Window }).window;
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
      const fontMgr = skiaFontManager.getFontMgr();
      const pageId = "project:page:main";
      const bodyFrame = oldSlotTrace.before.pageFrames.find(
        (frame) => frame.x === 0 && frame.y === 0,
      );
      if (!bodyFrame) throw new Error("OLD_PAGE_FRAME_REQUIRED");
      let boundScene: ReturnType<typeof bindCatalogCanvas> | undefined;
      let sceneCommandCount = 0;
      let sceneTextCommands = 0;
      let sceneDifferentPixels = 0;
      let sceneCommandStreamSha256 = "";
      const sceneDiffRegions = {
        pageEdge: 0,
        textArea: 0,
        frameEdge: 0,
        other: 0,
      };
      const sceneColorPairs = new Map<string, number>();
      try {
        boundScene = bindCatalogCanvas(
          root,
          [inputBySource.get(`project:node:${first.id}`)!.id],
          {
            id: pageId,
            rect: {
              x: 0,
              y: 0,
              width: bodyFrame.width,
              height: bodyFrame.height,
            },
            fill: "#ffffff",
          },
        );
        const { stream } = boundScene;
        sceneCommandCount = stream.commands.length;
        expect(boundScene.bindingIds).toEqual(
          expect.arrayContaining(["frame", "group", "slot", "text"]),
        );
        expect(
          stream.commands.filter((command) => command.type === 1),
        ).toHaveLength(4);
        expect(
          stream.commands.some(
            (command) =>
              command.type === 1 &&
              command.skiaData.elementId?.endsWith("::project:node:group"),
          ),
        ).toBe(false);
        expect(
          stream.commands.find(
            (command) =>
              command.type === 1 &&
              command.skiaData.elementId?.endsWith("::project:node:slot"),
          ),
        ).toMatchObject({
          skiaData: {
            box: { strokeStyle: "dashed", strokeWidth: 1, borderRadius: 6 },
          },
        });
        expect(
          stream.commands.find(
            (command) =>
              command.type === 1 &&
              command.skiaData.elementId?.endsWith("::project:node:frame"),
          ),
        ).toMatchObject({ skiaData: { box: { strokeWidth: 2 } } });
        expect(
          stream.commands.find(
            (command) => command.type === 1 && command.nodeType === "text",
          ),
        ).toMatchObject({ skiaData: { text: { content: "저장" } } });
        const commandStreamJson = JSON.stringify(stream.commands, null, 2);
        const commandStreamFile = `${commandStreamJson}\n`;
        sceneCommandStreamSha256 = createHash("sha256")
          .update(commandStreamFile)
          .digest("hex");
        writeFileSync(
          join(outputDir, "248-phase3-structural-catalog-commands.json"),
          commandStreamFile,
        );
        sceneTextCommands = stream.commands.filter(
          (command) => command.type === 1 && command.nodeType === "text",
        ).length;
        const sceneSurface = ck.MakeSurface(620, 400)!;
        try {
          const canvas = sceneSurface.getCanvas();
          canvas.clear(ck.WHITE);
          canvas.save();
          canvas.scale(0.8, 0.8);
          canvas.save();
          executeRenderCommands(
            ck,
            canvas,
            stream.commands,
            { x: 0, y: 0, width: 620, height: 400 } as DOMRect,
            fontMgr,
          );
          canvas.restore();
          const oldBorder = oldSlotTrace.before.borderCss;
          const borderColor = hexToColor4fChannels(
            cssColorToHex(oldBorder, 0xd4d4d4),
          );
          renderFrameAreaBorder(ck, canvas, [bodyFrame], 0.8, borderColor);
          renderSelectionBox(
            ck,
            canvas,
            { x: 0, y: 0, width: bodyFrame.width, height: bodyFrame.height },
            0.8,
          );
          renderTransformHandles(
            ck,
            canvas,
            { x: 0, y: 0, width: bodyFrame.width, height: bodyFrame.height },
            0.8,
          );
          canvas.restore();
          sceneSurface.flush();
          const options = {
            width: 620,
            height: 400,
            colorType: ck.ColorType.RGBA_8888,
            alphaType: ck.AlphaType.Unpremul,
            colorSpace: ck.ColorSpace.SRGB,
          };
          const actual = canvas.readPixels(0, 0, options) as Uint8Array;
          const oldImage = ck.MakeImageFromEncoded(
            readFileSync(join(baselineDir, "canvas.png")),
          )!;
          const expected = oldImage.readPixels(0, 0, options) as Uint8Array;
          oldImage.delete();
          for (let i = 0; i < actual.length; i += 4)
            if (
              [0, 1, 2, 3].some(
                (channel) => actual[i + channel] !== expected[i + channel],
              )
            ) {
              sceneDifferentPixels++;
              const oldColor = [...expected.slice(i, i + 4)].join(",");
              const newColor = [...actual.slice(i, i + 4)].join(",");
              const pair = `${oldColor} -> ${newColor}`;
              sceneColorPairs.set(pair, (sceneColorPairs.get(pair) ?? 0) + 1);
              const pixel = i / 4;
              const x = pixel % 620;
              const y = Math.floor(pixel / 620);
              if (x < 4 || y < 4) sceneDiffRegions.pageEdge++;
              else if (x >= 185 && x < 230 && y >= 40 && y < 80)
                sceneDiffRegions.textArea++;
              else if (
                x >= 30 &&
                x <= 386 &&
                y >= 30 &&
                y <= 243 &&
                (x < 36 || x > 380 || y < 36 || y > 238)
              )
                sceneDiffRegions.frameEdge++;
              else sceneDiffRegions.other++;
            }
          const png = sceneSurface.makeImageSnapshot().encodeToBytes();
          if (!png) throw new Error("RENDER_COMMAND_SCENE_PNG_REQUIRED");
          writeFileSync(
            join(outputDir, "248-phase3-structural-render-commands.png"),
            png,
          );
        } finally {
          sceneSurface.delete();
        }
      } finally {
        boundScene?.dispose();
        if (previousWindow === undefined)
          Reflect.deleteProperty(globalThis, "window");
        else Object.assign(globalThis, { window: previousWindow });
      }
      expect(sceneCommandCount).toBeGreaterThan(0);
      expect(sceneTextCommands).toBeGreaterThan(0);
      expect(
        boundScene?.unpainted.some((item) => item.reason.startsWith("SLOT_")),
      ).toBe(true);
      const group = inputBySource.get("project:node:group")!;
      const slot = inputBySource.get("project:node:slot")!;
      // Product-path DOM binding over the same composition-root inputs.
      const groupMarkup = renderToStaticMarkup(
        renderCatalogDom(root, group.id),
      );
      const slotMarkup = renderToStaticMarkup(
        renderCatalogDom(root, slot.id, { slotMode: "edit" }),
      );
      expect(groupMarkup).toContain('role="group"');
      expect(slotMarkup).toContain("내용");
      expect(differentPixels).toBeGreaterThan(0);
      writeFileSync(
        join(outputDir, "248-phase3-structural-new.json"),
        JSON.stringify(
          {
            head: baseline.head,
            executionHead,
            oldBuildIndexSha256: oldBuild.source.buildIndexSha256,
            currentBuilderBuildIndexSha256,
            pairedOldBuilderDistIndexSha256:
              oldSlotTrace.builderDistIndexSha256,
            pairedOldServedIndexSha256: oldSlotTrace.servedIndexSha256,
            pairedOldExecutionResources: oldSlotTrace.executionResources,
            newExecutionAssetsSha256: {
              catalogBinding: fileSha256(
                resolve(
                  process.cwd(),
                  "src/builder/catalogRuntime/canvasBinding.ts",
                ),
              ),
              compositionRoot: fileSha256(
                resolve(
                  process.cwd(),
                  "src/builder/catalogRuntime/compositionRoot.ts",
                ),
              ),
              renderCommands: fileSha256(
                resolve(
                  process.cwd(),
                  "src/builder/workspace/canvas/skia/renderCommands.ts",
                ),
              ),
              rustWasm: fileSha256(
                resolve(
                  process.cwd(),
                  "src/builder/workspace/canvas/wasm-bindings/engine-pkg/engine_bg.wasm",
                ),
              ),
              canvasKitWasm: fileSha256(
                join(
                  dirname(require.resolve("canvaskit-wasm/bin/canvaskit.js")),
                  "canvaskit.wasm",
                ),
              ),
              font: fileSha256(
                resolve(process.cwd(), "public/fonts/PretendardVariable.ttf"),
              ),
            },
            executionModuleIdentityParity: "UNVERIFIED_DEV_SERVER_VS_VITEST",
            buildMatched:
              currentBuilderBuildIndexSha256 ===
              oldSlotTrace.builderDistIndexSha256,
            buildMatchScope:
              currentBuilderBuildIndexSha256 ===
              oldSlotTrace.builderDistIndexSha256
                ? "BUILDER_DIST_INDEX_ONLY"
                : "DIST_INDEX_CHANGED_AFTER_OLD_TRACE",
            g0FrozenBuildIndexMatched:
              currentBuilderBuildIndexSha256 ===
              oldBuild.source.buildIndexSha256,
            scenarioId: baseline.scenario.id,
            scenarioHash: baseline.scenarioHash,
            viewport: baseline.scenario.viewport,
            dpr: baseline.scenario.dpr,
            font: baseline.scenario.font,
            theme: baseline.scenario.theme,
            seed: baseline.scenario.seed,
            actualGeometry,
            oldGeometry: baseline.geometry,
            groupMarkup,
            slotMarkup,
            canvasKit: true,
            rustLayout: true,
            exactPngDifferentPixels: differentPixels,
            renderCommandScene: {
              source:
                "typed catalog resolver -> library bindingId -> registered SkiaNodeData -> renderCommands -> CanvasKit",
              bindingIds: boundScene?.bindingIds,
              unpainted: boundScene?.unpainted,
              commandCount: sceneCommandCount,
              commandStreamSha256: sceneCommandStreamSha256,
              textCommandCount: sceneTextCommands,
              exactPngDifferentPixels: sceneDifferentPixels,
              exactDiffRegions: sceneDiffRegions,
              topColorPairs: [...sceneColorPairs]
                .sort((left, right) => right[1] - left[1])
                .slice(0, 12),
              pageBorderSource:
                "old UI --border/page frame plus selected body box/handles overlay, separately rendered",
              slotSource: "typed Slot present; old legacy-slot absent",
              oldFrameSkiaBox: oldSlotTrace.before.frameSkia?.box ?? null,
            },
            totalPixels: 620 * 400,
            pixelParity: `FAIL: ${sceneDifferentPixels}/248000 differs; old Frame stroke omission, Slot projection, page edge, Text and remaining pixels have separate causes`,
          },
          null,
          2,
        ),
      );
      const slotInput = inputBySource.get("project:node:slot")!;
      const slotRect = layouts.get(slotInput.id)!;
      expect(slotInput.props.size).toBe("md");
      expect(slotInput.props.description).toBe("내용");
      expect(slotInput.sizing.minHeight).toBeUndefined();
      expect(slotInput.visual).toMatchObject({
        minHeight: 60,
        padding: 12,
        gap: 8,
        fillAlpha: 0.5,
        borderWidth: 1,
        borderStyle: "dashed",
        radius: 6,
      });
      const pixelDifference = (left: Uint8Array, right: Uint8Array) => {
        let count = 0;
        for (let index = 0; index < left.length; index += 4)
          if (
            left[index] !== right[index] ||
            left[index + 1] !== right[index + 1] ||
            left[index + 2] !== right[index + 2] ||
            left[index + 3] !== right[index + 3]
          )
            count++;
        return count;
      };
      const readSlotPixels = (
        surface: NonNullable<ReturnType<CanvasKit["MakeSurface"]>>,
      ) =>
        surface.getCanvas().readPixels(0, 0, {
          width: 220,
          height: 260,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Unpremul,
          colorSpace: ck.ColorSpace.SRGB,
        }) as Uint8Array;
      const emptyBinding = bindCatalogCanvas(root, [slotInput.id]);
      const overlayContext = {
        editMode: true,
        pageId,
        roles: new Map([[slotInput.id, "origin" as const]]),
      };
      const emptyTargets = deriveCatalogSlotOverlayTargets(
        root,
        overlayContext,
      );
      expect(emptyTargets).toMatchObject([
        {
          id: slotInput.id,
          slotMarkerRole: "origin",
          pageId,
          bounds: {
            x: slotRect.x + 12,
            y: slotRect.y + 12,
            width: slotRect.width - 24,
            height: slotRect.height - 24,
          },
        },
      ]);
      expect(
        deriveCatalogSlotOverlayTargets(root, {
          ...overlayContext,
          visibleBounds: new Map(),
        }),
      ).toEqual([]);
      expect(
        deriveCatalogSlotOverlayTargets(root, {
          ...overlayContext,
          editMode: false,
        }),
      ).toEqual([]);
      let emptySlotMarkerPixels = 0;
      let emptyScenePixels: Uint8Array | undefined;
      try {
        expect(
          emptyBinding.stream.commands.filter((command) => command.type === 1),
        ).toHaveLength(1);
        const surface = ck.MakeSurface(220, 260)!;
        try {
          const canvas = surface.getCanvas();
          canvas.clear(ck.WHITE);
          executeRenderCommands(
            ck,
            canvas,
            emptyBinding.stream.commands,
            { x: 0, y: 0, width: 220, height: 260 } as DOMRect,
            fontMgr,
          );
          surface.flush();
          emptyScenePixels = readSlotPixels(surface);
          renderSlotHatchPattern(
            ck,
            canvas,
            emptyTargets[0].bounds,
            1,
            emptyTargets[0].slotMarkerRole,
          );
          surface.flush();
          emptySlotMarkerPixels = pixelDifference(
            emptyScenePixels,
            readSlotPixels(surface),
          );
          expect(emptySlotMarkerPixels).toBeGreaterThan(0);
          const png = surface.makeImageSnapshot().encodeToBytes();
          if (!png) throw new Error("SLOT_EMPTY_MARKER_PNG_REQUIRED");
          writeFileSync(
            join(outputDir, "248-phase3-slot-empty-marker.png"),
            png,
          );
        } finally {
          surface.delete();
        }
      } finally {
        emptyBinding.dispose();
      }
      const slotEntry = graph.getEntry("project:node:slot") as NodeEntry;
      const fillId = "project:node:slotFill" as NodeEntry["id"];
      root.dispatch("supplemental G0 Slot fill", [
        {
          kind: "put",
          entry: {
            kind: "node",
            id: fillId,
            definitionId: "lib:definition:text",
            children: [],
            props: { children: { kind: "set", value: "Filled" } },
            visual: {},
            sizing: {
              width: { kind: "set", value: 160 },
              height: { kind: "set", value: 40 },
            },
            descendantOverrides: [],
          },
        },
        { kind: "put", entry: { ...slotEntry, children: [fillId] } },
      ]);
      const filledBinding = bindCatalogCanvas(root, [slotInput.id]);
      expect(deriveCatalogSlotOverlayTargets(root, overlayContext)).toEqual([]);
      let filledContentPixels = 0;
      try {
        expect(
          filledBinding.stream.commands.filter(
            (command) => command.type === 1 && command.nodeType === "text",
          ),
        ).toHaveLength(1);
        const surface = ck.MakeSurface(220, 260)!;
        try {
          const canvas = surface.getCanvas();
          canvas.clear(ck.WHITE);
          executeRenderCommands(
            ck,
            canvas,
            filledBinding.stream.commands,
            { x: 0, y: 0, width: 220, height: 260 } as DOMRect,
            fontMgr,
          );
          surface.flush();
          filledContentPixels = pixelDifference(
            emptyScenePixels!,
            readSlotPixels(surface),
          );
          expect(filledContentPixels).toBeGreaterThan(0);
          const png = surface.makeImageSnapshot().encodeToBytes();
          if (!png) throw new Error("SLOT_FILLED_CONTENT_PNG_REQUIRED");
          writeFileSync(
            join(outputDir, "248-phase3-slot-filled-content.png"),
            png,
          );
        } finally {
          surface.delete();
        }
      } finally {
        filledBinding.dispose();
      }
      writeFileSync(
        join(outputDir, "248-phase3-slot-paint-contract.json"),
        JSON.stringify(
          {
            scenarioId: baseline.scenario.id,
            scenarioHash: baseline.scenarioHash,
            sourceHead: executionHead,
            viewport: baseline.scenario.viewport,
            dpr: baseline.scenario.dpr,
            font: baseline.scenario.font,
            theme: baseline.scenario.theme,
            seed: baseline.scenario.seed,
            slotGeometry: slotRect,
            emptyCommandDraws: 1,
            emptyMarkerPainter:
              "renderSlotHatchPattern(existing editor overlay)",
            emptyMarkerPixels: emptySlotMarkerPixels,
            supplementalPublicOperation: "fill Slot with Text(Filled)",
            filledTextCommandDraws: 1,
            filledContentPixels,
            filledMarkerPainterInvocations: 0,
            emptyOverlayTarget: emptyTargets[0],
            pageModeTargets: 0,
            fullyOccludedTargets: 0,
            missingTypedInput:
              "Typed Slot visual and transient editor role/occlusion reach the scene; Canvas does not paint DOM icon/name/required/description chrome",
            verdict:
              "TYPED_SLOT_BOX_AND_OVERLAY_TARGET_PASS; CANVAS_DOM_CHROME_FAIL",
          },
          null,
          2,
        ),
      );
    } finally {
      raw.free();
    }
  });
  it("runs frozen G0 insert with source-derived Text through Rust, CanvasKit and isolated Group DOM", async () => {
    const baseline = JSON.parse(
      readFileSync(join(baselineDir, "baseline.json"), "utf8"),
    ) as {
      head: string;
      scenarioHash: string;
      scenario: {
        id: string;
        viewport: { width: number; height: number };
        dpr: number;
        font: string;
        theme: string;
        seed: number;
        operations: Array<{
          id: string;
          component: string;
          parent: string;
          x: number;
          y: number;
          width: number;
          height: number;
          text?: string;
          orientation?: string;
          size?: string;
          fill?: string;
          border?: string;
        }>;
      };
      geometry: Record<
        string,
        { x: number; y: number; width: number; height: number } | null
      >;
    };
    const executionHead = baselineCompatibleHead(repoRoot, baseline.head);
    const codeLibrary = await buildCodeCatalogLibrary("light");
    // Visual source derivation belongs to primitive type definitions (Text/Heading and the
    // source-derived `type-*` leaves); typed reusable origin composites carry no visual.
    const codeDefinitions = [...codeLibrary.definitions.values()];
    expect(
      codeDefinitions
        .filter((definition) => Object.keys(definition.visual).length > 0)
        .every(
          (definition) =>
            definition.mode !== "composite" &&
            !definition.id.startsWith("lib:definition:origin-"),
        ),
    ).toBe(true);
    expect(
      codeDefinitions
        .filter((definition) => definition.id.startsWith("lib:definition:origin-"))
        .every((definition) => Object.keys(definition.visual).length === 0),
    ).toBe(true);
    expect(
      codeDefinitions.every(
        (definition) =>
          ["lib:definition:heading", "lib:definition:text"].includes(
            definition.id,
          ) ||
          definition.id.startsWith("lib:definition:type-") ||
          definition.id.startsWith("lib:definition:origin-"),
      ),
    ).toBe(true);
    const library = await createCodeCatalogScenarioLibrary("light");
    const { document } = createG1Fixture();
    const page = document.entries["project:page:main"] as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    const graph = new CatalogGraph(
      {
        ...document,
        entries: {
          [document.projectId]: document.entries[document.projectId],
          [page.id]: { ...page, children: [] },
        },
      },
      library,
    );
    const { engine, raw } = await actualLayoutEngine();
    try {
      const runtime = new CatalogRuntime(
        graph,
        new CatalogStorage(indexedDB, `adr248-source-catalog-${Date.now()}`),
      );
      const root = new CatalogCompositionRoot(
        runtime,
        engine,
        baseline.scenario.viewport,
      );
      const nodes: NodeEntry[] = baseline.scenario.operations.map(
        (operation) => ({
          kind: "node",
          id: `project:node:${operation.id}`,
          name: operation.id,
          definitionId: `lib:definition:${operation.component.toLowerCase()}`,
          children: baseline.scenario.operations
            .filter((child) => child.parent === operation.id)
            .map((child) => `project:node:${child.id}` as NodeEntry["id"]),
          props: {
            ...(operation.text
              ? { children: { kind: "set" as const, value: operation.text } }
              : {}),
            ...(operation.orientation
              ? {
                  orientation: {
                    kind: "set" as const,
                    value: operation.orientation,
                  },
                }
              : {}),
            ...(operation.size
              ? { size: { kind: "set" as const, value: operation.size } }
              : {}),
          },
          visual: {
            ...(operation.fill
              ? { fill: { kind: "set" as const, value: operation.fill } }
              : {}),
            ...(operation.border
              ? {
                  borderColor: {
                    kind: "set" as const,
                    value: operation.border,
                  },
                  borderWidth: { kind: "set" as const, value: 2 },
                }
              : {}),
          },
          sizing: {
            width: { kind: "set", value: operation.width },
            height: { kind: "set", value: operation.height },
          },
          placement: { kind: "absolute", x: operation.x, y: operation.y },
          descendantOverrides: [],
        }),
      );
      root.dispatch("G0 public insert", [
        ...nodes.map((entry) => ({ kind: "put" as const, entry })),
        { kind: "put", entry: { ...page, children: [nodes[0].id] } },
      ]);
      const textInput = [...root.layoutInputs.values()].find(
        (input) => input.sourceId === "project:node:text",
      );
      expect(textInput).toBeDefined();
      const textGeometry = root
        .getGeometry([textInput!.id])
        .get(textInput!.id)!;
      const oldTextGeometry = baseline.geometry["adr248-text"];
      if (!oldTextGeometry) throw new Error("G0_TEXT_GEOMETRY_REQUIRED");
      expect(textGeometry).toMatchObject({
        x: oldTextGeometry.x,
        y: oldTextGeometry.y,
        width: oldTextGeometry.width,
        height: oldTextGeometry.height,
      });
      const textResolved = resolveCatalogNode(graph, "project:node:text");
      expect(textResolved.visual).toMatchObject({
        color: "#171717",
        fontSize: 16,
        fontWeight: 400,
        lineHeight: 1.5,
      });
      const ck = await actualCanvasKit();
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
      const rootInput = [...root.canvasInputs.values()].find(
        (input) => input.sourceId === nodes[0].id,
      )!;
      const bound = bindCatalogCanvas(root, [rootInput.id]);
      let sceneNonwhitePixels = 0;
      try {
        expect(bound.bindingIds).toEqual(
          expect.arrayContaining(["frame", "group", "slot", "text"]),
        );
        const drawText = bound.stream.commands.find(
          (command) =>
            command.type === 1 &&
            command.nodeType === "text" &&
            command.skiaData.text?.content === textResolved.props.children,
        );
        expect(
          drawText?.type === 1 ? drawText.skiaData.text : undefined,
        ).toMatchObject({
          fontSize: 16,
          fontWeight: 400,
        });
        const surface = ck.MakeSurface(620, 400)!;
        try {
          surface.getCanvas().clear(ck.WHITE);
          executeRenderCommands(
            ck,
            surface.getCanvas(),
            bound.stream.commands,
            { x: 0, y: 0, width: 620, height: 400 } as DOMRect,
            skiaFontManager.getFontMgr(),
          );
          surface.flush();
          const pixels = surface.getCanvas().readPixels(0, 0, {
            width: 620,
            height: 400,
            colorType: ck.ColorType.RGBA_8888,
            alphaType: ck.AlphaType.Unpremul,
            colorSpace: ck.ColorSpace.SRGB,
          }) as Uint8Array;
          for (let offset = 0; offset < pixels.length; offset += 4)
            if (
              pixels[offset] < 250 ||
              pixels[offset + 1] < 250 ||
              pixels[offset + 2] < 250
            )
              sceneNonwhitePixels++;
          expect(sceneNonwhitePixels).toBeGreaterThan(0);
          const png = surface.makeImageSnapshot().encodeToBytes();
          if (!png) throw new Error("SOURCE_CATALOG_PNG_REQUIRED");
          writeFileSync(
            join(outputDir, "248-phase3-code-catalog-text-scene.png"),
            png,
          );
        } finally {
          surface.delete();
        }
      } finally {
        bound.dispose();
      }
      const groupInput = [...root.domInputs.values()].find(
        (input) => input.sourceId === "project:node:group",
      )!;
      const semantic = renderToStaticMarkup(
        renderCatalogDom(root, groupInput.id),
      );
      expect(semantic).toContain('role="group"');
      expect(semantic).toContain(`aria-label="${groupInput.name}"`);
      expect(semantic).toContain("저장");
      const groupEntry = graph.getEntry("project:node:group") as NodeEntry;
      const heading: NodeEntry = {
        kind: "node",
        id: "project:node:sourceHeading",
        name: "sourceHeading",
        definitionId: "lib:definition:heading",
        children: [],
        props: {
          children: { kind: "set", value: "Source Heading" },
          size: { kind: "set", value: "lg" },
        },
        visual: {},
        sizing: {
          width: { kind: "set", value: 160 },
          height: { kind: "set", value: 40 },
        },
        placement: { kind: "absolute", x: 180, y: 50 },
        descendantOverrides: [],
      };
      const headingTransaction = root.dispatch("public insert Heading", [
        { kind: "put", entry: heading },
        {
          kind: "put",
          entry: {
            ...groupEntry,
            children: [...groupEntry.children, heading.id],
          },
        },
      ]);
      const headingResolved = resolveCatalogNode(graph, heading.id);
      const headingInput = [...root.layoutInputs.values()].find(
        (input) => input.sourceId === heading.id,
      )!;
      const headingGeometry = root
        .getGeometry([headingInput.id])
        .get(headingInput.id)!;
      expect(headingResolved.visual).toMatchObject({
        fontSize: 18,
        fontWeight: 600,
      });
      expect(headingGeometry).toMatchObject({ width: 160, height: 40 });
      const headingScene = bindCatalogCanvas(root, [rootInput.id]);
      let headingDrawCount = 0;
      try {
        headingDrawCount = headingScene.stream.commands.filter(
          (command) =>
            command.type === 1 &&
            command.nodeType === "text" &&
            command.skiaData.text?.content === "Source Heading",
        ).length;
        expect(headingDrawCount).toBe(1);
      } finally {
        headingScene.dispose();
      }
      const headingSemantic = renderToStaticMarkup(
        renderCatalogDom(root, groupInput.id),
      );
      expect(headingSemantic).toMatch(
        /<h\d [^>]*class="react-aria-Heading"[^>]*>Source Heading<\/h\d>/,
      );
      let unrelatedNotifications = 0;
      root.subscribeCanvas(headingInput.id, () => unrelatedNotifications++);
      root.subscribeDom(headingInput.id, () => unrelatedNotifications++);
      const originalExport = graph.exportDocument;
      graph.exportDocument = () => {
        throw new Error("SOURCE_LEAF_FULL_EXPORT");
      };
      const originalStringify = JSON.stringify;
      let fullSerializations = 0;
      const stringify = vi
        .spyOn(JSON, "stringify")
        .mockImplementation((value) => {
          if (value && typeof value === "object" && "entries" in value)
            fullSerializations++;
          return originalStringify(value);
        });
      let leafTransaction: ReturnType<typeof root.dispatch>;
      try {
        leafTransaction = root.dispatch("public text edit", [
          {
            kind: "patchNodeProp",
            id: "project:node:text",
            key: "children",
            write: { kind: "set", value: "저장하기" },
          },
        ]);
      } finally {
        stringify.mockRestore();
        graph.exportDocument = originalExport;
      }
      expect(leafTransaction.changedIds).toEqual(
        new Set(["project:node:text"]),
      );
      expect(graph.metrics.transactionEntriesTraversed).toBe(0);
      expect(graph.metrics.transactionEntryTableClones).toBe(0);
      expect(graph.metrics.transactionRecordReplacements).toBe(1);
      expect(fullSerializations).toBe(0);
      expect(root.metrics.layoutInputVisits).toBe(1);
      expect(root.metrics.traversedWholeInputGraph).toBe(false);
      expect(unrelatedNotifications).toBe(0);
      const evidence = {
        sourceHead: baseline.head,
        executionHead,
        scenarioId: baseline.scenario.id,
        scenarioHash: baseline.scenarioHash,
        viewport: baseline.scenario.viewport,
        dpr: baseline.scenario.dpr,
        font: baseline.scenario.font,
        theme: baseline.scenario.theme,
        seed: baseline.scenario.seed,
        fontSha256: createHash("sha256").update(fontBytes).digest("hex"),
        wasmSha256: fileSha256(
          resolve(
            process.cwd(),
            "src/builder/workspace/canvas/wasm-bindings/engine-pkg/engine_bg.wasm",
          ),
        ),
        executionIdentity: "UNVERIFIED_OLD_PRODUCTION_VS_NEW_VITEST",
        sourceLibraryRevision: codeLibrary.revision,
        scenarioLibraryRevision: library.revision,
        sourceDerivedDefinitions: ["Text", "Heading"],
        executedSourceDefinitions: ["Text", "Heading"],
        nativeFixtureDefinitions: ["frame", "rectangle", "group", "slot"],
        oldTextGeometry: baseline.geometry["adr248-text"],
        newTextGeometry: textGeometry,
        resolvedText: textResolved,
        rustLayoutInput: textInput,
        canvasDrawCount: 1,
        sceneNonwhitePixels,
        isolatedDomSemantic: semantic,
        headingExtension: {
          oldG0Oracle: "UNVERIFIED_NO_DIRECT_HEADING_FIXTURE",
          transactionChangedIds: [...headingTransaction.changedIds],
          resolved: headingResolved,
          rustGeometry: headingGeometry,
          canvasTextDraws: headingDrawCount,
          isolatedDomSemantic: headingSemantic,
        },
        leafEditDelta: {
          changedIds: [...leafTransaction.changedIds],
          graphEntriesTraversed: graph.metrics.transactionEntriesTraversed,
          graphEntryTableClones: graph.metrics.transactionEntryTableClones,
          graphRecordReplacements: graph.metrics.transactionRecordReplacements,
          fullSerializations,
          layoutInputVisits: root.metrics.layoutInputVisits,
          resolverVisits: root.metrics.resolverVisits,
          traversedWholeInputGraph: root.metrics.traversedWholeInputGraph,
          unrelatedNotifications,
        },
        groupResolved: groupInput.props,
        g3: "PARTIAL_TEXT_BASE_GEOMETRY_AND_CONSUMER; OLD_NEW_PIXEL_AND_COMPOSITE_CATALOG_UNVERIFIED",
      };
      writeFileSync(
        join(outputDir, "248-phase3-code-catalog-consumer.json"),
        `${JSON.stringify(evidence, null, 2)}\n`,
      );
    } finally {
      raw.free();
    }
  });
});
