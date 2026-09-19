/**
 * ADR-027 Phase D1 — 편집 오버레이의 줄바꿈 계약.
 *
 * 오버레이는 Skia 가 paragraph 에 넘긴 입력 (`SkiaNodeData.text` 의 whiteSpace ·
 * wordBreak · overflowWrap) 에서 white-space 를 파생한다. 폭은 오버레이 컨테이너
 * (= 요소 bounds) 에서 padding 을 뺀 값이라 Skia `maxWidth` (containerWidth − x·2) 와
 * 같은 상자다 — `nodeRendererText.ts` 가 nowrap / pre 를 100000 폭으로 layout 하는
 * 규칙을 그대로 따른다.
 */

import {
  DEFAULT_FONT_FEATURES,
  resolveFontVariantFeatures,
} from "../canvas/layout/engines/cssResolver";
import {
  collapsesSegmentBreaks,
  transformSegmentBreaks,
} from "../canvas/utils/textWhiteSpace";

export type SkiaWhiteSpace =
  "normal" | "nowrap" | "pre" | "pre-wrap" | "pre-line";
export type SkiaWordBreak = "normal" | "break-all" | "keep-all";
export type SkiaOverflowWrap = "normal" | "break-word" | "anywhere";

export interface SkiaWrapInput {
  whiteSpace?: SkiaWhiteSpace;
  wordBreak?: SkiaWordBreak;
  overflowWrap?: SkiaOverflowWrap;
}

export interface OverlayWrap {
  /** 편집기 root 의 white-space. Skia normal 은 편집 중 공백을 보존하려고 pre-wrap 으로. */
  whiteSpace: "nowrap" | "pre" | "pre-wrap";
  wordBreak: SkiaWordBreak;
  overflowWrap: SkiaOverflowWrap;
  /**
   * Enter 가 줄바꿈 문자를 넣는가. `\n` 을 Skia 는 항상 그리지만 CSS 는 pre 계열에서만
   * 그린다 — 두 consumer 가 같이 그리는 white-space 에서만 줄바꿈이고, 그 외 (normal ·
   * nowrap) 는 Enter = 완료를 유지한다 (D3 대칭).
   */
  enterInsertsNewline: boolean;
  /**
   * 편집기에 싣기 전 `\n` 을 공백으로 접는가 (normal · nowrap — CSS segment break transformation).
   * Skia · DOM 둘 다 접어 그리는데 Quill 은 `\n` 을 문단 경계로 그려 편집 진입 순간 8줄이 됐다.
   * 접힌 텍스트가 편집기의 초기값이라, 사용자가 고쳐 커밋하면 접힌 형태로 저장된다 (WYSIWYG) —
   * 고치지 않고 나가면 저장 0.
   */
  collapsesSegmentBreaks: boolean;
}

export function resolveOverlayWrap(input: SkiaWrapInput): OverlayWrap {
  const whiteSpace = input.whiteSpace ?? "normal";
  const editorWhiteSpace =
    whiteSpace === "nowrap" || whiteSpace === "pre" ? whiteSpace : "pre-wrap";
  return {
    whiteSpace: editorWhiteSpace,
    wordBreak: input.wordBreak ?? "normal",
    overflowWrap: input.overflowWrap ?? "normal",
    enterInsertsNewline:
      whiteSpace === "pre" ||
      whiteSpace === "pre-wrap" ||
      whiteSpace === "pre-line",
    collapsesSegmentBreaks: collapsesSegmentBreaks(whiteSpace),
  };
}

/** 편집기 초기값 — normal · nowrap 이면 segment break 만 공백으로 (공백 run 은 편집 중 보존). */
export function resolveOverlayInitialText(
  value: string,
  wrap: OverlayWrap | undefined,
): string {
  return wrap?.collapsesSegmentBreaks ? transformSegmentBreaks(value) : value;
}

/**
 * Skia decoration 비트마스크 (underline 1 · overline 2 · line-through 4) → CSS text-decoration-line.
 * 오버레이가 이걸 안 실으면 Link 의 밑줄이 편집 진입 순간 사라진다 (D3 하니스: 200% ink bbox r −4 · b −2).
 */
export function decorationMaskToCss(
  mask: number | undefined,
): string | undefined {
  if (!mask) return undefined;
  const parts: string[] = [];
  if (mask & 1) parts.push("underline");
  if (mask & 2) parts.push("overline");
  if (mask & 4) parts.push("line-through");
  return parts.length ? parts.join(" ") : undefined;
}

/**
 * ADR-027 D3 — Skia paragraph 가 싣는 OpenType feature (기본 Pretendard cv02·03·04·11 + fontVariant)
 * 를 CSS `font-feature-settings` 로. 빌더 문서는 `--default-font-feature-settings` 가 없어 오버레이가
 * `normal` 이면 Latin 글리프 폭이 갈린다 (Heading 205.94 ↔ 204.41 — 200% 에서 ink 우측 3px).
 * Preview body 도 같은 4개를 싣는다 (`preview/baseStyles.ts`).
 */
export function resolveOverlayFontFeatures(
  fontVariant: string | undefined,
): string {
  const tags = [
    ...DEFAULT_FONT_FEATURES,
    ...resolveFontVariantFeatures(fontVariant ?? "normal"),
  ];
  return tags.map((t) => `"${t.name}" ${t.value}`).join(", ");
}
