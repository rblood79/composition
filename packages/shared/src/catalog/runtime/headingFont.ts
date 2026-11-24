/**
 * The browser's font size of a heading element, as a multiple of its parent's (HTML 「Rendering」
 * §15.3.7 Sections and headings — `h1` 2em · `h2` 1.5em · `h3` 1.17em · `h4` 1em · `h5` 0.83em ·
 * `h6` 0.67em). RAC's `Heading` is a bare `h{level}` (default 3) and S2's adds only its `styles`, so a
 * Heading without a size step of its own is drawn at this scale of the parent's font (2026-11-24,
 * 사용자 「1과2 모두」 — the browser's rule under, the owner's · author's values over). The Canvas reads
 * it; the DOM gets it from the browser.
 */
export const HTML_HEADING_FONT_SCALE: Readonly<Record<number, number>> = {
  1: 2,
  2: 1.5,
  3: 1.17,
  4: 1,
  5: 0.83,
  6: 0.67,
};

/** The scale of a Heading of `level` (unset or out of range = RAC's 3). */
export function catalogHeadingFontScale(level: unknown): number {
  return HTML_HEADING_FONT_SCALE[Number(level)] ?? HTML_HEADING_FONT_SCALE[3]!;
}
