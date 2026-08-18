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
});
