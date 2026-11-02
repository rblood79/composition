import { fontFamily } from "@composition/rendering";
import type { EmbindEnumEntity, Typeface } from "canvaskit-wasm";
import { DEFAULT_FONT_FEATURES } from "../workspace/canvas/layout/engines/cssResolver";
import {
  calculateMaxContentWidth,
  calculateMinContentWidth,
  measureTextWidth,
  measureTextWithWhiteSpace,
} from "../workspace/canvas/layout/engines/utils";
import { skiaFontManager } from "../workspace/canvas/skia/fontManager";
import {
  getCanvasKit,
  isCanvasKitInitialized,
} from "../workspace/canvas/skia/initCanvasKit";
import {
  catalogRunFont,
  catalogCssLineBaseline,
  type CatalogTextMeasure,
  type CatalogTextRunFont,
} from "./compositionRoot";
import {
  alignTextRuns,
  sliceTextRuns,
} from "../workspace/canvas/utils/textRunAlign";
import { catalogFontFamilies, catalogTextBreaksWords } from "./boxModel";
import {
  collapsesSegmentBreaks,
  transformSegmentBreaks,
} from "../workspace/canvas/utils/textWhiteSpace";
import {
  cssFontFamilyList,
  measureFontBox,
} from "../workspace/canvas/utils/textMeasure";

type Font = Parameters<CatalogTextMeasure>[1];

/**
 * The Canvas paint's own paragraph (`nodeRendererText`: shared font collection, Pretendard with
 * the default font features and the `wght` variation) measured without drawing: intrinsic widths
 * and, at `maxWidth`, the wrapped line count. Undefined before CanvasKit and the font are ready.
 */
function paragraphMetrics(
  text: string,
  font: Font,
  maxWidth?: number,
  runs?: readonly CatalogTextRunFont[],
):
  | {
      max: number;
      min: number;
      lines: number;
      height: number;
      firstBaseline?: number;
    }
  | undefined {
  if (!isCanvasKitInitialized() || !skiaFontManager.hasFont("Pretendard"))
    return undefined;
  const ck = getCanvasKit();
  const families = catalogFontFamilies(font.fontFamily).map((family) =>
    skiaFontManager.resolveFamily(family),
  );
  const slant =
    font.fontStyle === "italic"
      ? ck.FontSlant.Italic
      : font.fontStyle === "oblique"
        ? ck.FontSlant.Oblique
        : ck.FontSlant.Upright;
  const weight =
    (Object.values(ck.FontWeight) as EmbindEnumEntity[]).find(
      (entry) => entry?.value === font.fontWeight,
    ) ?? ck.FontWeight.Normal;
  const heightMultiplier = font.lineHeight > 0 ? font.lineHeight : undefined;
  const textStyle = {
    fontFamilies: families,
    fontSize: font.fontSize,
    fontStyle: { weight, slant },
    fontFeatures: DEFAULT_FONT_FEATURES,
    ...(font.letterSpacing ? { letterSpacing: font.letterSpacing } : {}),
    ...(heightMultiplier !== undefined
      ? { heightMultiplier, halfLeading: true }
      : {}),
  };
  const builder = ck.ParagraphBuilder.MakeFromFontCollection(
    new ck.ParagraphStyle({
      textStyle,
      ...(heightMultiplier !== undefined
        ? {
            strutStyle: {
              strutEnabled: true,
              fontFamilies: families,
              fontSize: font.fontSize,
              heightMultiplier,
              halfLeading: true,
            },
          }
        : {}),
    }),
    skiaFontManager.getFontCollection(),
  );
  builder.pushStyle(
    new ck.TextStyle({
      ...textStyle,
      fontVariations: [{ axis: "wght", value: font.fontWeight }],
    }),
  );
  if (runs?.length) {
    // ADR-299 — each run in its own font (the paint's `pushStyle` per run, `nodeRendererText`).
    let at = 0;
    for (const run of runs) {
      if (run.start > at) builder.addText(text.slice(at, run.start));
      const runFont = catalogRunFont(font, run);
      const runWeight =
        (Object.values(ck.FontWeight) as EmbindEnumEntity[]).find(
          (entry) => entry?.value === runFont.fontWeight,
        ) ?? ck.FontWeight.Normal;
      builder.pushStyle(
        new ck.TextStyle({
          ...textStyle,
          fontSize: runFont.fontSize,
          fontStyle: {
            weight: runWeight,
            slant:
              runFont.fontStyle === "italic"
                ? ck.FontSlant.Italic
                : runFont.fontStyle === "oblique"
                  ? ck.FontSlant.Oblique
                  : ck.FontSlant.Upright,
          },
          fontVariations: [{ axis: "wght", value: runFont.fontWeight }],
        }),
      );
      builder.addText(text.slice(run.start, run.end));
      builder.pop();
      at = run.end;
    }
    if (at < text.length) builder.addText(text.slice(at));
  } else builder.addText(text);
  const paragraph = builder.build();
  paragraph.layout(100000);
  const max = paragraph.getMaxIntrinsicWidth();
  const min = paragraph.getMinIntrinsicWidth();
  // CSS `white-space: normal` breaks only at break opportunities: a word wider than the box
  // overflows on its own line (the paragraph would split it), so wrap at no less than min-content
  // — unless the text may break inside a word (`overflow-wrap` / `word-break`), as the paragraph
  // does. (+0.5: the paragraph breaks a line that fits to the sub-pixel.)
  if (maxWidth !== undefined)
    paragraph.layout(
      (catalogTextBreaksWords(font) ? maxWidth : Math.max(maxWidth, min)) + 0.5,
    );
  const lineMetrics = paragraph.getLineMetrics();
  const firstLine = lineMetrics[0];
  let firstBaseline: number | undefined;
  if (runs?.length && firstLine) {
    const baselineOf = (value: Font) => {
      const box = catalogTextMeasure.fontBox?.(value);
      return box
        ? catalogCssLineBaseline(
            box,
            value.lineHeight > 0
              ? value.fontSize * value.lineHeight
              : undefined,
          )
        : undefined;
    };
    firstBaseline = baselineOf(font);
    for (const run of runs) {
      if (run.start >= firstLine.endIndex || run.end <= firstLine.startIndex)
        continue;
      const baseline = baselineOf(catalogRunFont(font, run));
      if (baseline !== undefined)
        firstBaseline = Math.max(firstBaseline ?? 0, baseline);
    }
  }
  const metrics = {
    max,
    min,
    lines: lineMetrics.length,
    height: paragraph.getHeight(),
    ...(firstBaseline !== undefined ? { firstBaseline } : {}),
  };
  paragraph.delete();
  builder.delete();
  return metrics;
}

/**
 * ADR-248 layout text measurement for the catalog composition root. With CanvasKit ready it
 * measures the paint's own paragraph (the glyphs the Canvas draws — default font features such as
 * Pretendard cv11 change advances, which Canvas 2D `measureText` cannot apply); before that the
 * shared Canvas 2D metrics. Without `maxWidth`: single-line max-content / min-content widths
 * (`width` ceil, intrinsic `exactWidth` and `minWidth` unrounded for CSS flex sizing) and one
 * line box; with `maxWidth` the `white-space: normal` wrapped height.
 */
export const catalogTextMeasure: CatalogTextMeasure = (
  raw,
  font,
  maxWidth,
  runs,
) => {
  // CSS white-space processing (the paint's paragraph follows the same rule, ADR-027): under
  // `normal` / `nowrap` a line break is one space; under the `pre` family it is a hard break, so
  // each line is measured on its own (`pre` never wraps) — the box grows with the lines.
  if (collapsesSegmentBreaks(font.whiteSpace)) {
    const block = transformSegmentBreaks(raw);
    return measureOneBlock(
      block,
      font,
      maxWidth,
      runs && alignTextRuns(raw, runs, block),
    );
  }
  if (!raw.includes("\n")) return measureOneBlock(raw, font, maxWidth, runs);
  const lineHeight =
    font.lineHeight > 0 ? font.fontSize * font.lineHeight : undefined;
  const lines = raw.split("\n");
  const lineWidth = font.whiteSpace === "pre" ? undefined : maxWidth;
  let height = 0;
  let width = 0;
  let minWidth = 0;
  let lineStart = 0;
  let firstBaseline: number | undefined;
  for (const [index, line] of lines.entries()) {
    const lineRuns =
      runs && sliceTextRuns(runs, lineStart, lineStart + line.length);
    lineStart += line.length + 1;
    const metrics = measureOneBlock(line || " ", font, lineWidth, lineRuns);
    // (By position, not by height: a zero-height first line still owns the first baseline.)
    if (index === 0) firstBaseline = metrics.firstBaseline;
    height += line ? metrics.height : (lineHeight ?? metrics.height);
    width = Math.max(width, metrics.width);
    minWidth = Math.max(minWidth, metrics.minWidth ?? metrics.width);
  }
  const baseline = firstBaseline !== undefined ? { firstBaseline } : {};
  return maxWidth === undefined
    ? { width, exactWidth: width, minWidth, height, ...baseline }
    : { width: maxWidth, height, ...baseline };
};

/**
 * The font box a CSS line box is built from — ascent · descent (Chrome rounds each to whole px)
 * and the x-height (`vertical-align: middle`) — for `leafBaseline` · the strut · `middle`.
 * Read from the CanvasKit typeface the Canvas paints with (the same Pretendard file the Preview
 * loads): Canvas 2D `fontBoundingBox*` reads the builder document's font, which may still be
 * loading when the root is built (a fallback font's 11.5 baseline instead of 12 — live 2026-11-02).
 * Before CanvasKit, the Canvas 2D metrics.
 */
catalogTextMeasure.fontBox = (font) =>
  canvasKitFontBox(font) ??
  measureFontBox(
    cssFontFamilyList(catalogFontFamilies(font.fontFamily)),
    font.fontSize,
    font.fontWeight,
  );

type FontBox = { ascent: number; descent: number; xHeight: number };
/** Per typeface (a reloaded font is a new object) and size. */
const fontBoxCache = new WeakMap<Typeface, Map<number, FontBox>>();

function canvasKitFontBox(font: Font): FontBox | undefined {
  if (!isCanvasKitInitialized() || !skiaFontManager.hasFont("Pretendard"))
    return undefined;
  const typeface =
    catalogFontFamilies(font.fontFamily)
      .map((family) =>
        skiaFontManager.getTypeface(skiaFontManager.resolveFamily(family)),
      )
      .find((face) => face !== undefined) ??
    skiaFontManager.getTypeface("Pretendard");
  if (!typeface) return undefined;
  let sizes = fontBoxCache.get(typeface);
  if (!sizes) fontBoxCache.set(typeface, (sizes = new Map()));
  const cached = sizes.get(font.fontSize);
  if (cached) return cached;
  const ck = getCanvasKit();
  // Glyph bounds come back in whole px (16px "x" → 9, Chrome's x-height 8.48): read the outline at
  // 1000px and scale.
  const face = new ck.Font(typeface, X_HEIGHT_PROBE_SIZE);
  try {
    const metrics = face.getMetrics();
    const bounds = face.getGlyphBounds(face.getGlyphIDs("x"));
    const scale = font.fontSize / X_HEIGHT_PROBE_SIZE;
    const box = {
      ascent: -metrics.ascent * scale,
      descent: metrics.descent * scale,
      xHeight: -bounds[1]! * scale,
    };
    sizes.set(font.fontSize, box);
    return box;
  } finally {
    face.delete();
  }
}
const X_HEIGHT_PROBE_SIZE = 1000;

/** One block of text with no hard breaks (the measure before white-space was read). */
const measureOneBlock = (
  text: string,
  font: Parameters<CatalogTextMeasure>[1],
  maxWidth: number | undefined,
  runs?: readonly CatalogTextRunFont[],
): ReturnType<CatalogTextMeasure> => {
  const lineHeight =
    font.lineHeight > 0 ? font.fontSize * font.lineHeight : undefined;
  const paragraph = paragraphMetrics(text, font, maxWidth, runs);
  if (paragraph) {
    // (Runs of other sizes make a line taller than the strut — the paragraph's own height, as the
    //  CSS line box grows with its tallest inline box.)
    const lineBox = (lines: number) =>
      lineHeight !== undefined && !runs?.length
        ? lines * lineHeight
        : paragraph.height;
    if (maxWidth === undefined)
      return {
        width: Math.ceil(paragraph.max),
        exactWidth: paragraph.max,
        minWidth: paragraph.min,
        height: lineBox(1),
        ...(paragraph.firstBaseline !== undefined
          ? { firstBaseline: paragraph.firstBaseline }
          : {}),
      };
    return {
      width: maxWidth,
      height: lineBox(Math.max(1, paragraph.lines)),
      ...(paragraph.firstBaseline !== undefined
        ? { firstBaseline: paragraph.firstBaseline }
        : {}),
    };
  }
  if (maxWidth === undefined) {
    const width = calculateMaxContentWidth(
      text,
      font.fontSize,
      fontFamily.sans,
      font.fontWeight,
    );
    const oneLine = measureTextWithWhiteSpace(
      text,
      font.fontSize,
      fontFamily.sans,
      font.fontWeight,
      "nowrap",
      width,
      undefined,
      undefined,
      lineHeight,
    );
    return {
      width,
      exactWidth: measureTextWidth(
        text,
        font.fontSize,
        fontFamily.sans,
        font.fontWeight,
      ),
      minWidth: calculateMinContentWidth(
        text,
        font.fontSize,
        fontFamily.sans,
        font.fontWeight,
      ),
      height: oneLine.height,
    };
  }
  const wrapped = measureTextWithWhiteSpace(
    text,
    font.fontSize,
    fontFamily.sans,
    font.fontWeight,
    "normal",
    maxWidth,
    font.wordBreak,
    font.overflowWrap ??
      (font.wordBreak === "break-word" ? "break-word" : undefined),
    lineHeight,
  );
  return { width: maxWidth, height: wrapped.height };
};
