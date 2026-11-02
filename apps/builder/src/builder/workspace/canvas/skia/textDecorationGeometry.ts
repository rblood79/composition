/**
 * Where a CSS `text-decoration` line sits, so the Canvas draws it as the Preview does.
 *
 * SkParagraph places its decorations from the font's underline metrics (16px Pretendard: 1.1px thick,
 * 1.15px under the baseline); Chrome uses its own rules (measured 2026-11-02, Chrome 156, DPR 2):
 * thickness = font size / 10 snapped to device px, underline 1px (or half the thickness) under the
 * baseline, overline on top of the rounded ascent, line-through a third of the ascent up. The
 * Canvas text was thinner and lower than the Preview's (user report).
 *
 * `baseline` is where the line's glyphs are painted; `fontAscent` the DOM font's ascent
 * (`fontBoundingBoxAscent`). Bits: 1 underline · 2 overline · 4 line-through (`parseTextDecoration`).
 */
export interface CssDecorationInput {
  fontSize: number;
  fontAscent: number;
  baseline: number;
  /** Device pixels per CSS px — Chrome snaps the thickness to them. */
  dpr: number;
  decoration: number;
}

export interface CssDecorationLine {
  top: number;
  thickness: number;
}

export function resolveCssDecorationLines(
  input: CssDecorationInput,
): CssDecorationLine[] {
  const { fontSize, fontAscent, baseline, decoration } = input;
  const dpr = input.dpr > 0 ? input.dpr : 1;
  const auto = fontSize / 10;
  const thickness = Math.max(1, Math.round(auto * dpr)) / dpr;
  const gap = Math.max(1, Math.ceil(auto / 2));
  const ascent = Math.round(fontAscent);
  const lines: CssDecorationLine[] = [];
  if (decoration & 1) lines.push({ top: baseline + gap, thickness });
  if (decoration & 2)
    lines.push({ top: baseline - ascent - thickness, thickness });
  if (decoration & 4)
    lines.push({ top: baseline - ascent / 3 - gap, thickness });
  return lines;
}

/**
 * SkParagraph adds half the letter spacing before each glyph and half after; CSS adds it all after.
 * Moving the paragraph by this puts the glyphs where the Preview has them (the line width is the
 * same — every glyph carries the whole spacing in both).
 */
export function cssLetterSpacingShift(
  letterSpacing: number | undefined,
): number {
  return letterSpacing ? -letterSpacing / 2 : 0;
}
