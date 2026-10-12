import { describe, expect, it, vi } from "vitest";
import { CatalogCanvasViewState } from "./catalogCanvasViewState";

describe("Canvas scene view ownership", () => {
  it("publishes a new frame snapshot once and releases React consumers", () => {
    const source = new CatalogCanvasViewState();
    const notify = vi.fn();
    const release = source.subscribe(notify);
    const frames = [
      { id: "page", title: "Page", x: 0, y: 0, width: 100, height: 100 },
    ];
    source.publishFrames(frames);
    source.publishFrames(frames);
    expect(source.getFrames()).toBe(frames);
    expect(notify).toHaveBeenCalledTimes(1);
    release();
    source.publishFrames([]);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("old scene disposal cannot disconnect a newer scene's bounds", () => {
    const source = new CatalogCanvasViewState();
    const old = { x: 0, y: 0, width: 10, height: 10 };
    const current = { x: 20, y: 30, width: 40, height: 50 };
    const releaseOld = source.connectBounds(() => old);
    const releaseCurrent = source.connectBounds(() => current);
    releaseOld();
    expect(source.boundsOf("node")).toBe(current);
    releaseCurrent();
    expect(source.boundsOf("node")).toBeUndefined();
  });
});
