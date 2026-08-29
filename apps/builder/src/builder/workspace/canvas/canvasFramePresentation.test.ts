import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPagePositionPresentationSnapshot } from "./interaction/pagePositionPresentation";
import {
  getCanvasFramePresentationSnapshot,
  publishCanvasFramePresentation,
  resetCanvasFramePresentation,
  subscribeCanvasFramePresentation,
} from "./canvasFramePresentation";

describe("canvasFramePresentation", () => {
  beforeEach(() => resetCanvasFramePresentation());

  it("Skia가 소비하는 camera/page snapshot identity를 그대로 전달한다", () => {
    const listener = vi.fn();
    const cameraState = { panX: 20, panY: 30, zoom: 0.5 };
    const pagePositionSnapshot = getPagePositionPresentationSnapshot();
    const unsubscribe = subscribeCanvasFramePresentation(listener);

    publishCanvasFramePresentation(cameraState, pagePositionSnapshot);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(cameraState, pagePositionSnapshot);
    expect(getCanvasFramePresentationSnapshot()).toEqual({
      cameraState,
      pagePositionSnapshot,
    });

    unsubscribe();
    publishCanvasFramePresentation(cameraState, pagePositionSnapshot);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
