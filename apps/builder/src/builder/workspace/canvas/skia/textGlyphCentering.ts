/**
 * How far to move a paragraph so its painted first baseline sits where a CSS line box puts it.
 *
 * SkParagraph paints each line at its baseline **rounded to whole px** inside the paragraph
 * (16px Pretendard in a 20px line: reported 15.6875, painted 16 — measured on a CanvasKit raster
 * surface 2026-11-02). Chrome's line box rounds the font's ascent and descent first and splits the
 * rest as half-leading: round(15.23) + (20 − 15 − 4) / 2 = 15.5. The Canvas text sat 0.5px under the
 * Preview's and the edit field's (user report: a bordered Text not centred in its box, Compare Mode
 * showed CSS and the edit field agree).
 *
 * `fontAscent` · `fontDescent` are the DOM font's ascent / descent (Canvas 2D `fontBoundingBox*`).
 * Only for an explicit line height — `normal` follows other rules. Bounded to ±1px: a wider gap means
 * the DOM font is not the drawn one (not loaded yet).
 */
export interface CssBaselineCorrectionInput {
  lineHeight: number;
  fontAscent: number;
  fontDescent: number;
  /** The paragraph's first-line baseline as SkParagraph reports it (paragraph top based). */
  paragraphBaseline: number;
}

export function resolveCssBaselineCorrection(
  input: CssBaselineCorrectionInput,
): number {
  const { lineHeight, fontAscent, fontDescent, paragraphBaseline } = input;
  if (!(lineHeight > 0) || !(fontAscent > 0) || !(fontDescent >= 0)) return 0;
  const ascent = Math.round(fontAscent);
  const descent = Math.round(fontDescent);
  const cssBaseline = ascent + (lineHeight - ascent - descent) / 2;
  const painted = Math.round(paragraphBaseline);
  const correction = cssBaseline - painted;
  return Math.abs(correction) <= 1 ? correction : 0;
}
