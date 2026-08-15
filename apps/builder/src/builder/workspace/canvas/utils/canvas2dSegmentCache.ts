/**
 * Canvas 2D Segment Cache — ADR-051
 *
 * Pretext 원리(Canvas 2D measureText + 세그먼트 캐시 + greedy line-breaking)를
 * composition 내부에 직접 구현. 외부 의존 0.
 *
 * 3-Tier 정밀도 전략:
 *   Tier 1 — lineFitEpsilon: 서브픽셀 줄 끝 허용 오차 (Pretext 검증)
 *   Tier 2 — Line-level Verification: full-line 측정으로 보정 (safety net)
 *   Tier 3 — Semantic Preprocessing: 구두점 병합 + CJK 금칙처리 (근본 해결)
 *
 * 파이프라인:
 *   tokenize → preprocessTokens (Tier 3) → getOrMeasureWidth (캐시)
 *   → computeLines (Tier 1) → verifyLines (Tier 2) → buildHintedText
 *
 * @since 2026-04-05
 * @see docs/adr/051-pretext-text-measurement-integration.md
 * @see docs/adr/design/051-canvas2d-text-measurement-breakdown.md
 */

import type { TextMeasureStyle } from "./textMeasure";

// USE_CANVAS2D_MEASURE 게이트는 wasm-bindings/featureFlags.ts (단일 registry) 로 이동.

// ============================================
// Tier 1: lineFitEpsilon
// ============================================

/**
 * 서브픽셀 줄 끝 허용 오차
 *
 * Canvas 2D measureText().width와 CSS DOM의 서브픽셀 반올림 차이로
 * 줄바꿈 경계에서 1px 미만 오차가 발생한다.
 * Pretext 검증: Chrome 0.005px, Safari 1/64px ≈ 0.015625px
 */
const LINE_FIT_EPSILON = 0.015;

// ============================================
// Tier 3: Semantic Preprocessing — CJK 금칙 테이블
// ============================================

/** 행두 금칙 — 줄 시작에 올 수 없는 문자 (CJK 구두점, 작은 가나) */
const KINSOKU_HEAD = new Set([
  // CJK 구두점
  "\u3001", // 、
  "\u3002", // 。
  "\uFF0C", // ，
  "\uFF0E", // ．
  "\uFF1A", // ：
  "\uFF1B", // ；
  "\uFF01", // ！
  "\uFF1F", // ？
  // 닫는 괄호/따옴표
  "\u300D", // 」
  "\u300F", // 』
  "\uFF09", // ）
  "\u3011", // 】
  "\u3009", // 〉
  "\u300B", // 》
  "\u3015", // 〕
  "\uFF5D", // ｝
  "\u3019", // 〙
  "\u301B", // 〛
  // 말줄임/장음
  "\u2026", // …
  "\u2025", // ‥
  "\u30FC", // ー
  "\u301C", // 〜
  // 작은 가나 (일본어)
  "\u3063", // っ
  "\u30C3", // ッ
  "\u3083", // ゃ
  "\u30E3", // ャ
  "\u3085", // ゅ
  "\u30E5", // ュ
  "\u3087", // ょ
  "\u30E7", // ョ
]);

/** 행말 금칙 — 줄 끝에 올 수 없는 문자 (여는 괄호/따옴표) */
const KINSOKU_TAIL = new Set([
  "\u300C", // 「
  "\u300E", // 『
  "\uFF08", // （
  "\u3010", // 【
  "\u3008", // 〈
  "\u300A", // 《
  "\u3014", // 〔
  "\uFF5B", // ｛
  "\u3018", // 〘
  "\u301A", // 〚
]);

/** 라틴 trailing 구두점 — 선행 단어에 병합 */
const LATIN_TRAILING_PUNCT = /^[.,;:!?)\]'"}\u2019\u201D]$/;

// ============================================
// Tokenizer (Intl.Segmenter 기반)
// ============================================

export interface Token {
  text: string;
  /** true = word-like (줄바꿈 가능), false = space/punctuation */
  breakable: boolean;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });

/**
 * CJK Unified Ideographs, Hiragana, Katakana, Hangul, Fullwidth 판별
 */
function isCJKCodePoint(cp: number): boolean {
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified
    (cp >= 0x3040 && cp <= 0x309f) || // Hiragana
    (cp >= 0x30a0 && cp <= 0x30ff) || // Katakana
    (cp >= 0xac00 && cp <= 0xd7af) || // Hangul Syllables
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Extension A
    (cp >= 0x20000 && cp <= 0x2a6df) || // CJK Extension B
    (cp >= 0xff00 && cp <= 0xffef) // Fullwidth Forms
  );
}

/**
 * Intl.Segmenter 기반 토큰화
 *
 * - word-break: normal → CJK 문자 사이 줄바꿈 허용 (각 문자 개별 토큰)
 * - word-break: keep-all → CJK도 단어 단위 유지 (분할하지 않음)
 */
export function tokenize(text: string, wordBreak: string = "normal"): Token[] {
  const segments = [...segmenter.segment(text)];
  const tokens: Token[] = [];
  for (const seg of segments) {
    if (!seg.isWordLike) {
      tokens.push({ text: seg.segment, breakable: false });
    } else if (
      isCJKCodePoint(seg.segment.codePointAt(0) ?? 0) &&
      wordBreak !== "keep-all"
    ) {
      // CJK word-break:normal — 각 문자 사이 줄바꿈 허용
      for (const char of seg.segment) {
        tokens.push({ text: char, breakable: true });
      }
    } else {
      tokens.push({ text: seg.segment, breakable: true });
    }
  }
  return tokens;
}

// ============================================
// Tier 3: Semantic Preprocessing
// ============================================

/**
 * 토큰 병합 전처리 — CSS 렌더링과 동일한 측정 단위 생성
 *
 * 1. 행두 금칙 문자 → 선행 토큰에 병합 (줄 시작 방지)
 * 2. 행말 금칙 문자 → 후속 토큰에 병합 (줄 끝 방지)
 * 3. 라틴 trailing 구두점 → 선행 word에 병합 ("word," 단위 측정)
 *
 * Pretext 원리: "local semantic preprocessing > clever runtime correction"
 */
export function preprocessTokens(tokens: Token[]): Token[] {
  const result: Token[] = [];
  const toks = tokens.map((t) => ({ ...t }));

  for (let i = 0; i < toks.length; i++) {
    const token = toks[i];

    // 행두 금칙: non-breakable 단일 문자 → 선행 토큰에 병합
    if (
      !token.breakable &&
      token.text.length === 1 &&
      KINSOKU_HEAD.has(token.text) &&
      result.length > 0
    ) {
      const prev = result[result.length - 1];
      result[result.length - 1] = {
        text: prev.text + token.text,
        breakable: prev.breakable,
      };
      continue;
    }

    // 행말 금칙: breakable 단일 문자 → 후속 토큰에 병합
    if (
      token.breakable &&
      token.text.length === 1 &&
      KINSOKU_TAIL.has(token.text) &&
      i + 1 < toks.length
    ) {
      toks[i + 1] = {
        text: token.text + toks[i + 1].text,
        breakable: toks[i + 1].breakable,
      };
      continue;
    }

    // 라틴 trailing 구두점: "." "," ";" 등 → 선행 breakable 토큰에 병합
    if (
      !token.breakable &&
      token.text.length === 1 &&
      LATIN_TRAILING_PUNCT.test(token.text) &&
      result.length > 0 &&
      result[result.length - 1].breakable
    ) {
      const prev = result[result.length - 1];
      result[result.length - 1] = {
        text: prev.text + token.text,
        breakable: prev.breakable,
      };
      continue;
    }

    result.push(token);
  }

  return result;
}

// ============================================
// Segment Width Cache (SoA 패턴)
// ============================================

/** Map<fontKey, Map<tokenText, width>> */
const segmentCaches = new Map<string, Map<string, number>>();
const pendingFontLoads = new Map<string, Promise<void>>();

let sharedCtx:
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D
  | null = null;

let fontsReady = false;

function notifyFontsReady(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("composition:fonts-ready"));
}

function queueFontLoad(fontString: string, sampleText: string): void {
  if (typeof document === "undefined" || !document.fonts) return;
  if (pendingFontLoads.has(fontString)) return;

  const loadPromise = document.fonts
    .load(fontString, sampleText)
    .then(() => {
      fontsReady = true;
      segmentCaches.clear();
      notifyFontsReady();
    })
    .catch(() => {
      // 브라우저가 로드를 거부하거나 폰트가 없으면 다음 측정에서 다시 시도한다.
    })
    .finally(() => {
      pendingFontLoads.delete(fontString);
    });

  pendingFontLoads.set(fontString, loadPromise);
}

// 폰트 로딩 상태 추적
if (typeof document !== "undefined" && document.fonts) {
  document.fonts.ready.then(() => {
    fontsReady = true;
    segmentCaches.clear();
    notifyFontsReady();
  });
  document.fonts.addEventListener("loadingdone", () => {
    // 새 폰트 로드 시 기존 캐시 무효화 (fallback 폰트 결과 제거)
    segmentCaches.clear();
    fontsReady = true;
    notifyFontsReady();
  });
}

function getCtx():
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D {
  if (!sharedCtx) {
    if (typeof OffscreenCanvas !== "undefined") {
      sharedCtx = new OffscreenCanvas(1, 1).getContext("2d")!;
    } else if (typeof document !== "undefined") {
      sharedCtx = document.createElement("canvas").getContext("2d")!;
    } else {
      throw new Error("Canvas 2D not available");
    }
  }
  return sharedCtx;
}

/**
 * 세그먼트 폭 측정 + 캐시
 *
 * 폰트 미로드 시 캐싱 스킵 (fallback 폰트 결과 캐시 방지).
 */
export function getOrMeasureWidth(
  token: string,
  fontKey: string,
  fontString: string,
): number {
  const ctx = getCtx();
  const isFontLoaded =
    typeof document !== "undefined" && document.fonts
      ? document.fonts.check(fontString, token)
      : fontsReady;

  // 폰트 미로드 → 캐싱 없이 직접 측정하고 비동기 로드 트리거
  if (!isFontLoaded) {
    queueFontLoad(fontString, token);
    ctx.font = fontString;
    return ctx.measureText(token).width;
  }

  let cache = segmentCaches.get(fontKey);
  if (!cache) {
    cache = new Map();
    segmentCaches.set(fontKey, cache);
  }

  const cached = cache.get(token);
  if (cached !== undefined) return cached;

  ctx.font = fontString;
  const width = ctx.measureText(token).width;
  cache.set(token, width);
  return width;
}

/** 전체 캐시 클리어 */
export function clearSegmentCaches(): void {
  segmentCaches.clear();
}

// ============================================
// Font Key/String 생성
// ============================================

/**
 * 캐시 키 생성 — 텍스트 제외, 스타일만으로 구성
 */
export function buildFontKey(style: TextMeasureStyle): string {
  return [
    style.fontSize,
    style.fontFamily,
    style.fontWeight ?? 400,
    style.fontStyle ?? 0,
    style.fontVariant ?? "",
    style.fontStretch ?? "",
  ].join("\0");
}

/**
 * Canvas 2D ctx.font 문자열 생성
 *
 * CSS font shorthand: [font-style] [font-weight] font-size font-family
 */
export function buildFontString(style: TextMeasureStyle): string {
  const fs =
    style.fontStyle === 1 || style.fontStyle === "italic"
      ? "italic "
      : style.fontStyle === 2 || style.fontStyle === "oblique"
        ? "oblique "
        : "";
  return `${fs}${style.fontWeight ?? 400} ${style.fontSize}px ${style.fontFamily}`;
}

// ============================================
// needsFallback — CanvasKit fallback 경계
// ============================================

/**
 * Canvas 2D 측정이 부적합한 스타일 판별
 *
 * true → 기존 CanvasKit Paragraph 경로 유지
 * false → Canvas 2D 세그먼트 캐시 경로 사용
 *
 * Canvas 2D measureText()는 letterSpacing, wordSpacing을 반영하지 않으며,
 * white-space: nowrap/pre-wrap 등의 특수 줄바꿈 규칙도 처리하지 않는다.
 */
export function needsFallback(style: TextMeasureStyle): boolean {
  // letterSpacing/wordSpacing: Canvas 2D measureText에 미반영
  if (style.letterSpacing && style.letterSpacing !== 0) return true;
  if (style.wordSpacing && style.wordSpacing !== 0) return true;
  // white-space: nowrap, pre, pre-wrap 등은 특수 줄바꿈 규칙
  if (style.whiteSpace && style.whiteSpace !== "normal") return true;
  // break-all: 문자 단위 분할 — CanvasKit ZWS 삽입 방식이 더 정확
  if (style.wordBreak === "break-all") return true;
  // fontVariant(small-caps 등): buildFontString 미포함 — CanvasKit 렌더는 적용하므로 측정도 CanvasKit 로
  if (style.fontVariant && style.fontVariant !== "normal") return true;
  return false;
}

// ============================================
// Greedy Line-Breaking (Pending Space 패턴)
// ============================================

export interface ComputedLines {
  lineCount: number;
  lines: string[][];
  maxLineWidth: number;
}

/**
 * Greedy line-breaking with Pending Space pattern
 *
 * CSS trailing whitespace는 hangable — 줄 끝 공백은 overflow에 포함하지 않는다.
 * 공백 폭을 pendingSpace에 보류하고, 다음 단어 추가 시에만 확정한다.
 *
 * Tier 1: lineFitEpsilon 적용 — maxWidth + ε 으로 서브픽셀 경계 흡수.
 */
export function computeLines(
  tokens: Token[],
  widths: number[],
  maxWidth: number,
  overflowWrap: string,
  fontKey: string,
  fontString: string,
): ComputedLines {
  const lines: string[][] = [[]];
  let lineW = 0;
  let maxLineW = 0;
  let pendingSpace = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const w = widths[i];

    if (!token.breakable) {
      // 공백/구두점 → 보류 (lineW에 즉시 더하지 않음)
      pendingSpace = w;
      lines[lines.length - 1].push(token.text);
      continue;
    }

    if (lineW > 0 && lineW + pendingSpace + w > maxWidth + LINE_FIT_EPSILON) {
      // overflow-wrap: break-word — maxWidth 초과 단어 grapheme 분할
      if (overflowWrap === "break-word" && w > maxWidth) {
        maxLineW = Math.max(maxLineW, lineW);
        lines.push([]);
        lineW = 0;
        pendingSpace = 0;
        const graphemes = Array.from(token.text);
        for (const g of graphemes) {
          const gw = getOrMeasureWidth(g, fontKey, fontString);
          if (lineW > 0 && lineW + gw > maxWidth + LINE_FIT_EPSILON) {
            maxLineW = Math.max(maxLineW, lineW);
            lines.push([]);
            lineW = 0;
          }
          lines[lines.length - 1].push(g);
          lineW += gw;
        }
        continue;
      }

      // 새 줄 → 보류된 공백 폐기 (CSS: trailing space hang)
      maxLineW = Math.max(maxLineW, lineW);
      lines.push([]);
      lineW = w;
      pendingSpace = 0;
    } else {
      // 같은 줄 → 보류된 공백 확정
      lineW += pendingSpace + w;
      pendingSpace = 0;
    }

    lines[lines.length - 1].push(token.text);
  }

  maxLineW = Math.max(maxLineW, lineW);
  return { lineCount: lines.length, lines, maxLineWidth: maxLineW };
}

// ============================================
// Tier 2: Line-level Verification (Safety Net)
// ============================================

/**
 * computeLines 결과를 full-line 측정으로 검증하고 보정한다.
 *
 * Pass 1(greedy)의 토큰별 폭 합산은 서브픽셀 누적 오차로
 * 줄바꿈 경계에서 CSS와 다른 결과를 낼 수 있다.
 *
 * Pass 2: 각 줄의 full text를 ctx.measureText()로 재측정하여:
 *   - overflow → 마지막 토큰을 다음 줄로 이동
 *   - 여유 → 다음 줄 첫 토큰 당겨오기 (pull)
 *
 * Tier 3(Semantic Preprocessing)가 성숙하면 이 단계 제거 가능.
 * Pretext는 preprocessing 성숙 후 이 전략을 명시적으로 기각했다.
 *
 * 비용: 줄 수만큼 추가 measureText 호출 (~0.035ms / 20줄)
 */
export function verifyLines(
  lines: string[][],
  maxWidth: number,
  fontString: string,
): string[][] {
  if (lines.length <= 1) return lines;

  const ctx = getCtx();
  ctx.font = fontString;
  const verified: string[][] = [];
  let carry: string[] = [];

  // 가변 배열 — 당겨오기 시 다음 줄 수정
  const mutableLines = lines.map((l) => l.slice());

  for (let i = 0; i < mutableLines.length; i++) {
    const lineTokens = [...carry, ...mutableLines[i]];
    carry = [];

    if (lineTokens.length === 0) continue;

    const lineText = lineTokens.join("");
    const actualW = ctx.measureText(lineText).width;

    if (actualW <= maxWidth + LINE_FIT_EPSILON || lineTokens.length <= 1) {
      // 줄이 fit하면, 다음 줄 첫 토큰도 들어가는지 시도 (pull)
      if (i + 1 < mutableLines.length && mutableLines[i + 1].length > 0) {
        const nextFirst = mutableLines[i + 1][0];
        const tryText = lineText + nextFirst;
        if (ctx.measureText(tryText).width <= maxWidth + LINE_FIT_EPSILON) {
          lineTokens.push(nextFirst);
          mutableLines[i + 1] = mutableLines[i + 1].slice(1);
        }
      }
      verified.push(lineTokens);
    } else {
      // Overflow → 마지막 토큰을 다음 줄로 이동
      let fit = lineTokens.length;
      while (fit > 1) {
        fit--;
        const testText = lineTokens.slice(0, fit).join("");
        if (ctx.measureText(testText).width <= maxWidth + LINE_FIT_EPSILON) {
          break;
        }
      }
      // CSS trailing space hang: carry에 공백만 남으면 이전 줄에 붙임
      const kept = lineTokens.slice(0, fit);
      const rest = lineTokens.slice(fit);
      // 공백 토큰들을 kept 줄 끝에 유지 (줄바꿈에 기여하지 않음)
      while (rest.length > 0 && /^\s+$/.test(rest[0])) {
        kept.push(rest.shift()!);
      }
      verified.push(kept);
      carry = rest;
    }
  }

  if (carry.length > 0) {
    verified.push(carry);
  }

  return verified;
}

// ============================================
// Break Hint Builder
// ============================================

/**
 * 줄 배열을 \n 삽입된 텍스트로 변환
 *
 * Canvas 2D가 결정한 줄바꿈을 CanvasKit에 강제하는 메커니즘.
 * CanvasKit은 \n을 hard break로 처리하므로 측정-렌더링 일치 보장.
 */
export function buildHintedText(lines: string[][]): string {
  return lines.map((line) => line.join("")).join("\n");
}

// ============================================
// 통합 파이프라인
// ============================================

export interface Canvas2DMeasureResult {
  width: number;
  height: number;
  lineCount: number;
  hintedText: string;
}

/**
 * Canvas 2D 3-Tier 텍스트 측정 통합 파이프라인
 *
 * tokenize → preprocessTokens (Tier 3) → getOrMeasureWidth (캐시)
 * → computeLines (Tier 1) → verifyLines (Tier 2) → result
 */
export function measureWithCanvas2D(
  text: string,
  style: TextMeasureStyle,
  maxWidth: number,
): Canvas2DMeasureResult {
  const lineHeight = style.lineHeight ?? style.fontSize * 1.2;

  if (!text || maxWidth <= 0) {
    return { width: 0, height: lineHeight, lineCount: 1, hintedText: text };
  }

  // Tier 3: Semantic Preprocessing
  const rawTokens = tokenize(text, style.wordBreak ?? "normal");
  const tokens = preprocessTokens(rawTokens);

  // Segment width cache
  const fontKey = buildFontKey(style);
  const fontString = buildFontString(style);
  const widths = tokens.map((t) =>
    getOrMeasureWidth(t.text, fontKey, fontString),
  );

  // Tier 1: Greedy line-breaking with lineFitEpsilon
  const { lines, maxLineWidth } = computeLines(
    tokens,
    widths,
    maxWidth,
    style.overflowWrap ?? "normal",
    fontKey,
    fontString,
  );

  // Tier 2: Line-level Verification (safety net)
  const verified = verifyLines(lines, maxWidth, fontString);

  const hintedText = buildHintedText(verified);
  const effectiveLineHeight = Math.max(lineHeight, style.fontSize * 1.2);

  return {
    width: maxLineWidth,
    height: verified.length * effectiveLineHeight,
    lineCount: verified.length,
    hintedText,
  };
}

// ============================================
// HMR Cleanup
// ============================================

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    segmentCaches.clear();
  });
}
