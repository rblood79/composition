import { fontFamily } from "@composition/specs";
import type { EmbindEnumEntity } from "canvaskit-wasm";
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
import type { CatalogTextMeasure } from "./compositionRoot";

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
): { max: number; min: number; lines: number; height: number } | undefined {
  if (!isCanvasKitInitialized() || !skiaFontManager.hasFont("Pretendard"))
    return undefined;
  const ck = getCanvasKit();
  const families = [skiaFontManager.resolveFamily("Pretendard")];
  const weight =
    (Object.values(ck.FontWeight) as EmbindEnumEntity[]).find(
      (entry) => entry?.value === font.fontWeight,
    ) ?? ck.FontWeight.Normal;
  const heightMultiplier = font.lineHeight > 0 ? font.lineHeight : undefined;
  const textStyle = {
    fontFamilies: families,
    fontSize: font.fontSize,
    fontStyle: { weight },
    fontFeatures: DEFAULT_FONT_FEATURES,
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
  builder.addText(text);
  const paragraph = builder.build();
  paragraph.layout(100000);
  const max = paragraph.getMaxIntrinsicWidth();
  const min = paragraph.getMinIntrinsicWidth();
  // CSS `white-space: normal` breaks only at break opportunities: a word wider than the box
  // overflows on its own line (the paragraph would split it), so wrap at no less than min-content.
  // (+0.5: the paragraph breaks a line that fits to the sub-pixel.)
  if (maxWidth !== undefined) paragraph.layout(Math.max(maxWidth, min) + 0.5);
  const metrics = {
    max,
    min,
    lines: paragraph.getLineMetrics().length,
    height: paragraph.getHeight(),
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
 * (ceil, the engine's content-box scalars; `exactWidth` unrounded for single-line labels) and one
 * line box; with `maxWidth` the `white-space: normal` wrapped height.
 */
export const catalogTextMeasure: CatalogTextMeasure = (
  text,
  font,
  maxWidth,
) => {
  const lineHeight =
    font.lineHeight > 0 ? font.fontSize * font.lineHeight : undefined;
  const paragraph = paragraphMetrics(text, font, maxWidth);
  if (paragraph) {
    const lineBox = (lines: number) =>
      lineHeight !== undefined ? lines * lineHeight : paragraph.height;
    if (maxWidth === undefined)
      return {
        width: Math.ceil(paragraph.max),
        exactWidth: paragraph.max,
        minWidth: Math.ceil(paragraph.min),
        height: lineBox(1),
      };
    return { width: maxWidth, height: lineBox(Math.max(1, paragraph.lines)) };
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
    undefined,
    undefined,
    lineHeight,
  );
  return { width: maxWidth, height: wrapped.height };
};
