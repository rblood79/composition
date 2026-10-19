import { afterEach, describe, expect, it } from "vitest";

import { setBorderSnapRatio, snapBorderWidth } from "../border";

/**
 * The Canvas's border widths follow Blink `ClampLineWidth` — the same rule as the engine's
 * `snap_line_width` (`style.rs`), so a drawn border fills the box the engine laid out.
 */
describe("snapBorderWidth", () => {
  afterEach(() => setBorderSnapRatio(undefined));

  it("no ratio: the authored width", () => {
    expect(snapBorderWidth(0.5)).toBe(0.5);
    expect(snapBorderWidth(1.5)).toBe(1.5);
  });

  it("DPR 1: 0 < w < 1 → 1, else floor", () => {
    setBorderSnapRatio(1);
    for (const [width, used] of [
      [0.5, 1],
      [0.01, 1],
      [1, 1],
      [1.5, 1],
      [2.7, 2],
      [0, 0],
    ])
      expect(snapBorderWidth(width), String(width)).toBe(used);
  });

  it("DPR 2: device pixels — a hairline is one device pixel", () => {
    setBorderSnapRatio(2);
    expect(snapBorderWidth(0.5)).toBe(0.5);
    expect(snapBorderWidth(0.3)).toBe(0.5);
    expect(snapBorderWidth(1.25)).toBe(1);
  });

  it("fractional DPR: idempotent (a snapped width snaps to itself)", () => {
    setBorderSnapRatio(1.5);
    const once = snapBorderWidth(1);
    expect(once).toBeCloseTo(1 / 1.5, 6);
    expect(snapBorderWidth(once)).toBe(once);
  });
});
