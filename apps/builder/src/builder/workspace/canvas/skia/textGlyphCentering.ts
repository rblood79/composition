/**
 * 단일행 텍스트의 글리프 기반 수직 중앙 — paragraph top 의 element-local y.
 *
 * Canvas 2D `measureText().actualBoundingBoxAscent` 는 **alphabetic baseline** 기준 ink 상단이다
 * (`textBaseline` 기본값). 그러므로 paragraph 안에서 그 ink 를 찾을 때도 alphabetic baseline 을 써야
 * 한다. 종전 (2026-04-08 `15db472bc`) 은 한글·CJK 가 섞이면 `getIdeographicBaseline()` (= 줄 아래
 * 변, baseline + descent) 을 썼다 — ink ascent 는 alphabetic 기준인데 원점만 ideographic 이라
 * 글리프가 정확히 **descent 만큼 위** 에 그려졌다 (16px Text "가운데 정렬" y −6.32 · Button
 * "저장" 라벨 y −0.05 vs "Save" 4.96 — ADR-027 D3 하니스, 2026-09-20). DOM/Preview 는 line box
 * 안 baseline 자리라 Canvas 만 6px 높았다.
 */
export interface SingleLineGlyphCenteringInput {
  /** 텍스트 상자 (content 영역) 의 top — paddingTop. */
  contentTop: number;
  /** content 영역 높이 — node.height − paddingTop − paddingBottom. */
  contentHeight: number;
  /** Canvas 2D 실측 ink (alphabetic baseline 기준 ascent · 총 높이). */
  inkAscent: number;
  inkHeight: number;
  /** paragraph 의 첫 줄 alphabetic baseline (paragraph top 기준). */
  alphabeticBaseline: number;
}

export function resolveSingleLineGlyphTop(
  input: SingleLineGlyphCenteringInput,
): number {
  const { contentTop, contentHeight, inkAscent, inkHeight, alphabeticBaseline } =
    input;
  const glyphTopOffset = alphabeticBaseline - inkAscent;
  const centeredGlyphTop =
    contentTop + Math.max(0, (contentHeight - inkHeight) / 2);
  return centeredGlyphTop - glyphTopOffset;
}
