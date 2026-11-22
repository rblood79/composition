import { describe, expect, it, vi } from "vitest";
import type { Canvas, CanvasKit } from "canvaskit-wasm";
import { buildSpacingBands } from "../interaction/spacingGeometry";
import { renderSpacingOverlay } from "./spacingOverlayRenderer";

/**
 * 2026-11-22 — 스크롤 상자의 넘친 gap 핸들은 그리지 않는다. 항목 300 인 ListBox 를 선택하면 핸들
 * 303 을 매 프레임 그려 (paint 606 대여) 거의 전부가 clip 에 버려졌다 (ratchet scroll-boxes scroll
 * `caches.paintPool.hits` 7,598 → 65,168). 그리는 핸들 = 히트되는 핸들 (`spacingHandleInView`).
 */
function mockCk() {
  class MockPaint {
    setAntiAlias(): void {}
    setStyle(): void {}
    setColor(): void {}
    setStrokeWidth(): void {}
    setStrokeCap(): void {}
    setStrokeJoin(): void {}
    setBlendMode(): void {}
    setPathEffect(): void {}
    setShader(): void {}
    setImageFilter(): void {}
    setColorFilter(): void {}
  }
  return {
    Paint: MockPaint,
    PaintStyle: { Fill: 0, Stroke: 1 },
    StrokeCap: { Butt: 0 },
    StrokeJoin: { Miter: 0 },
    BlendMode: { SrcOver: 0 },
    ClipOp: { Intersect: 1 },
    BLACK: [0, 0, 0, 1],
    Color4f: (...c: number[]) => c,
    LTRBRect: (l: number, t: number, r: number, b: number) => [l, t, r, b],
    RRectXY: (rect: number[]) => rect,
  } as unknown as CanvasKit;
}

function mockCanvas() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    clipRect: vi.fn(),
    drawRRect: vi.fn(),
  };
}

describe("renderSpacingOverlay — clip 밖 핸들 (2026-11-22)", () => {
  const items = Array.from({ length: 300 }, (_, i) => ({
    x: 4,
    y: 4 + i * 20,
    width: 232,
    height: 20,
  }));
  const ownerBounds = { x: 0, y: 0, width: 240, height: 300 };
  const bands = buildSpacingBands({
    ownerBounds,
    border: { top: 0, right: 0, bottom: 0, left: 0 },
    padding: { top: 4, right: 4, bottom: 4, left: 4 },
    gap: { axis: "vertical", value: 0, reverse: false, childBounds: items },
  });

  it("가시 영역에 걸친 핸들만 그린다 (303 → 19, 핸들마다 stroke · fill 2 번)", () => {
    const canvas = mockCanvas();
    renderSpacingOverlay(mockCk(), canvas as unknown as Canvas, {
      bands,
      clipRect: ownerBounds,
      hoveredBandId: null,
      active: null,
      zoom: 1,
    });
    expect(canvas.drawRRect).toHaveBeenCalledTimes(19 * 2);
  });

  it("가시 영역 정보가 없으면 모두 그린다", () => {
    const canvas = mockCanvas();
    renderSpacingOverlay(mockCk(), canvas as unknown as Canvas, {
      bands,
      clipRect: null,
      hoveredBandId: null,
      active: null,
      zoom: 1,
    });
    expect(canvas.drawRRect).toHaveBeenCalledTimes(303 * 2);
  });
});
