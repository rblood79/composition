import type { Canvas, CanvasKit, Paragraph } from "canvaskit-wasm";
import { acquirePooledPaint, releasePooledPaint } from "./paints";

/**
 * ADR-314 Phase 3 — S2 `SkeletonText` (`box-decoration-break: clone` · radius `sm`): one rounded
 * box per laid-out line, no words. The box is the look's inline span's line box fragment, so it
 * follows how the DOM paints that span's background (Chromium · WebKit, 2026-11-19):
 * - height = the span's own font content area (the host's first available font — `fontBox`), on the
 *   line's baseline. A larger run (RichText) or a fallback face on the line does not grow it.
 * - width = the line's glyphs; with preserved spaces (`pre` · `pre-wrap`) the trailing ones too — a
 *   `pre-wrap` line's hanging spaces included.
 * - an ellipsis line runs to `ellipsisRight` (the host's padding box end, where its overflow clips
 *   the span — the span itself holds the whole text).
 */
export interface SkeletonLineOptions {
  /** CSS keeps the line's trailing spaces (`white-space: pre` · `pre-wrap`). */
  keepTrailingSpaces: boolean;
  /** The span's font ascent · descent (`measureFontBox`). Without it: the glyphs' tight rects. */
  fontBox?: { ascent: number; descent: number };
  /** An ellipsis line's right edge in paragraph x. */
  ellipsisRight?: number;
}

export type SkeletonLineRect = [
  left: number,
  top: number,
  right: number,
  bottom: number,
];

/** The line boxes in paragraph coordinates. */
export function skeletonLineRects(
  ck: CanvasKit,
  paragraph: Paragraph,
  options: SkeletonLineOptions,
): SkeletonLineRect[] {
  const out: SkeletonLineRect[] = [];
  for (const line of paragraph.getLineMetrics()) {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const box of paragraph.getRectsForRange(
      line.startIndex,
      options.keepTrailingSpaces ? line.endIndex : line.endExcludingWhitespaces,
      ck.RectHeightStyle.Tight,
      ck.RectWidthStyle.Tight,
    )) {
      const [l, t, r, b] = box.rect;
      left = Math.min(left, l!);
      top = Math.min(top, t!);
      right = Math.max(right, r!);
      bottom = Math.max(bottom, b!);
    }
    if (options.fontBox) {
      top = line.baseline - options.fontBox.ascent;
      bottom = line.baseline + options.fontBox.descent;
    }
    if (options.ellipsisRight !== undefined) right = options.ellipsisRight;
    if (!(right > left) || !(bottom > top)) continue;
    out.push([left, top, right, bottom]);
  }
  return out;
}

export function drawSkeletonLines(
  ck: CanvasKit,
  canvas: Canvas,
  paragraph: Paragraph,
  drawX: number,
  drawY: number,
  skeleton: { color: Float32Array; radius: number },
  options: SkeletonLineOptions,
): void {
  const paint = acquirePooledPaint(ck);
  try {
    paint.setAntiAlias(true);
    paint.setColor(skeleton.color);
    for (const [left, top, right, bottom] of skeletonLineRects(
      ck,
      paragraph,
      options,
    )) {
      canvas.drawRRect(
        ck.RRectXY(
          ck.LTRBRect(drawX + left, drawY + top, drawX + right, drawY + bottom),
          skeleton.radius,
          skeleton.radius,
        ),
        paint,
      );
    }
  } finally {
    releasePooledPaint(paint);
  }
}
