import "@react-spectrum/s2/page.css";
import { act, createElement as h, Fragment } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, it } from "vitest";
import { Divider, Provider } from "@react-spectrum/s2";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { insertNodes } from "../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../packages/shared/src/catalog/document/types";
import { applyCatalogPreviewTheme } from "../../../../packages/shared/src/catalog/runtime/domView.runtime";
import { catalogThemeState } from "../../../../packages/shared/src/catalog/runtime/theme";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { createLayoutEngine } from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import { getSkiaNode } from "@/builder/workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "@/builder/catalogRuntime/canvasBinding";
import { renderCatalogDom } from "@/builder/catalogRuntime/domBinding";
import { catalogPaletteDefinitionId } from "@/builder/catalogRuntime/paletteInsert";
import { newCatalogProjectDocument } from "@/builder/catalogRuntime/project";
import { CatalogStorage } from "@/builder/catalogRuntime/storage";
import { CatalogWorkspace } from "@/builder/catalogRuntime/workspace";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const colorProbe = new OffscreenCanvas(1, 1).getContext("2d", {
  willReadFrequently: true,
})!;
function colorBytes(value: string): number[] {
  colorProbe.clearRect(0, 0, 1, 1);
  colorProbe.fillStyle = value;
  colorProbe.fillRect(0, 0, 1, 1);
  return [...colorProbe.getImageData(0, 0, 1, 1).data];
}
const css = document.createElement("style");
let library: Awaited<ReturnType<typeof buildCodeCatalogLibrary>>;
beforeAll(async () => {
  await initEngineWasm();
  library = await buildCodeCatalogLibrary();
  css.textContent = bundleCss;
  document.head.append(css);
  injectPreviewBaseStyles(document);
});
afterAll(() => {
  css.remove();
  document.getElementById("runtime-theme-vars")?.remove();
  document.documentElement.removeAttribute("data-theme");
});

const cases = (["light", "dark"] as const).flatMap((colorMode) =>
  (["horizontal", "vertical"] as const).flatMap((orientation) =>
    (["S", "M", "L"] as const).flatMap((size) =>
      ([undefined, "white", "black"] as const).map((staticColor) => ({
        colorMode,
        orientation,
        size,
        staticColor,
      })),
    ),
  ),
);

it.each(cases)(
  "S2 Divider / Preview / Canvas: $colorMode $orientation $size $staticColor",
  async ({ colorMode, orientation, size, staticColor }) => {
    const props = {
      orientation,
      size,
      ...(staticColor ? { staticColor } : {}),
    };
    const graph = new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:divider",
        name: "Divider",
      }),
      library,
    );
    const theme = () => ({ ...catalogThemeState(graph), colorMode });
    const workspace = new CatalogWorkspace(
      graph,
      new CatalogStorage(indexedDB, `divider-${Math.random()}`),
      {
        engine: createLayoutEngine(),
        viewport: { width: 800, height: 600 },
        autosaveSchedule: () => {},
        theme,
      },
    );
    applyCatalogPreviewTheme(theme());
    const frame = "project:node:frame" as NodeId;
    const id = "project:node:divider" as NodeId;
    const flexDirection = orientation === "vertical" ? "row" : "column";
    const entry = (nodeId: NodeId, type: string): NodeEntry => ({
      kind: "node",
      id: nodeId,
      definitionId: catalogPaletteDefinitionId(library, type),
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: "project:node:home-body" as NodeId },
        entries: [
          {
            ...entry(frame, "frame"),
            children: [id],
            layout: {
              display: { kind: "set", value: "flex" },
              flexDirection: { kind: "set", value: flexDirection },
            },
            visual: {
              width: { kind: "set", value: 240 },
              height: { kind: "set", value: 120 },
            },
          },
          {
            ...entry(id, "Separator"),
            props: Object.fromEntries(
              Object.entries(props).map(([key, value]) => [
                key,
                { kind: "set", value },
              ]),
            ),
          },
        ],
        rootIds: [frame],
        newId: workspace.newId,
      }),
    );
    const root = workspace.root;
    const record = root.recordsOfSource(id)[0]!;
    const host = document.createElement("div");
    document.body.append(host);
    const reactRoot = createRoot(host);
    let canvas: ReturnType<typeof bindCatalogCanvas> | undefined;
    try {
      await act(async () =>
        reactRoot.render(
          h(
            Fragment,
            null,
            h(
              "div",
              { "data-own": true },
              renderCatalogDom(root, root.recordsOfSource(frame)[0]!),
            ),
            h(Provider, {
              colorScheme: colorMode,
              children: h(
                "div",
                {
                  "data-reference": true,
                  style: {
                    display: "flex",
                    flexDirection,
                    width: 240,
                    height: 120,
                  },
                },
                h(Divider, props),
              ),
            }),
          ),
        ),
      );
      const own = host.querySelector("[data-own] .react-aria-Separator")!;
      const reference = host.querySelector(
        "[data-reference] [role=separator], [data-reference] hr",
      )!;
      expect(own.tagName).toBe(reference.tagName);
      expect(own.childElementCount).toBe(0);
      const actual = own.getBoundingClientRect();
      const expected = reference.getBoundingClientRect();
      for (const axis of ["width", "height"] as const)
        expect(actual[axis], axis).toBeCloseTo(expected[axis], 2);
      const ownCss = getComputedStyle(own);
      const refCss = getComputedStyle(reference);
      for (const key of [
        "marginTop",
        "marginRight",
        "marginBottom",
        "marginLeft",
        "borderTopWidth",
        "alignSelf",
        "flexGrow",
        "flexShrink",
      ] as const)
        expect(ownCss[key], key).toBe(refCss[key]);
      const ownColor = colorBytes(ownCss.backgroundColor);
      const refColor = colorBytes(refCss.backgroundColor);
      for (let channel = 0; channel < 4; channel++)
        expect(
          Math.abs(ownColor[channel]! - refColor[channel]!),
        ).toBeLessThanOrEqual(1);
      expect(parseFloat(ownCss.borderTopLeftRadius)).toBeGreaterThanOrEqual(
        Math.min(actual.width, actual.height) / 2,
      );
      canvas = bindCatalogCanvas(root, root.pageRootRecords());
      const rect = root.getGeometry([record]).get(record)!;
      expect(rect.width, "canvas width").toBeCloseTo(expected.width, 2);
      expect(rect.height, "canvas height").toBeCloseTo(expected.height, 2);
      const painted = getSkiaNode(record)!;
      const rgba = ownCss.backgroundColor.match(/[\d.]+/g)!.map(Number);
      const color = painted.box!.fillColor!;
      for (let channel = 0; channel < 3; channel++)
        expect(color[channel] * 255).toBeCloseTo(rgba[channel], 1);
      expect(color[3]).toBeCloseTo(rgba[3] ?? 1, 3);
    } finally {
      canvas?.dispose();
      await act(async () => reactRoot.unmount());
      host.remove();
      workspace.dispose();
    }
  },
);
