import { describe, expect, it } from "vitest";
import {
  cssLetterSpacingShift,
  resolveCssDecorationLines,
} from "../textDecorationGeometry";

/**
 * Chrome 156 (DPR 2) measured 2026-11-02 — Pretendard, a DOM span scaled ×10 and read from the
 * screenshot: thickness = font size / 10 snapped to device px (16 → 1.5, 32 → 3); underline top =
 * baseline + max(1, ceil(t / 2)) (16 → +1, 32 → +2); overline top = baseline − round(ascent) − t
 * (16 → −16.5); line-through top = baseline − round(ascent) / 3 − max(1, ceil(t / 2)) (16 → −6,
 * 32 → −12).
 */
describe("resolveCssDecorationLines — the lines a CSS text-decoration draws", () => {
  const at16 = { fontSize: 16, fontAscent: 15.23, baseline: 100, dpr: 2 };

  it("underline: 1.5 thick, 1px under the baseline", () => {
    expect(resolveCssDecorationLines({ ...at16, decoration: 1 })).toEqual([
      { top: 101, thickness: 1.5 },
    ]);
  });

  it("overline: above the font ascent", () => {
    expect(resolveCssDecorationLines({ ...at16, decoration: 2 })).toEqual([
      { top: 83.5, thickness: 1.5 },
    ]);
  });

  it("line-through: a third of the ascent up, less the gap", () => {
    expect(resolveCssDecorationLines({ ...at16, decoration: 4 })).toEqual([
      { top: 94, thickness: 1.5 },
    ]);
  });

  it("32px: thickness 3, underline +2, line-through −12", () => {
    const at32 = { fontSize: 32, fontAscent: 30.46, baseline: 100, dpr: 2 };
    expect(resolveCssDecorationLines({ ...at32, decoration: 1 | 4 })).toEqual([
      { top: 102, thickness: 3 },
      { top: 88, thickness: 3 },
    ]);
  });

  it("DPR 1 snaps to whole px; never thinner than one device px", () => {
    expect(
      resolveCssDecorationLines({ ...at16, dpr: 1, decoration: 1 }),
    ).toEqual([{ top: 101, thickness: 1 }]);
    expect(
      resolveCssDecorationLines({
        fontSize: 4,
        fontAscent: 3.8,
        baseline: 10,
        dpr: 1,
        decoration: 1,
      }),
    ).toEqual([{ top: 11, thickness: 1 }]);
  });
});

describe("cssLetterSpacingShift — SkParagraph splits the spacing around each glyph, CSS puts it after", () => {
  it("letter-spacing 4: Skia's first glyph is 2px late (CanvasKit raster: ink 0.6 → 2.6)", () => {
    expect(cssLetterSpacingShift(4)).toBe(-2);
    expect(cssLetterSpacingShift(-2)).toBe(1);
    expect(cssLetterSpacingShift(undefined)).toBe(0);
  });
});
