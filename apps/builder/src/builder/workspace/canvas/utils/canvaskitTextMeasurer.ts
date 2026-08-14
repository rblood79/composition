/**
 * CanvasKit 기반 TextMeasurer 구현
 *
 * Canvas 2D API 대신 CanvasKit의 Paragraph API를 사용하여
 * 정확한 텍스트 측정을 수행합니다.
 *
 * @since 2026-02-17 Phase 0
 */

import type {
  TextMeasurer,
  TextMeasureStyle,
  TextMeasureResult,
} from "./textMeasure";
import type {
  CanvasKit,
  FontWeight,
  ParagraphStyle,
  FontMgr,
} from "canvaskit-wasm";
import { getCanvasKit, isCanvasKitInitialized } from "../skia/initCanvasKit";
import { skiaFontManager } from "../skia/fontManager";
import { DEFAULT_FONT_FAMILY } from "../../../fonts/customFonts";
import {
  resolveFontVariantFeatures,
  resolveFontStretchWidth,
  DEFAULT_FONT_FEATURES,
} from "../layout/engines/cssResolver";
import {
  cssNormalBreakProcess,
  computeKeepAllWidth,
  preprocessBreakWordText,
} from "./textWrapUtils";
import {
  USE_CANVAS2D_MEASURE,
  needsFallback,
  measureWithCanvas2D,
  buildFontKey,
  buildFontString,
  getOrMeasureWidth,
} from "./canvas2dSegmentCache";

// ============================================
// CanvasKit enum 매핑 헬퍼
// ============================================

/** fontStyle → CanvasKit FontSlant enum */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveSlant(ck: any, fs?: number | string): any {
  if (fs === 1 || fs === "italic") return ck.FontSlant.Italic;
  if (fs === 2 || fs === "oblique") return ck.FontSlant.Oblique;
  return ck.FontSlant.Upright;
}

/** fontWeight → CanvasKit FontWeight enum (nodeRenderers.ts와 동일) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveWeight(ck: any, fw?: number | string): any {
  // CSS fontWeight 키워드 → 숫자: 'normal'→400, 'bold'→700
  const namedWeights: Record<string, number> = { normal: 400, bold: 700 };
  const w =
    typeof fw === "number"
      ? fw
      : (namedWeights[String(fw).toLowerCase()] ??
        (parseInt(String(fw), 10) || 400));
  const map: Record<number, FontWeight> = {
    100: ck.FontWeight.Thin,
    200: ck.FontWeight.ExtraLight,
    300: ck.FontWeight.Light,
    400: ck.FontWeight.Normal,
    500: ck.FontWeight.Medium,
    600: ck.FontWeight.SemiBold,
    700: ck.FontWeight.Bold,
    800: ck.FontWeight.ExtraBold,
    900: ck.FontWeight.Black,
  };
  return map[w] ?? ck.FontWeight.Normal;
}

/**
 * CSS fontFamily 체인을 split+resolve하여 렌더러(specShapeConverter.ts)와
 * 동일한 fontFamilies 배열을 생성한다.
 *
 * 렌더러: shape.fontFamily.split(",") → map trim/unquote → resolveFamily()
 * 측정기도 동일 처리해야 CanvasKit text shaping 결과(폭)가 일치한다.
 */
function buildFontFamilies(fontFamilyCSS: string | undefined): string[] {
  const rawFamilies = (fontFamilyCSS ?? DEFAULT_FONT_FAMILY)
    .split(",")
    .map((f) => f.trim().replace(/['"]/g, ""))
    .filter(Boolean);
  const resolved = rawFamilies.map((f) => skiaFontManager.resolveFamily(f));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const f of resolved) {
    if (!seen.has(f)) {
      seen.add(f);
      result.push(f);
    }
  }
  if (!seen.has(DEFAULT_FONT_FAMILY)) result.push(DEFAULT_FONT_FAMILY);
  return result;
}

/** fontStretch → CanvasKit FontWidth enum */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveWidth(ck: any, stretch?: string): any {
  if (!stretch || stretch === "normal") return ck.FontWidth.Normal;
  const idx = resolveFontStretchWidth(stretch);
  const entries = [
    ck.FontWidth.UltraCondensed,
    ck.FontWidth.ExtraCondensed,
    ck.FontWidth.Condensed,
    ck.FontWidth.SemiCondensed,
    ck.FontWidth.Normal,
    ck.FontWidth.SemiExpanded,
    ck.FontWidth.Expanded,
    ck.FontWidth.ExtraExpanded,
    ck.FontWidth.UltraExpanded,
  ];
  return entries[idx - 1] ?? ck.FontWidth.Normal;
}

// ============================================
// 측정 결과 캐시 (WASM Paragraph 객체가 아닌 결과값만 캐싱)
// ============================================

const _widthCache = new Map<string, number>();
const _wrappedCache = new Map<string, TextMeasureResult>();
const MAX_MEASURE_CACHE_SIZE = 1000;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _measureCacheFontMgr: any = null;

function invalidateMeasureCacheIfNeeded(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fontMgr: any,
): void {
  if (_measureCacheFontMgr !== fontMgr) {
    _widthCache.clear();
    _wrappedCache.clear();
    _measureCacheFontMgr = fontMgr;
  }
}

function buildWidthCacheKey(text: string, style: TextMeasureStyle): string {
  return [
    text,
    style.fontSize,
    style.fontFamily,
    style.fontWeight ?? 400,
    style.fontStyle ?? 0,
    style.fontVariant ?? "",
    style.fontStretch ?? "",
    style.letterSpacing ?? 0,
    style.wordSpacing ?? 0,
    style.lineHeight ?? 0,
  ].join("\0");
}

function buildWrappedCacheKey(
  text: string,
  style: TextMeasureStyle,
  maxWidth: number,
): string {
  return [
    text,
    maxWidth,
    style.fontSize,
    style.fontFamily,
    style.fontWeight ?? 400,
    style.fontStyle ?? 0,
    style.fontVariant ?? "",
    style.fontStretch ?? "",
    style.letterSpacing ?? 0,
    style.wordSpacing ?? 0,
    style.lineHeight ?? 0,
    style.wordBreak ?? "normal",
    style.overflowWrap ?? "normal",
  ].join("\0");
}

function lruSet<V>(cache: Map<string, V>, key: string, value: V): void {
  if (cache.size >= MAX_MEASURE_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

// Vite HMR에서 모듈이 교체될 때 캐시 누수 방지
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    _widthCache.clear();
    _wrappedCache.clear();
  });
}

/**
 * CanvasKit Paragraph API 기반 텍스트 측정기
 *
 * CanvasKit의 ParagraphBuilder를 사용하여 HarfBuzz 정확도의
 * 텍스트 측정을 수행합니다.
 */
export class CanvasKitTextMeasurer implements TextMeasurer {
  measureWidth(text: string, style: TextMeasureStyle): number {
    if (!text) return 0;

    // ADR-051: Canvas 2D 측정 경로 — measureWrapped와 동일한 엔진 사용
    // CanvasKit 초기화 전후 모두 Canvas 2D로 측정하여 폭 차이 제거
    if (USE_CANVAS2D_MEASURE && !needsFallback(style)) {
      const fontKey = buildFontKey(style);
      const fontString = buildFontString(style);
      return getOrMeasureWidth(text, fontKey, fontString);
    }

    if (!isCanvasKitInitialized()) return text.length * (style.fontSize * 0.5);

    const ck = getCanvasKit();
    const fontMgr = skiaFontManager.getFontMgr();
    if (!ck || !fontMgr) return text.length * (style.fontSize * 0.5);

    // 캐시 무효화 체크 + 캐시 조회
    invalidateMeasureCacheIfNeeded(fontMgr);
    const cacheKey = buildWidthCacheKey(text, style);
    const cached = _widthCache.get(cacheKey);
    if (cached !== undefined) return cached;

    // nodeRenderers.ts의 renderText()와 동일한 textStyle 구성
    // heightMultiplier / halfLeading도 렌더러와 일치시켜야
    // getMaxIntrinsicWidth()가 동일한 text shaping 결과를 반환
    const variantFeatures = style.fontVariant
      ? resolveFontVariantFeatures(style.fontVariant)
      : [];
    const fontFeatures = [...DEFAULT_FONT_FEATURES, ...variantFeatures];
    // 렌더러(specShapeConverter)와 동일하게 CSS 체인 전체를 split+resolve
    const fontFamilies = buildFontFamilies(style.fontFamily);
    const heightMultiplier = style.lineHeight
      ? style.lineHeight / style.fontSize
      : 0;
    const paraStyle = new ck.ParagraphStyle({
      textStyle: {
        fontSize: style.fontSize,
        fontFamilies,
        fontStyle: {
          weight: resolveWeight(ck, style.fontWeight),
          slant: resolveSlant(ck, style.fontStyle),
          width: resolveWidth(ck, style.fontStretch),
        },
        letterSpacing: style.letterSpacing ?? 0,
        wordSpacing: style.wordSpacing ?? 0,
        ...(heightMultiplier > 0
          ? { heightMultiplier, halfLeading: true }
          : {}),
        ...(fontFeatures.length > 0 ? { fontFeatures } : {}),
      },
      // strutStyle: CSS line-height 강제 적용 (렌더러와 동기화)
      ...(heightMultiplier > 0
        ? {
            strutStyle: {
              strutEnabled: true,
              fontFamilies,
              fontSize: style.fontSize,
              heightMultiplier,
              halfLeading: true,
              forceStrutHeight: true,
            },
          }
        : {}),
    });

    const builder = ck.ParagraphBuilder.Make(paraStyle, fontMgr);
    builder.addText(text);
    const paragraph = builder.build();
    // 단일 라인 측정: 무한 너비로 layout
    paragraph.layout(1e6);
    const width = paragraph.getMaxIntrinsicWidth();

    paragraph.delete();
    builder.delete();

    lruSet(_widthCache, cacheKey, width);
    return width;
  }

  measureWrapped(
    text: string,
    style: TextMeasureStyle,
    maxWidth: number,
  ): TextMeasureResult {
    const lineHeight = style.lineHeight ?? style.fontSize * 1.2;
    if (!text || maxWidth <= 0) return { width: 0, height: lineHeight };

    // ADR-051: Canvas 2D 3-Tier 측정 경로
    // needsFallback()이 false면 Canvas 2D 세그먼트 캐시 사용
    // CSS Preview와 동일한 브라우저 폰트 엔진 → ~99% 줄바꿈 정합성
    if (USE_CANVAS2D_MEASURE && !needsFallback(style)) {
      const result = measureWithCanvas2D(text, style, maxWidth);
      return { width: result.width, height: result.height };
    }

    if (!isCanvasKitInitialized()) {
      // Fallback: rough estimate
      const charWidth = style.fontSize * 0.5;
      const charsPerLine = Math.max(1, Math.floor(maxWidth / charWidth));
      const lines = Math.ceil(text.length / charsPerLine);
      return { width: maxWidth, height: lines * lineHeight };
    }

    const ck = getCanvasKit();
    const fontMgr = skiaFontManager.getFontMgr();
    if (!ck || !fontMgr) {
      return { width: maxWidth, height: lineHeight };
    }

    // 캐시 무효화 체크 + 캐시 조회
    invalidateMeasureCacheIfNeeded(fontMgr);
    const cacheKey = buildWrappedCacheKey(text, style, maxWidth);
    const cached = _wrappedCache.get(cacheKey);
    if (cached) return cached;

    // measureWidth와 동일한 textStyle + halfLeading (CSS line-height 상하 균등 분배)
    const variantFeatures = style.fontVariant
      ? resolveFontVariantFeatures(style.fontVariant)
      : [];
    const fontFeatures = [...DEFAULT_FONT_FEATURES, ...variantFeatures];
    // 렌더러(specShapeConverter)와 동일하게 CSS 체인 전체를 split+resolve
    const fontFamilies = buildFontFamilies(style.fontFamily);
    const heightMultiplier = style.lineHeight
      ? style.lineHeight / style.fontSize
      : 0;
    const paraStyle = new ck.ParagraphStyle({
      textStyle: {
        fontSize: style.fontSize,
        fontFamilies,
        fontStyle: {
          weight: resolveWeight(ck, style.fontWeight),
          slant: resolveSlant(ck, style.fontStyle),
          width: resolveWidth(ck, style.fontStretch),
        },
        letterSpacing: style.letterSpacing ?? 0,
        wordSpacing: style.wordSpacing ?? 0,
        ...(heightMultiplier > 0
          ? { heightMultiplier, halfLeading: true }
          : {}),
        ...(fontFeatures.length > 0 ? { fontFeatures } : {}),
      },
      // strutStyle: CSS line-height 강제 적용 (렌더러와 동기화)
      ...(heightMultiplier > 0
        ? {
            strutStyle: {
              strutEnabled: true,
              fontFamilies,
              fontSize: style.fontSize,
              heightMultiplier,
              halfLeading: true,
              forceStrutHeight: true,
            },
          }
        : {}),
    });

    // ADR-008: word-break × overflow-wrap 조합 테이블 기반 에뮬레이션
    const wb = style.wordBreak ?? "normal";
    const ow = style.overflowWrap ?? "normal";

    // ADR-008: overflow-wrap: break-word/anywhere
    // 렌더링 경로(nodeRenderers)와 동일한 전처리 + CanvasKit layout으로 높이를 측정하여
    // 측정-렌더링 경로 일치를 보장한다.
    if ((ow === "break-word" || ow === "anywhere") && wb !== "break-all") {
      if (wb === "keep-all") {
        // keep-all + break-word: computeKeepAllWidth로 effectiveWidth 조정 (렌더링과 동일)
        const effectiveMaxWidth = computeKeepAllWidth(
          ck,
          paraStyle,
          fontMgr,
          text,
          maxWidth,
          true,
        );
        const builder = ck.ParagraphBuilder.Make(paraStyle, fontMgr);
        builder.addText(text);
        const paragraph = builder.build();
        paragraph.layout(effectiveMaxWidth);
        const height = paragraph.getHeight();
        const width = paragraph.getLongestLine();
        paragraph.delete();
        builder.delete();
        const result = { width, height };
        lruSet(_wrappedCache, cacheKey, result);
        return result;
      }
      // normal + break-word: preprocessBreakWordText + CanvasKit layout (렌더링과 동일)
      const processed = preprocessBreakWordText(
        ck,
        paraStyle,
        fontMgr,
        text,
        maxWidth,
      );
      const builder = ck.ParagraphBuilder.Make(paraStyle, fontMgr);
      builder.addText(processed);
      const paragraph = builder.build();
      paragraph.layout(maxWidth);
      const height = paragraph.getHeight();
      const width = paragraph.getLongestLine();
      paragraph.delete();
      builder.delete();
      const result = { width, height };
      lruSet(_wrappedCache, cacheKey, result);
      return result;
    }

    // ADR-008: normal+normal → CSS 줄바꿈 시뮬레이션으로 텍스트 전처리
    let processedText = text;
    let effectiveMaxWidth: number;

    if (wb === "normal" && ow === "normal") {
      const result = cssNormalBreakProcess(
        ck,
        paraStyle,
        fontMgr,
        text,
        maxWidth,
      );
      processedText = result.text;
      effectiveMaxWidth = result.effectiveWidth;
    } else if (wb === "break-all") {
      // break-all: ZWS 삽입으로 모든 문자 사이에 줄바꿈 가능 지점 생성
      processedText = Array.from(text).join("\u200B");
      effectiveMaxWidth = this.computeEffectiveMaxWidth(
        ck,
        paraStyle,
        fontMgr,
        text,
        maxWidth,
        wb,
        ow,
      );
    } else {
      effectiveMaxWidth = this.computeEffectiveMaxWidth(
        ck,
        paraStyle,
        fontMgr,
        text,
        maxWidth,
        wb,
        ow,
      );
    }

    const builder = ck.ParagraphBuilder.Make(paraStyle, fontMgr);
    builder.addText(processedText);
    const paragraph = builder.build();
    paragraph.layout(effectiveMaxWidth);

    const height = paragraph.getHeight();
    const width = paragraph.getLongestLine();

    paragraph.delete();
    builder.delete();

    const result = { width, height };
    lruSet(_wrappedCache, cacheKey, result);
    return result;
  }

  /**
   * ADR-008 조합 테이블 기반 effectiveMaxWidth 계산
   *
   * | word-break | overflow-wrap       | effectiveLayoutWidth                          |
   * |-----------|---------------------|-----------------------------------------------|
   * | normal    | normal              | max(maxWidth, ceil(maxWordWidth))              |
   * | normal    | break-word/anywhere | maxWidth (CanvasKit 기본 = break-word)          |
   * | break-all | (any)               | maxWidth (ZWS로 이미 분할 가능)                  |
   * | keep-all  | normal              | max(maxWidth, ceil(maxWordWidth_keepall))      |
   * | keep-all  | break-word          | 넘침 시 maxWidth, 아니면 keep-all               |
   */
  private computeEffectiveMaxWidth(
    ck: CanvasKit,
    paraStyle: ParagraphStyle,
    fontMgr: FontMgr,
    text: string,
    maxWidth: number,
    wordBreak: string,
    overflowWrap: string,
  ): number {
    // break-all: ZWS 삽입으로 분할 완료 → maxWidth 그대로
    if (wordBreak === "break-all") return maxWidth;

    // overflow-wrap: break-word/anywhere → CanvasKit 기본 동작 (= break-word)
    if (overflowWrap === "break-word" || overflowWrap === "anywhere") {
      if (wordBreak === "keep-all") {
        // keep-all + break-word: CJK 단어 넘침 시에만 분할 허용
        return computeKeepAllWidth(
          ck,
          paraStyle,
          fontMgr,
          text,
          maxWidth,
          true,
        );
      }
      return maxWidth;
    }

    // keep-all + normal: CJK 연속도 단어로 취급, 넘침 허용
    if (wordBreak === "keep-all") {
      return computeKeepAllWidth(ck, paraStyle, fontMgr, text, maxWidth, false);
    }

    // normal + normal: CSS 줄바꿈 시뮬레이션 (computeEffectiveMaxWidth에서는 width만 반환)
    const result = cssNormalBreakProcess(
      ck,
      paraStyle,
      fontMgr,
      text,
      maxWidth,
    );
    return result.effectiveWidth;
  }
}
