import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateFpsFromFrameTimes, gpuProfiler } from "./gpuProfilerCore";

afterEach(() => {
  gpuProfiler.stop();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("calculateFpsFromFrameTimes", () => {
  it("preserves native refresh rates above 60Hz", () => {
    expect(calculateFpsFromFrameTimes([1000 / 120, 1000 / 120])).toBeCloseTo(
      120,
      5,
    );
  });

  it("returns zero when no frame has been measured", () => {
    expect(calculateFpsFromFrameTimes([])).toBe(0);
  });
});

describe("gpuProfiler", () => {
  it("does not record a synchronous sample when starting", () => {
    const queuedFrames: Array<(timestamp: number) => void> = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      (callback: (timestamp: number) => void) => {
        queuedFrames.push(callback);
        return 1;
      },
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    vi.spyOn(performance, "now")
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(116);

    gpuProfiler.start();

    expect(gpuProfiler.getFrameTime()).toBe(0);

    const queuedFrame = queuedFrames[0];
    if (!queuedFrame) {
      throw new Error("requestAnimationFrame callback was not queued");
    }
    queuedFrame(116);

    expect(gpuProfiler.getFrameTime()).toBeCloseTo(16, 5);
  });
});
