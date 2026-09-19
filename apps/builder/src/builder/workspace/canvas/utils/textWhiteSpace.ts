/**
 * CSS `white-space` 의 공백 처리 (CSS Text 3 §4.1.1 White Space Processing) 를 Skia paragraph 입력
 * · 레이아웃 측정 · 편집 오버레이가 한 함수로 읽는다.
 *
 * ADR-027 후속 (2026-09-20) — `white-space: normal` Text 에 `\n` 이 들어 있으면 (import · AI 생성 ·
 * 옛 데이터) DOM 은 segment break 를 공백으로 접어 2줄, Skia 는 `\n` 을 그대로 그려 8줄이었다
 * (레이아웃 상자는 Canvas 2D 측정이라 2줄 → Skia 6줄이 상자 밖). D3 대칭은 시각 결과의 동일성이라
 * Skia 가 CSS 규칙을 따른다.
 *
 * Chrome 실측 (Playwright chromium, 2026-09-20): normal 에서 segment break 는 앞뒤 문자와 무관하게
 * 공백 1개다 — 한글·한자·가나·Latin·전각 숫자 전부 "space", 연속 `\n` 도 공백 1개, 앞뒤 공백은 흡수.
 * (spec 의 East Asian Width 제거 규칙은 Blink 가 적용하지 않는다.)
 */
export type CssWhiteSpace =
  "normal" | "nowrap" | "pre" | "pre-wrap" | "pre-line";

/** normal · nowrap 에서 segment break (`\n` · `\r\n` · `\r`) 와 그 주변 공백 → 공백 1개. */
export function transformSegmentBreaks(content: string): string {
  return content.replace(/[ \t]*(?:\r\n|\r|\n)+[ \t]*/g, " ");
}

/** white-space 가 segment break 를 접는가 (normal · nowrap). */
export function collapsesSegmentBreaks(
  whiteSpace: string | undefined,
): boolean {
  return (
    whiteSpace == null || whiteSpace === "normal" || whiteSpace === "nowrap"
  );
}

/**
 * 렌더·측정 입력용 공백 처리.
 * - normal · nowrap: segment break → 공백, 공백 run → 1개, 줄 앞뒤 공백 제거
 * - pre-line: 공백 run → 1개, `\n` 은 hard break 로 보존 (줄 앞뒤 공백 제거)
 * - pre · pre-wrap: 그대로
 */
export function collapseTextWhiteSpace(
  content: string,
  whiteSpace: string | undefined,
): string {
  const ws = whiteSpace ?? "normal";
  if (ws === "pre" || ws === "pre-wrap") return content;
  if (ws === "pre-line") {
    return content
      .replace(/\r\n|\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/ ?\n ?/g, "\n");
  }
  return transformSegmentBreaks(content)
    .replace(/[ \t]+/g, " ")
    .trim();
}
