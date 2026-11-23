import type { CanvasKit, ParagraphBuilder } from "canvaskit-wasm";

/**
 * A TokenInput's token chip in a paragraph (S2 체크리스트 §4.1 TokenField Phase 3) — the Preview's
 * `.react-aria-Token` is an inline box with `white-space: nowrap`: its padding · border take advance at
 * each end and the line never breaks inside it (tokens are whitespace-delimited, so it breaks only
 * around it). The layout measure (`catalogTextMeasure`) and the paint (`nodeRendererText`) put the same
 * thing in the paragraph: one zero-height placeholder on the baseline as wide as the token's text +
 * both insets — atomic like the box, the line box left alone. The paint draws the chip and the token's
 * text at it. (SkParagraph breaks next to a placeholder whatever surrounds it — two edge placeholders
 * around the text left the start edge at the end of the previous line, 2026-11-23 live.)
 */
export function addChipPlaceholder(
  ck: CanvasKit,
  builder: ParagraphBuilder,
  width: number,
): void {
  builder.addPlaceholder(
    width,
    0,
    ck.PlaceholderAlignment.Baseline,
    ck.TextBaseline.Alphabetic,
    0,
  );
}

/**
 * Indices of `text` (with `runs`' chip runs as one placeholder each) in the paragraph's text: `[i]` for
 * each UTF-16 index and `[text.length]` for the end — every character of a chip run maps to its
 * placeholder.
 */
export function chipParagraphIndices(
  text: string,
  runs: readonly { start: number; end: number; chip?: unknown }[],
): Int32Array {
  const map = new Int32Array(text.length + 1);
  let at = 0;
  let p = 0;
  for (const run of runs) {
    if (!run.chip || run.end <= run.start) continue;
    for (; at < run.start; at++) map[at] = p++;
    for (; at < run.end; at++) map[at] = p;
    p++;
  }
  for (; at < text.length; at++) map[at] = p++;
  map[text.length] = p;
  return map;
}
