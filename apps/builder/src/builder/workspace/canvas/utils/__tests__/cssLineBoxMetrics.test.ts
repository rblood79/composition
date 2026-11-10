import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { measureCssLineBox } from "../cssLineBoxMetrics";

/**
 * CANVAS_PERF_SCALING_2026-11 H1: while a face loads nothing is cached for good, so a cold open
 * measured the DOM once per text record. A repeat inside the same task reads the first box.
 */
const font = {
  fontFamily: "Pretendard",
  fontSize: 14,
  fontWeight: 400,
  fontStyle: "normal",
  lineHeight: 1.5,
} as Parameters<typeof measureCssLineBox>[0];

describe("measureCssLineBox cache while fonts load (H1)", () => {
  let reads = 0;
  let status: "loading" | "loaded" = "loading";
  let faceReady = false;
  beforeEach(() => {
    reads = 0;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => {
        reads++;
        return { top: 0, height: 20 } as DOMRect;
      },
    );
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        get status() {
          return status;
        },
        check: () => faceReady,
        ready: new Promise(() => {}),
        addEventListener: () => {},
      },
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    status = "loading";
    faceReady = false;
  });

  it("reads the DOM once per key in one task while loading, and again in the next task", async () => {
    const epoch = {};
    const first = measureCssLineBox(font, epoch);
    const perMeasure = reads;
    expect(perMeasure).toBeGreaterThan(0);
    for (let index = 0; index < 50; index++)
      expect(measureCssLineBox(font, epoch)).toBe(first);
    expect(reads).toBe(perMeasure);
    // Another key in the same task is measured.
    measureCssLineBox({ ...font, fontSize: 16 }, epoch);
    expect(reads).toBe(perMeasure * 2);
    // The next task may see the loaded face: measured again.
    await Promise.resolve();
    measureCssLineBox(font, epoch);
    expect(reads).toBe(perMeasure * 3);
  });

  it("keeps a box read after the fonts loaded across tasks", async () => {
    status = "loaded";
    faceReady = true;
    const epoch = {};
    const first = measureCssLineBox(font, epoch);
    const perMeasure = reads;
    await Promise.resolve();
    expect(measureCssLineBox(font, epoch)).toBe(first);
    expect(reads).toBe(perMeasure);
  });
});
