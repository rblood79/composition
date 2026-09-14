// @vitest-environment node

/**
 * ADR-219 P2 — 비균일 border 렌더 (실제 CanvasKit, SW surface 픽셀)
 *
 * 브라우저 parity (G2) 는 tests/visual-parity 가 잰다. 여기는 렌더러 계약 3개를
 * 픽셀로 못박는다:
 *  1. 반투명 변 마스크 (top·right) — 코너 호가 **한 번만** 칠해진다 (두 번이면 알파 겹침).
 *  2. `[80,0,0,0]` 100×100 — CSS §4.5: 축소 없음 (종전 clamp 50 이면 (12,12) 가 배경이 아니다).
 *  3. 균일 노드 (strokeWidths 없음) 는 종전 경로 — 픽셀 무변경 (HC1 회귀 고정용 해시).
 */
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

function render(ck: CanvasKit, node: SkiaNodeData): Uint8Array {
  const surface = ck.MakeSurface(node.width, node.height);
  if (!surface) throw new Error("MakeSurface");
  try {
    const canvas = surface.getCanvas();
    canvas.clear(ck.Color4f(1, 1, 1, 1));
    renderBox(ck, canvas, node);
    surface.flush();
    const img = surface.makeImageSnapshot();
    const px = img.readPixels(0, 0, {
      width: node.width,
      height: node.height,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB,
    }) as Uint8Array;
    img.delete();
    return new Uint8Array(px);
  } finally {
    surface.delete();
  }
}

const at = (px: Uint8Array, w: number, x: number, y: number) =>
  Array.from(px.subarray((y * w + x) * 4, (y * w + x) * 4 + 3));

function box(
  w: number,
  h: number,
  b: NonNullable<SkiaNodeData["box"]>,
): SkiaNodeData {
  return {
    type: "box",
    x: 0,
    y: 0,
    width: w,
    height: h,
    visible: true,
    box: b,
  };
}

describe("ADR-219 — 비균일 border 렌더 (CanvasKit SW)", () => {
  let ck: CanvasKit;
  beforeAll(async () => {
    ck = await loadCanvasKit();
  });

  it("반투명 변 마스크: TR 코너 호가 한 번만 칠해진다", () => {
    const w = 160;
    const h = 110;
    const px = render(
      ck,
      box(w, h, {
        fillColor: Float32Array.of(1, 1, 1, 1),
        borderRadius: 20,
        strokeColor: Float32Array.of(0, 0, 0, 0.5),
        strokeWidth: 6,
        strokeWidths: [6, 6, 0, 0],
      }),
    );
    // 직선 구간 (top 중앙) — 흰 위 50% 검정 = ~128
    const straight = at(px, w, 80, 3);
    expect(straight[0]).toBeGreaterThan(115);
    expect(straight[0]).toBeLessThan(140);
    // TR 호 위 45° 지점 — 코너 중심 (140,20), 반경 17 (중심선) → (152, 8)
    const arc = at(px, w, 152, 8);
    expect(Math.abs(arc[0] - straight[0])).toBeLessThanOrEqual(12);
    // 두 번 칠했다면 ~64 — 그 값이 아니다
    expect(arc[0]).toBeGreaterThan(100);
    // left 변 0 — 왼쪽 직선 구간은 배경
    expect(at(px, w, 3, 55)).toEqual([255, 255, 255]);
    // bottom 변 0
    expect(at(px, w, 80, h - 3)).toEqual([255, 255, 255]);
  });

  it("[80,0,0,0] 100×100 — CSS §4.5 는 축소하지 않는다 (clamp 50 이면 (12,12) 가 채워진다)", () => {
    const px = render(
      ck,
      box(100, 100, {
        fillColor: Float32Array.of(0, 0, 1, 1),
        borderRadius: [80, 0, 0, 0],
      }),
    );
    // r=80: 코너 중심 (80,80). (12,12) 까지 거리 ≈ 96 > 80 → 배경. r=50 이면 중심 (50,50) 거리 54 > 50 → 배경이긴 하나
    // (30,30): r=80 → 거리 70.7 < 80 → 채움 · r=50 → 거리 28 < 50 → 채움. 판별점은 (8,40): r=80 → 거리 82.5 > 80 배경,
    // r=50 → 중심 (50,50) 거리 43 < 50 채움.
    expect(at(px, 100, 8, 40)).toEqual([255, 255, 255]);
    expect(at(px, 100, 30, 30)).toEqual([0, 0, 255]);
    expect(at(px, 100, 95, 5)).toEqual([0, 0, 255]); // TR 반경 0
  });

  it("임의 폭 4값 + solid: 띠는 변마다 자기 폭, 안쪽은 채움", () => {
    const w = 100;
    const h = 80;
    const px = render(
      ck,
      box(w, h, {
        fillColor: Float32Array.of(0, 0, 1, 1),
        borderRadius: 0,
        strokeColor: Float32Array.of(1, 0, 0, 1),
        strokeWidth: 14,
        strokeWidths: [2, 10, 6, 14],
      }),
    );
    expect(at(px, w, 50, 1)).toEqual([255, 0, 0]); // top 2
    expect(at(px, w, 50, 3)).toEqual([0, 0, 255]);
    expect(at(px, w, w - 5, 40)).toEqual([255, 0, 0]); // right 10
    expect(at(px, w, w - 12, 40)).toEqual([0, 0, 255]);
    expect(at(px, w, 50, h - 3)).toEqual([255, 0, 0]); // bottom 6
    expect(at(px, w, 50, h - 8)).toEqual([0, 0, 255]);
    expect(at(px, w, 7, 40)).toEqual([255, 0, 0]); // left 14
    expect(at(px, w, 16, 40)).toEqual([0, 0, 255]);
  });

  it("dashed 비균일: 변 stroke 가 wedge 밖으로 새지 않는다", () => {
    const w = 100;
    const h = 80;
    const px = render(
      ck,
      box(w, h, {
        fillColor: Float32Array.of(1, 1, 1, 1),
        borderRadius: 0,
        strokeColor: Float32Array.of(1, 0, 0, 1),
        strokeWidth: 8,
        strokeWidths: [8, 0, 0, 0],
        strokeStyle: "dashed",
      }),
    );
    // top 8 만 — 그 아래는 전부 흰색
    for (let y = 9; y < h; y += 7)
      expect(at(px, w, 50, y)).toEqual([255, 255, 255]);
    // top 띠 (y=4) 에 dash 가 있다 — 빨강과 흰색이 둘 다 나온다
    const row = Array.from({ length: w }, (_, x) => at(px, w, x, 4)[1]);
    expect(row.some((g) => g === 0)).toBe(true);
    expect(row.some((g) => g === 255)).toBe(true);
  });
});
