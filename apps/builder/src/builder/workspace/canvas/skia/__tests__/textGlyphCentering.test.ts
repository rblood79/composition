import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveCssBaselineCorrection } from "../textGlyphCentering";

// Pretendard: ascent 0.952em · descent 0.241em. Painted = SkParagraph's rounded baseline, measured on
// a CanvasKit raster surface (2026-11-02): 15.6875 → 16 · 16.1875 → 16 · 16.6875 → 17 · 12.27 → 12.
const pretendard = (size: number) => ({
  fontAscent: 0.952 * size,
  fontDescent: 0.241 * size,
});

describe("resolveCssBaselineCorrection — the painted baseline goes where the CSS line box puts it", () => {
  it("16px · line 20: CSS 15.5, painted 16 → 0.5px up", () => {
    expect(
      resolveCssBaselineCorrection({
        lineHeight: 20,
        ...pretendard(16),
        paragraphBaseline: 15.6875,
      }),
    ).toBe(-0.5);
  });

  it("16px · line 22: CSS 16.5, painted 17 → 0.5px up", () => {
    expect(
      resolveCssBaselineCorrection({
        lineHeight: 22,
        ...pretendard(16),
        paragraphBaseline: 16.6875,
      }),
    ).toBe(-0.5);
  });

  it("already the same: 16px · line 21 (16 · 16), 12px · line 16 (12 · 12), 32px · line 40 (31 · 31)", () => {
    expect(
      resolveCssBaselineCorrection({
        lineHeight: 21,
        ...pretendard(16),
        paragraphBaseline: 16.1875,
      }),
    ).toBe(0);
    expect(
      resolveCssBaselineCorrection({
        lineHeight: 16,
        ...pretendard(12),
        paragraphBaseline: 12.2656,
      }),
    ).toBe(0);
    expect(
      resolveCssBaselineCorrection({
        lineHeight: 40,
        ...pretendard(32),
        paragraphBaseline: 31.375,
      }),
    ).toBe(0);
  });

  it("no explicit line height, or a DOM font that is not the drawn one: no move", () => {
    expect(
      resolveCssBaselineCorrection({
        lineHeight: 0,
        ...pretendard(16),
        paragraphBaseline: 15.14,
      }),
    ).toBe(0);
    expect(
      resolveCssBaselineCorrection({
        lineHeight: 20,
        fontAscent: 30,
        fontDescent: 2,
        paragraphBaseline: 15.6875,
      }),
    ).toBe(0);
  });
});

/**
 * A single line in a padded box (Badge, Tag …) is centred by its line box like the DOM's — not by the
 * glyphs' ink. **Why (2026-11-02, user report)**: ink centring lifted "gButton" in a Badge above the
 * same text in a Button (the g's descender stretched the ink downwards); the Preview does not move it.
 * ADR-027 D3 (2026-09-20) had brought ink centring in with an alphabetic origin; the parity target is
 * the CSS line box.
 */
describe("nodeRendererText 는 한 줄을 글리프 잉크로 가운데 놓지 않는다 (static)", () => {
  it("ink 측정 · ideographic 원점 호출 0, CSS baseline 보정은 쓴다", () => {
    const source = readFileSync(
      resolve(__dirname, "../nodeRendererText.ts"),
      "utf8",
    );
    expect(source).not.toContain("getIdeographicBaseline");
    expect(source).not.toContain("containsIdeographicText(");
    expect(source).not.toContain("measureActualTextBounds(");
    expect(source).not.toContain("resolveSingleLineGlyphTop(");
    expect(source).toContain("resolveCssBaselineCorrection(");
  });
});
