import { beforeEach, describe, expect, it } from "vitest";
import { useViewportSyncStore } from "../canvas/stores";
import { getScrollbarViewportMetrics } from "./viewportMetrics";

describe("ADR-922 Canvas-local scrollbar viewport metrics", () => {
  beforeEach(() => {
    useViewportSyncStore.getState().reset();
    useViewportSyncStore.getState().setContainerSize({
      width: 800,
      height: 600,
    });
  });

  it("actual canvas container 전체를 visible viewport로 사용하고 panel inset을 재차 차감하지 않는다", () => {
    const metrics = getScrollbarViewportMetrics({
      scale: 2,
      x: -100,
      y: -40,
    });

    expect(metrics?.visibleViewport).toEqual({
      width: 400,
      height: 300,
      x: 50,
      y: 20,
    });
    expect(metrics?.containerSize).toEqual({ width: 800, height: 600 });
  });

  it("covers the artboards the Canvas passes (catalog page frames) instead of the old store's pages", () => {
    const metrics = getScrollbarViewportMetrics({ scale: 1, x: 0, y: 0 }, [
      { x: 0, y: 0, width: 1000, height: 700 },
      { x: 1100, y: 0, width: 1000, height: 700 },
    ]);
    // Union 0..2100 × 0..700, padded by 200.
    expect(metrics?.world).toMatchObject({
      minX: -200,
      maxX: 2300,
      minY: -200,
      maxY: 900,
    });
  });
});
