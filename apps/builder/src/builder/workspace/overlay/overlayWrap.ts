/**
 * ADR-027 Phase D1 — 편집 오버레이의 줄바꿈 계약.
 *
 * 오버레이는 Skia 가 paragraph 에 넘긴 입력 (`SkiaNodeData.text` 의 whiteSpace ·
 * wordBreak · overflowWrap) 에서 white-space 를 파생한다. 폭은 오버레이 컨테이너
 * (= 요소 bounds) 에서 padding 을 뺀 값이라 Skia `maxWidth` (containerWidth − x·2) 와
 * 같은 상자다 — `nodeRendererText.ts` 가 nowrap / pre 를 100000 폭으로 layout 하는
 * 규칙을 그대로 따른다.
 */

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
  };
}
