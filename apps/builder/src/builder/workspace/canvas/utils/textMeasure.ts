/**
 * Text Measurement Utility
 *
 * Canvas 2D API로 텍스트 word-wrap 높이를 측정한다.
 * Canvas node renderer와 layout engine에서 콘텐츠 기반 높이 계산에 사용.
 *
 * Phase 0: TextMeasurer 추상 인터페이스 도입
 * - Canvas2DTextMeasurer: 기존 Canvas 2D API 기반 (기본값)
 * - 향후 CanvasKit Paragraph API 기반 구현으로 교체 가능
 *
 * @since 2026-02-05
 * @updated 2026-02-17 Phase 0: TextMeasurer 인터페이스 추가
 */

// ============================================
// TextMeasurer Interface
// ============================================

/** 텍스트 측정 결과 */
export interface TextMeasureResult {
  /** 텍스트 렌더링 너비 (px) */
  width: number;
  /** 텍스트 렌더링 높이 (px) */
  height: number;
}

/** 텍스트 스타일 옵션 */
export interface TextMeasureStyle {
  fontSize: number;
  fontFamily: string;
  fontWeight?: number | string;
  lineHeight?: number;
  // 렌더러 ParagraphStyle 정합성을 위한 확장 속성
  letterSpacing?: number;
  wordSpacing?: number;
  fontStyle?: number | string; // 0|'normal'=upright, 1|'italic', 2|'oblique'
  fontStretch?: string; // 'normal', 'condensed', 'expanded' 등
  fontVariant?: string; // 'normal', 'small-caps' 등
  // CSS 텍스트 래핑 에뮬레이션 (ADR-008)
  wordBreak?: "normal" | "break-all" | "keep-all";
  overflowWrap?: "normal" | "break-word" | "anywhere";
  // ADR-051: needsFallback() 판별용 (nowrap/pre/pre-wrap → CanvasKit fallback)
  whiteSpace?: string;
}

/**
 * 텍스트 측정 추상 인터페이스
 *
 * Canvas 2D, CanvasKit Paragraph, 또는 다른 엔진으로 교체 가능.
 * 모든 텍스트 측정 호출은 이 인터페이스를 통해야 합니다.
 */
export interface TextMeasurer {
  /** 한 줄 텍스트 너비 측정 */
  measureWidth(text: string, style: TextMeasureStyle): number;

  /** 줄바꿈 포함 텍스트 크기 측정 */
  measureWrapped(
    text: string,
    style: TextMeasureStyle,
    maxWidth: number,
  ): TextMeasureResult;
}

import { buildFontString } from "./canvas2dSegmentCache";
import { setSpecWrappedTextHeightMeasurer } from "@composition/specs";

// ============================================
// Canvas 2D Implementation
// ============================================

/** 오프스크린 Canvas 2D context (싱글턴) */
let _measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (!_measureCtx) {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    _measureCtx = canvas.getContext("2d");
  }
  return _measureCtx;
}

/**
 * Canvas 2D API 기반 텍스트 측정기
 *
 * 기존 measureTextWidth(), measureWrappedTextHeight()를
 * TextMeasurer 인터페이스로 래핑.
 */
export class Canvas2DTextMeasurer implements TextMeasurer {
  measureWidth(text: string, style: TextMeasureStyle): number {
    if (!text) return 0;
    const ctx = getMeasureCtx();
    if (!ctx) {
      return text.length * (style.fontSize * 0.5);
    }
    ctx.font = buildFontString(style);
    let width = ctx.measureText(text).width;
    // letterSpacing: 각 문자 사이 간격 수동 가산
    if (style.letterSpacing && style.letterSpacing !== 0) {
      width += style.letterSpacing * Math.max(0, text.length - 1);
    }
    // wordSpacing: 공백 문자 수만큼 추가 간격 가산
    if (style.wordSpacing && style.wordSpacing !== 0) {
      const spaceCount = (text.match(/ /g) ?? []).length;
      width += style.wordSpacing * spaceCount;
    }
    return width;
  }

  measureWrapped(
    text: string,
    style: TextMeasureStyle,
    maxWidth: number,
  ): TextMeasureResult {
    // measureWrappedTextHeight()를 경유하지 않고 직접 Canvas 2D word-wrap 로직 인라인
    // (measureWrappedTextHeight → getTextMeasurer().measureWrapped 경유 시 무한 재귀 발생)
    const fm = measureFontMetrics(
      style.fontFamily,
      style.fontSize,
      style.fontWeight ?? 400,
    );
    const lineHeight = style.lineHeight ?? fm.lineHeight;
    if (!text || maxWidth <= 0) {
      return { width: 0, height: lineHeight };
    }

    const ctx = getMeasureCtx();
    if (!ctx) {
      return { width: maxWidth, height: lineHeight };
    }

    const fontStyleStr =
      style.fontStyle === 1 || style.fontStyle === "italic"
        ? "italic "
        : style.fontStyle === 2 || style.fontStyle === "oblique"
          ? "oblique "
          : "";
    ctx.font = `${fontStyleStr}${style.fontWeight ?? 400} ${style.fontSize}px ${style.fontFamily}`;

    // ADR-008: word-break × overflow-wrap 에뮬레이션
    const wb = style.wordBreak || "normal";
    const ow = style.overflowWrap || "normal";

    // break-all: 모든 문자가 줄바꿈 지점 → 문자 단위 측정
    if (wb === "break-all") {
      return this._measureBreakAll(ctx, text, maxWidth, lineHeight, style);
    }

    const words = text.split(/(\s+)/); // 공백 포함 분리
    let lineCount = 1;
    let currentLineWidth = 0;
    const allowBreakWord = ow === "break-word" || ow === "anywhere";

    for (const word of words) {
      const isSpace = /^\s+$/.test(word);
      let wordWidth = this._measureWord(ctx, word, style);
      // 공백 토큰: wordSpacing 가산
      if (style.wordSpacing && style.wordSpacing !== 0 && isSpace) {
        const spaceCount = (word.match(/ /g) ?? []).length;
        wordWidth += style.wordSpacing * spaceCount;
      }
      // CSS trailing space hang: 공백이 줄 끝을 넘으면 줄바꿈하지 않고 hang 처리
      // (줄바꿈은 공백 뒤의 다음 단어에서 판단)
      if (isSpace) {
        currentLineWidth += wordWidth;
        continue;
      }
      if (currentLineWidth + wordWidth > maxWidth && currentLineWidth > 0) {
        // ADR-008: overflow-wrap: break-word — 단어가 maxWidth보다 크면 문자 단위 분할
        if (allowBreakWord && wordWidth > maxWidth) {
          // 먼저 새 줄로 이동 후 문자 단위 분할 (CSS break-word 동작)
          lineCount++;
          currentLineWidth = 0;
          const chars = Array.from(word);
          for (const ch of chars) {
            const chWidth = this._measureWord(ctx, ch, style);
            if (currentLineWidth + chWidth > maxWidth && currentLineWidth > 0) {
              lineCount++;
              currentLineWidth = chWidth;
            } else {
              currentLineWidth += chWidth;
            }
          }
        } else {
          lineCount++;
          currentLineWidth = wordWidth;
        }
      } else {
        currentLineWidth += wordWidth;
      }
    }

    return { width: maxWidth, height: lineCount * lineHeight };
  }

  /** 단어 폭 측정 (letterSpacing 포함) */
  private _measureWord(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    word: string,
    style: TextMeasureStyle,
  ): number {
    let w = ctx.measureText(word).width;
    if (style.letterSpacing && style.letterSpacing !== 0) {
      w += style.letterSpacing * Math.max(0, word.length - 1);
    }
    return w;
  }

  /** break-all: 문자 단위 줄바꿈 측정 */
  private _measureBreakAll(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    lineHeight: number,
    style: TextMeasureStyle,
  ): TextMeasureResult {
    const chars = Array.from(text);
    let lineCount = 1;
    let currentLineWidth = 0;
    for (const ch of chars) {
      const chWidth = this._measureWord(ctx, ch, style);
      if (currentLineWidth + chWidth > maxWidth && currentLineWidth > 0) {
        lineCount++;
        currentLineWidth = chWidth;
      } else {
        currentLineWidth += chWidth;
      }
    }
    return { width: maxWidth, height: lineCount * lineHeight };
  }
}

// ============================================
// Font Metrics (baseline 정밀 계산)
// ============================================

/**
 * 폰트 메트릭 측정 결과
 *
 * Canvas 2D TextMetrics API 기반으로 측정된 폰트의 수직 메트릭.
 * layout engine의 baseline 계산에 사용됩니다.
 */
export interface FontMetrics {
  /** baseline에서 텍스트 상단까지의 거리 (양수, px) — actualBoundingBox 기반 */
  ascent: number;
  /** baseline에서 텍스트 하단까지의 거리 (양수, px) — actualBoundingBox 기반 */
  descent: number;
  /** ascent + descent — 글리프 경계박스 높이 (em-box 높이와 다름) */
  fontHeight: number;
  /** CSS line-height: normal에 대응하는 폰트 내장 line-height (fontBoundingBox 기반) */
  lineHeight: number;
}

export interface ActualTextBounds {
  ascent: number;
  descent: number;
  height: number;
}

/**
 * 폰트 메트릭 캐시
 *
 * 키 형식: `${fontFamily}:${fontSize}:${fontWeight}`
 * 동일 폰트/사이즈/weight 조합은 메트릭이 불변이므로 재측정 불필요.
 *
 * 메모리 상한: MAX_CACHE_SIZE 초과 시 전체 clear.
 * 일반적인 빌더 세션에서 폰트 조합은 수십 종 이내이므로 충분.
 */
const _fontMetricsCache = new Map<string, FontMetrics>();
const MAX_FONT_METRICS_CACHE_SIZE = 256;

/**
 * 폰트 로딩 완료 여부
 *
 * document.fonts.ready 이전에 측정된 메트릭은 시스템 폴백 폰트 기준이므로
 * 캐시하면 안 됨. 폰트 로드 완료 후 캐시를 클리어하고 이후 측정부터 캐싱.
 */
let _fontsReady = false;
if (typeof document !== "undefined" && document.fonts) {
  document.fonts.ready.then(() => {
    _fontsReady = true;
    _fontMetricsCache.clear();
    // 폰트 로드 완료 후 레이아웃 재계산 트리거
    window.dispatchEvent(new CustomEvent("composition:fonts-ready"));
  });
  document.fonts.addEventListener("loadingdone", () => {
    _fontsReady = true;
    _fontMetricsCache.clear();
    window.dispatchEvent(new CustomEvent("composition:fonts-ready"));
  });
}

/**
 * 텍스트 측정에 사용하는 표본 문자열
 *
 * 대소문자 + descender 문자(g, j, p, q, y)를 포함하여
 * actualBoundingBoxAscent/Descent가 정확한 범위를 반환하도록 합니다.
 */
const METRIC_SAMPLE_TEXT =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzgjpqy";

/**
 * Canvas 2D TextMetrics 기반 폰트 메트릭 측정
 *
 * Canvas 2D `measureText()`의 `actualBoundingBoxAscent`와
 * `actualBoundingBoxDescent`를 사용하여 실제 폰트 렌더링 기반
 * ascent/descent를 측정합니다.
 *
 * 캐싱: 동일 fontFamily/fontSize/fontWeight 조합은 Map에서 O(1) 조회.
 * SSR-safe: Canvas 2D 사용 불가 환경에서는 fontSize 기반 근사값 반환.
 *
 * @param fontFamily - 폰트 패밀리 (예: 'Pretendard', 'sans-serif')
 * @param fontSize - 폰트 크기 (px)
 * @param fontWeight - 폰트 두께 (예: 400, 700, 'bold')
 * @returns 폰트 메트릭 (항상 반환, Canvas 미지원 시 근사값)
 */
export function measureFontMetrics(
  fontFamily: string,
  fontSize: number,
  fontWeight: string | number = 400,
): FontMetrics {
  // 캐시 키 생성
  const cacheKey = `${fontFamily}:${fontSize}:${fontWeight}`;

  const cached = _fontMetricsCache.get(cacheKey);
  if (cached) return cached;

  // Canvas 2D context 재활용 (기존 싱글톤)
  const ctx = getMeasureCtx();
  if (ctx) {
    try {
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      const metrics = ctx.measureText(METRIC_SAMPLE_TEXT);

      // actualBoundingBoxAscent/Descent는 최신 브라우저에서 지원
      if (
        typeof metrics.actualBoundingBoxAscent === "number" &&
        typeof metrics.actualBoundingBoxDescent === "number"
      ) {
        // fontBoundingBox: 폰트 전체의 ascent/descent (CSS line-height: normal에 대응)
        // actualBoundingBox: 현재 텍스트 글리프의 실제 경계 (baseline, 렌더링 용도)
        const fontBBoxH =
          typeof metrics.fontBoundingBoxAscent === "number" &&
          typeof metrics.fontBoundingBoxDescent === "number"
            ? metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent
            : metrics.actualBoundingBoxAscent +
              metrics.actualBoundingBoxDescent;

        const result: FontMetrics = {
          ascent: metrics.actualBoundingBoxAscent,
          descent: metrics.actualBoundingBoxDescent,
          fontHeight:
            metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
          lineHeight: fontBBoxH,
        };

        // 폰트 로딩 완료 후에만 캐시 (미로딩 시 폴백 폰트 메트릭이 캐시되는 것 방지)
        if (_fontsReady) {
          if (_fontMetricsCache.size >= MAX_FONT_METRICS_CACHE_SIZE) {
            _fontMetricsCache.clear();
          }
          _fontMetricsCache.set(cacheKey, result);
        }

        return result;
      }
    } catch {
      // Canvas 측정 실패 시 근사값 폴백
    }
  }

  // SSR / Canvas 미지원 환경: fontSize 기반 근사값
  // 일반적인 라틴 폰트: ascent ≈ 0.8 * fontSize, descent ≈ 0.2 * fontSize
  const fallback: FontMetrics = {
    ascent: fontSize * 0.8,
    descent: fontSize * 0.2,
    fontHeight: fontSize,
    lineHeight: fontSize * 1.2,
  };

  // 폰트 로딩 완료 후에만 캐시
  if (_fontsReady) {
    if (_fontMetricsCache.size >= MAX_FONT_METRICS_CACHE_SIZE) {
      _fontMetricsCache.clear();
    }
    _fontMetricsCache.set(cacheKey, fallback);
  }

  return fallback;
}

/**
 * 실제 텍스트 콘텐츠의 bounding box를 측정한다.
 *
 * `measureFontMetrics()`는 라틴 샘플 문자열 기준이라 한글/숫자/아이콘 조합에서
 * 실제 시각적 중심과 다를 수 있다. 버튼 텍스트 수직 정렬 보정용.
 */
export function measureActualTextBounds(
  text: string,
  fontFamily: string,
  fontSize: number,
  fontWeight: string | number = 400,
): ActualTextBounds {
  const ctx = getMeasureCtx();
  if (ctx && text) {
    try {
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      const metrics = ctx.measureText(text);
      if (
        typeof metrics.actualBoundingBoxAscent === "number" &&
        typeof metrics.actualBoundingBoxDescent === "number"
      ) {
        const ascent = metrics.actualBoundingBoxAscent;
        const descent = metrics.actualBoundingBoxDescent;
        return {
          ascent,
          descent,
          height: ascent + descent,
        };
      }
    } catch {
      // fallback below
    }
  }

  const fallback = measureFontMetrics(fontFamily, fontSize, fontWeight);
  return {
    ascent: fallback.ascent,
    descent: fallback.descent,
    height: fallback.fontHeight,
  };
}

/**
 * 폰트 메트릭 캐시 초기화 (테스트용)
 */
export function resetFontMetricsCache(): void {
  _fontMetricsCache.clear();
}

// ============================================
// Singleton / Registry
// ============================================

/** 현재 활성 텍스트 측정기 */
let _activeMeasurer: TextMeasurer = new Canvas2DTextMeasurer();

/**
 * 활성 텍스트 측정기 가져오기
 *
 * CanvasKit 초기화 전: Canvas2DTextMeasurer (기본값)
 * CanvasKit 초기화 후: setTextMeasurer()로 CanvasKitTextMeasurer 교체
 */
export function getTextMeasurer(): TextMeasurer {
  return _activeMeasurer;
}

/**
 * 현재 활성 측정기가 CanvasKit 기반인지 확인
 *
 * Canvas 2D 측정 + CanvasKit 렌더링 간 오차는 nodeRendererText.ts의
 * effectiveLayoutWidth +1 마진으로 처리 (layout 보정 불필요).
 */
export function isCanvasKitMeasurer(): boolean {
  return !(_activeMeasurer instanceof Canvas2DTextMeasurer);
}

/**
 * 활성 텍스트 측정기 교체
 *
 * CanvasKit 초기화 후 호출하여 Paragraph API 기반 측정기로 교체.
 *
 * @example
 * // CanvasKit 초기화 후
 * setTextMeasurer(new CanvasKitTextMeasurer(canvasKit));
 */
export function setTextMeasurer(measurer: TextMeasurer): void {
  _activeMeasurer = measurer;
}

/**
 * 텍스트의 word-wrap 높이를 측정한다.
 *
 * TextMeasurer 경유 래퍼 — CanvasKit 초기화 후에는 Paragraph API 기반으로 동작.
 * 기존 export 시그니처 유지 (하위 호환).
 *
 * @param text - 측정할 텍스트
 * @param fontSize - 폰트 크기 (px)
 * @param fontWeight - 폰트 굵기 (e.g., 400, 600, '600')
 * @param fontFamily - 폰트 패밀리 (e.g., 'Pretendard')
 * @param maxWidth - 줄바꿈 기준 최대 너비 (px)
 * @returns 줄바꿈 포함 총 높이 (px)
 */
export function measureWrappedTextHeight(
  text: string,
  fontSize: number,
  fontWeight: number | string,
  fontFamily: string,
  maxWidth: number,
  lineHeight?: number,
  wordBreak?: "normal" | "break-all" | "keep-all",
  overflowWrap?: "normal" | "break-word" | "anywhere",
): number {
  const result = getTextMeasurer().measureWrapped(
    text,
    {
      fontSize,
      fontFamily,
      fontWeight,
      lineHeight,
      wordBreak,
      overflowWrap,
    },
    maxWidth,
  );
  return result.height;
}

// specs escape(listbox_item 등)의 wrap 블록 높이 측정기 주입 (2026-07-22) —
//   escape 가 stacked slot(label/description) offset 을 paint 와 동일 엔진으로 측정해야
//   멀티라인 wrap 시 겹침이 없다. measureWrappedTextHeight 는 활성 measurer 에 동적
//   위임하므로 모듈 로드 시 1회 주입으로 CanvasKit 초기화 이후에도 자동 최신.
setSpecWrappedTextHeightMeasurer(
  (text, fontSize, fontWeight, fontFamily, maxWidth, lineHeight) =>
    measureWrappedTextHeight(
      text,
      fontSize,
      fontWeight,
      fontFamily,
      maxWidth,
      lineHeight,
    ),
);
