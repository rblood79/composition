import { describe, expect, it } from "vitest";
import { calculateFpsFromFrameTimes } from "./gpuProfilerCore";

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
