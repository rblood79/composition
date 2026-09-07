// @vitest-environment node

/**
 * ADR-194 Phase 1 G1 — `renderPath` 를 **실제 CanvasKit surface** 에 래스터화해
 * 픽셀로 확인한다. converter 단위 테스트(specShapeConverter.path.test.ts)는 노드
 * 데이터까지만 보고, 이 테스트가 그 데이터가 실제로 칠해지는지를 본다 (R2 —
 * 분기 누락 시 조용한 미렌더).
 *
 * 삼각형(fill) · arc 명령 `A`(stroke) · evenodd 도넛 3종을 그리고, 안쪽/바깥쪽
 * 픽셀을 직접 읽는다. `A` 를 쓰는 이유: 파이 마크가 자체 `arcPath` 로 SVG `A`
 * 명령을 내는데(breakdown §3-2 marks/pie), CanvasKit `MakeFromSVGString` 이 그걸
 * 실제로 파싱하는지가 v1 파이 차트의 전제다.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { CanvasKit, Surface } from "canvaskit-wasm";
import { renderPath } from "./nodeRendererShapes";
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

const W = 64;
const H = 64;

/** RGBA 픽셀 1개를 읽는다 (surface 는 premul RGBA8888). */
function readPixel(
  ck: CanvasKit,
  surface: Surface,
  x: number,
  y: number,
): [number, number, number, number] {
  const pixels = surface.getCanvas().readPixels(0, 0, {
    width: W,
    height: H,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  }) as Uint8Array | null;
  expect(pixels).not.toBeNull();
  const i = (y * W + x) * 4;
  return [pixels![i], pixels![i + 1], pixels![i + 2], pixels![i + 3]];
}

function pathNode(path: NonNullable<SkiaNodeData["path"]>): SkiaNodeData {
  return {
    type: "path",
    x: 0,
    y: 0,
    width: W,
    height: H,
    visible: true,
    path,
  };
}

describe("renderPath 실제 CanvasKit 렌더 (ADR-194 G1)", () => {
  let ck: CanvasKit;
  let surface: Surface;

  beforeAll(async () => {
    ck = await loadCanvasKit();
  });

  function draw(node: SkiaNodeData): void {
    surface = ck.MakeSurface(W, H)!;
    expect(surface).toBeTruthy();
    surface.getCanvas().clear(ck.TRANSPARENT);
    renderPath(ck, surface.getCanvas(), node);
    surface.flush();
  }

  it("삼각형 fill — 내부는 칠해지고 바깥 모서리는 비어 있다", () => {
    draw(
      pathNode({
        d: "M 8 8 L 56 8 L 32 56 Z",
        offsetX: 0,
        offsetY: 0,
        fillColor: Float32Array.of(1, 0, 0, 1),
        strokeWidth: 0,
      }),
    );
    // 삼각형 무게중심 근처 = 내부
    expect(readPixel(ck, surface, 32, 20)).toEqual([255, 0, 0, 255]);
    // 좌하단 모서리 = 빗변 바깥
    expect(readPixel(ck, surface, 2, 60)[3]).toBe(0);
    surface.delete();
  });

  it("arc 명령 `A` 를 파싱해 stroke 한다 (파이 마크 전제)", () => {
    // (32,32) 중심 반지름 20 의 위쪽 반원 호 — 좌(12,32) → 우(52,32)
    draw(
      pathNode({
        d: "M 12 32 A 20 20 0 0 1 52 32",
        offsetX: 0,
        offsetY: 0,
        strokeColor: Float32Array.of(0, 0, 1, 1),
        strokeWidth: 4,
      }),
    );
    // 호의 꼭대기 (32,12) 위에 선이 지난다
    expect(readPixel(ck, surface, 32, 12)[2]).toBeGreaterThan(200);
    // 호 안쪽(중심)은 stroke-only 라 비어 있다
    expect(readPixel(ck, surface, 32, 32)[3]).toBe(0);
    surface.delete();
  });

  it("3차 베지어 `C` 를 파싱해 stroke 한다 (monotone 보간 전제)", () => {
    // (4,32) → (60,32) 로 가되 제어점을 위로 당긴 곡선. 중앙은 직선보다 위를 지난다.
    draw(
      pathNode({
        d: "M 4 32 C 22.67 8 41.33 8 60 32",
        offsetX: 0,
        offsetY: 0,
        strokeColor: Float32Array.of(0, 0, 1, 1),
        strokeWidth: 4,
      }),
    );
    // 곡선은 중앙에서 y≈16 근처를 지난다 (제어점 y=8 과 끝점 y=32 사이).
    expect(readPixel(ck, surface, 32, 16)[2]).toBeGreaterThan(200);
    // 직선이었다면 지났을 (32,32) 는 비어 있어야 곡선으로 그려진 것이다.
    expect(readPixel(ck, surface, 32, 32)[3]).toBe(0);
    surface.delete();
  });

  it("evenodd — 도넛 안쪽 구멍이 뚫린다 (nonzero 면 채워진다)", () => {
    // 바깥 사각형 + 안쪽 사각형, 같은 방향(둘 다 시계) 이라 nonzero 로는 안 뚫린다.
    const donut = "M 4 4 H 60 V 60 H 4 Z M 20 20 H 44 V 44 H 20 Z";

    draw(
      pathNode({
        d: donut,
        offsetX: 0,
        offsetY: 0,
        fillColor: Float32Array.of(0, 1, 0, 1),
        strokeWidth: 0,
        fillRule: "evenodd",
      }),
    );
    expect(readPixel(ck, surface, 10, 10)).toEqual([0, 255, 0, 255]); // 링
    expect(readPixel(ck, surface, 32, 32)[3]).toBe(0); // 구멍
    surface.delete();

    draw(
      pathNode({
        d: donut,
        offsetX: 0,
        offsetY: 0,
        fillColor: Float32Array.of(0, 1, 0, 1),
        strokeWidth: 0,
      }),
    );
    expect(readPixel(ck, surface, 32, 32)).toEqual([0, 255, 0, 255]); // 채워짐
    surface.delete();
  });

  it("호로 만든 고리는 가운데가 뚫린다 (도넛 전제)", () => {
    // arcSlicePath(32,32, r=28, inner=14, 0, 360) 와 같은 구조 — 바깥 원(sweep 1)
    //   + 안쪽 원(sweep 0). evenodd 로 안쪽을 뚫는다.
    const donut =
      "M 32 4 A 28 28 0 1 1 32 60 A 28 28 0 1 1 32 4 Z " +
      "M 32 18 A 14 14 0 1 0 32 46 A 14 14 0 1 0 32 18 Z";
    draw(
      pathNode({
        d: donut,
        offsetX: 0,
        offsetY: 0,
        fillColor: Float32Array.of(0, 0, 1, 1),
        fillRule: "evenodd",
        strokeWidth: 0,
      }),
    );
    // 고리 위(32,10)는 칠해지고 가운데(32,32)는 비어 있다.
    expect(readPixel(ck, surface, 32, 10)[2]).toBeGreaterThan(200);
    expect(readPixel(ck, surface, 32, 32)[3]).toBe(0);
    surface.delete();
  });

  it("offset 이 그리는 위치를 옮긴다 (노드는 원점 유지)", () => {
    draw(
      pathNode({
        d: "M 0 0 H 12 V 12 H 0 Z",
        offsetX: 40,
        offsetY: 40,
        fillColor: Float32Array.of(0, 0, 0, 1),
        strokeWidth: 0,
      }),
    );
    expect(readPixel(ck, surface, 45, 45)[3]).toBe(255);
    expect(readPixel(ck, surface, 5, 5)[3]).toBe(0);
    surface.delete();
  });

  it("fill·stroke 둘 다 없으면 아무것도 그리지 않는다 (조기 반환)", () => {
    draw(pathNode({ d: "M 8 8 H 56 V 56 H 8 Z", offsetX: 0, offsetY: 0, strokeWidth: 0 }));
    expect(readPixel(ck, surface, 32, 32)[3]).toBe(0);
    surface.delete();
  });
});
