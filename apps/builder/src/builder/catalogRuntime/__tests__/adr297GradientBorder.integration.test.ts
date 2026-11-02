// @vitest-environment node
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { CanvasKit } from "canvaskit-wasm";
import { afterEach, beforeAll, expect, it } from "vitest";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { resolveCatalogPaint } from "../../../../../../packages/shared/src/catalog/resolvers/resolveCatalogPaint";
import { paintGradientCss } from "../../../../../../packages/shared/src/catalog/rule/rulePaintTree";
import type { ComputedLayout } from "../../workspace/canvas/layout/engines/LayoutEngine";
import { initCanvasKit } from "../../workspace/canvas/skia/initCanvasKit";
import type { SkiaNodeData } from "../../workspace/canvas/skia/nodeRendererTypes";
import {
  buildRenderCommandStream,
  executeRenderCommands,
} from "../../workspace/canvas/skia/renderCommands";
import {
  clearSkiaRegistry,
  registerSkiaNode,
} from "../../workspace/canvas/skia/useSkiaNode";
import { applyCatalogAuthoredPaint } from "../authoredPaintCanvas";

let ck: CanvasKit;
beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const directory = dirname(require.resolve("canvaskit-wasm/bin/canvaskit.js"));
  ck = await require(join(directory, "canvaskit.js"))({
    locateFile: (file: string) => join(directory, file),
  });
  Object.assign(globalThis, {
    window: { __composition_CANVASKIT_INSTANCE__: ck },
  });
  await initCanvasKit();
});
afterEach(clearSkiaRegistry);

const rect = { x: 0, y: 0, width: 100, height: 32 };
const base = (radius = 0): SkiaNodeData => ({
  ...rect,
  type: "box",
  visible: true,
  box: {
    fillColor: Float32Array.of(0.9, 0.9, 0.9, 1),
    strokeColor: Float32Array.of(1, 0, 0, 1),
    strokeWidth: 4,
    borderRadius: radius,
  },
});

function pixels(
  data: SkiaNodeData,
  points: readonly (readonly [number, number])[],
) {
  registerSkiaNode("gradient-border", data);
  const stream = buildRenderCommandStream(
    ["gradient-border"],
    new Map(),
    new Map([["gradient-border", rect as ComputedLayout]]),
    {},
  );
  const surface = ck.MakeSurface(rect.width, rect.height)!;
  try {
    const canvas = surface.getCanvas();
    canvas.clear(ck.TRANSPARENT);
    executeRenderCommands(ck, canvas, stream.commands, rect as DOMRect);
    surface.flush();
    return points.map(([x, y]) =>
      Array.from(
        canvas.readPixels(x, y, {
          width: 1,
          height: 1,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Unpremul,
          colorSpace: ck.ColorSpace.SRGB,
        }) as Uint8Array,
      ),
    );
  } finally {
    surface.delete();
  }
}

for (const variant of ["genai", "premium"] as const) {
  for (const interactionState of ["default", "hover", "pressed"] as const) {
    it(`${variant} ${interactionState}: background order`, () => {
      const rule = COMPONENT_RULES_TABLE.Button!;
      const paint = resolveCatalogPaint({
        variant: rule.variants[variant],
        size: undefined,
        style: undefined,
        props: {},
        interactionState,
        fillStyleValues: rule.fillStyleValues,
      });
      const content: SkiaNodeData = {
        type: "box",
        x: 45,
        y: 12,
        width: 10,
        height: 8,
        visible: true,
        box: { fillColor: Float32Array.of(0, 1, 0, 1), borderRadius: 0 },
      };
      const data = applyCatalogAuthoredPaint(
        {
          id: "gradient-border",
          visual: { backgroundImage: paintGradientCss(paint.backgroundImage!) },
        },
        { ...base(8), children: [content] },
        rect,
      );
      const result = pixels(data, [
        [1, 16],
        [98, 16],
        [50, 1],
        [50, 30],
        [50, 16],
        [20, 16],
        [0, 0],
      ]);
      expect(result.slice(0, 4)).toEqual(
        Array.from({ length: 4 }, () => [255, 0, 0, 255]),
      );
      expect(result[4]).toEqual([0, 255, 0, 255]);
      expect(result[5]).not.toEqual([230, 230, 230, 255]);
      expect(result[6]).toEqual([0, 0, 0, 0]);
    });
  }
}

it("a translucent gradient preserves the background layers beneath it", () => {
  const node = base();
  node.box!.fillColor = Float32Array.of(0, 0, 1, 0.5);
  node.box!.fillUnderlays = [{ type: "color", rgba: [1, 0, 0, 1] }];
  const data = applyCatalogAuthoredPaint(
    {
      id: "gradient-border",
      visual: {
        backgroundImage:
          "linear-gradient(to bottom right, #00ff0080 0%, #00ff0080 100%)",
      },
    },
    node,
    rect,
  );
  const [pixel] = pixels(data, [[50, 16]]);
  expect(pixel[3]).toBe(255);
  expect(pixel[0]).toBeCloseTo(64, -1);
  expect(pixel[1]).toBeCloseTo(128, -1);
  expect(pixel[2]).toBeCloseTo(64, -1);
});
