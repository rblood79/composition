// @vitest-environment jsdom

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Canvas, CanvasKit, Image, Surface } from "canvaskit-wasm";
import { SkiaRenderer } from "./SkiaRenderer";
import type { CameraState } from "./types";
import type { BoundingBox } from "../selection/types";

const require = createRequire(import.meta.url);
const size = 96;

/** GPU 생성자만 생략하고 실제 부분 갱신/standby 복사 메서드를 실행한다. */
interface DamageRenderer {
  contentSnapshot: Image;
  contentSurface: Surface;
  standbySurface: Surface;
  pendingDamage: BoundingBox | null;
  renderDamagedContent(camera: CameraState, damage: BoundingBox): boolean;
}

describe("SkiaRenderer 부분 갱신 — 전체 렌더와 픽셀 일치", () => {
  let ck: CanvasKit;
  beforeAll(async () => {
    const bin = dirname(require.resolve("canvaskit-wasm/bin/canvaskit.js"));
    const initialize = require(join(bin, "canvaskit.js")) as (options: {
      locateFile: (file: string) => string;
    }) => Promise<CanvasKit>;
    ck = await initialize({ locateFile: (file) => join(bin, file) });
  });

  function pixels(surface: Surface): Uint8Array {
    return surface.getCanvas().readPixels(0, 0, {
      width: size,
      height: size,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB,
    }) as Uint8Array;
  }

  function differences(actual: Uint8Array, expected: Uint8Array): number {
    let count = 0;
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) count++;
    }
    return count;
  }

  for (const dpr of [1, 2]) {
    for (const zoom of [1, 1.7]) {
      for (const dark of [false, true]) {
        for (const alpha of [1, 0.5]) {
          it(`DPR ${dpr}, zoom ${zoom}, ${dark ? "dark" : "light"}, alpha ${alpha}: 반복·축소·삭제`, () => {
            const surfaces = [
              ck.MakeSurface(size, size)!,
              ck.MakeSurface(size, size)!,
            ];
            const oracle = ck.MakeSurface(size, size)!;
            const camera = { zoom, panX: 0.25, panY: -0.375 };
            const pad = 4;
            const paint = new ck.Paint();
            paint.setAntiAlias(true);
            let width = 18;
            let visible = true;
            const damage = { x: 10.5, y: 10.5, width: 18, height: 12 };
            const queried: DOMRect[] = [];
            const draw = (canvas: Canvas, bounds?: DOMRect): void => {
              if (bounds) queried.push(bounds);
              paint.setColor(
                dark
                  ? ck.Color(28, 25, 23, alpha)
                  : ck.Color(245, 245, 245, alpha),
              );
              canvas.drawRect(ck.LTRBRect(-1000, -1000, 1000, 1000), paint);
              if (visible) {
                paint.setColor(ck.Color(70, 100, 190, 0.7));
                canvas.drawRect(
                  ck.LTRBRect(10.5, 10.5, 10.5 + width, 22.5),
                  paint,
                );
              }
            };
            const full = (surface: Surface): void => {
              const canvas = surface.getCanvas();
              canvas.clear(ck.TRANSPARENT);
              canvas.save();
              canvas.scale(dpr, dpr);
              canvas.translate(pad / dpr, pad / dpr);
              canvas.translate(camera.panX, camera.panY);
              canvas.scale(zoom, zoom);
              draw(canvas);
              canvas.restore();
              surface.flush();
            };
            surfaces.forEach(full);
            const renderer = Object.assign(
              Object.create(SkiaRenderer.prototype),
              {
                ck,
                contentSurface: surfaces[0],
                contentCanvas: surfaces[0].getCanvas(),
                contentSnapshot: surfaces[0].makeImageSnapshot(),
                standbySurface: surfaces[1],
                standbyCanvas: surfaces[1].getCanvas(),
                standbyContentSynchronized: true,
                contentPaddingDevicePx: pad,
                dpr,
                snapshotCamera: { ...camera },
                pendingFull: false,
                transitionManager: null,
                animationEngine: null,
                contentNode: {
                  renderDamageSkia(canvas: Canvas, bounds: DOMRect): number {
                    draw(canvas, bounds);
                    return 2;
                  },
                },
              },
            ) as DamageRenderer;
            try {
              for (const step of ["repeat", "repeat", "shrink", "delete"]) {
                if (step === "shrink") width = 8;
                if (step === "delete") visible = false;
                renderer.pendingDamage = damage;
                expect(renderer.renderDamagedContent(camera, damage)).toBe(
                  true,
                );
                full(oracle);
                const expected = pixels(oracle);
                expect(
                  differences(pixels(renderer.contentSurface), expected),
                  `${step}: content`,
                ).toBe(0);
                expect(
                  differences(pixels(renderer.standbySurface), expected),
                  `${step}: standby`,
                ).toBe(0);
              }
              // clear로 넓어진 device pixel 전체를 contributor 검색도 덮는다.
              const bounds = queried[0];
              const device = [
                (bounds.x * zoom + camera.panX) * dpr + pad,
                (bounds.y * zoom + camera.panY) * dpr + pad,
                ((bounds.x + bounds.width) * zoom + camera.panX) * dpr + pad,
                ((bounds.y + bounds.height) * zoom + camera.panY) * dpr + pad,
              ];
              for (const edge of device)
                expect(edge).toBeCloseTo(Math.round(edge), 8);
              expect(bounds.x).toBeLessThanOrEqual(damage.x - 1 / zoom);
              expect(bounds.y).toBeLessThanOrEqual(damage.y - 1 / zoom);
              const surfaceRight =
                (size / dpr - camera.panX - pad / dpr) / zoom;
              const surfaceBottom =
                (size / dpr - camera.panY - pad / dpr) / zoom;
              expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(
                Math.min(surfaceRight, damage.x + damage.width + 1 / zoom),
              );
              expect(bounds.y + bounds.height).toBeGreaterThanOrEqual(
                Math.min(surfaceBottom, damage.y + damage.height + 1 / zoom),
              );
            } finally {
              renderer.contentSnapshot.delete();
              surfaces.forEach((surface) => surface.delete());
              oracle.delete();
              paint.delete();
            }
          });
        }
      }
    }
  }
});
