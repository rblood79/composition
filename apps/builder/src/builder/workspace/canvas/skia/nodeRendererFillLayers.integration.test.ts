// @vitest-environment node

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { CanvasKit } from "canvaskit-wasm";
import { renderBox } from "./nodeRendererBorders";
import type { SkiaNodeData } from "./nodeRendererTypes";

interface CanvasKitInitializer {
  (options: { locateFile: (file: string) => string }): Promise<CanvasKit>;
}

const require = createRequire(import.meta.url);

async function loadCanvasKit(): Promise<CanvasKit> {
  const binDirectory = dirname(
    require.resolve("canvaskit-wasm/bin/canvaskit.js"),
  );
  const initialize = require(
    join(binDirectory, "canvaskit.js"),
  ) as CanvasKitInitializer;
  return initialize({ locateFile: (file) => join(binDirectory, file) });
}

/** 8×8 surface 에 그리고 가운데 픽셀 [r, g, b, a] (0~255) */
function renderCenterPixel(ck: CanvasKit, node: SkiaNodeData): number[] {
  const surface = ck.MakeSurface(8, 8)!;
  const canvas = surface.getCanvas();
  canvas.clear(ck.TRANSPARENT);
  renderBox(ck, canvas, node);
  surface.flush();
  const pixels = canvas.readPixels(4, 4, {
    width: 1,
    height: 1,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  }) as Uint8Array;
  surface.delete();
  return Array.from(pixels.slice(0, 4));
}

function node(box: NonNullable<SkiaNodeData["box"]>): SkiaNodeData {
  return { type: "box", x: 0, y: 0, width: 8, height: 8, visible: true, box };
}

describe("renderBox — 다층 fill (fillUnderlays, 2026-09-15)", () => {
  let ck: CanvasKit;
  beforeAll(async () => {
    ck = await loadCanvasKit();
  });

  it("아래 층 위에 fillColor 를 겹쳐 칠한다 (빨강 위에 파랑 50% = 보라)", () => {
    const [r, g, b, a] = renderCenterPixel(
      ck,
      node({
        fillColor: Float32Array.of(0, 0, 1, 0.5),
        borderRadius: 0,
        fillUnderlays: [{ type: "color", rgba: [1, 0, 0, 1] }],
      }),
    );
    expect(a).toBe(255);
    expect(r).toBeGreaterThan(110);
    expect(r).toBeLessThan(145);
    expect(b).toBeGreaterThan(110);
    expect(b).toBeLessThan(145);
    expect(g).toBeLessThan(10);
  });

  it("단층 (fillUnderlays 없음) 은 fillColor 하나 — 종전 경로", () => {
    const [r, g, b, a] = renderCenterPixel(
      ck,
      node({ fillColor: Float32Array.of(0, 0, 1, 0.5), borderRadius: 0 }),
    );
    expect([r, g]).toEqual([0, 0]);
    expect(b).toBe(255);
    expect(a).toBeGreaterThan(120);
    expect(a).toBeLessThan(136);
  });

  it("그래디언트 아래 층 위에 단색 맨 위 층 — shader 층도 순서대로 (위 층이 불투명이면 위 층 색)", () => {
    const [r, g, b] = renderCenterPixel(
      ck,
      node({
        fillColor: Float32Array.of(0, 1, 0, 1),
        borderRadius: 0,
        fillUnderlays: [
          {
            type: "linear-gradient",
            colors: [
              [1, 0, 0, 1],
              [0, 0, 1, 1],
            ],
            positions: [0, 1],
            start: [0, 0],
            end: [8, 0],
          } as never,
        ],
      }),
    );
    expect([r, g, b]).toEqual([0, 255, 0]);
  });
});
