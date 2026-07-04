/**
 * Taffy 기반 CSS Grid 레이아웃 엔진
 *
 * 기존 GridEngine의 커스텀 JS 구현 대신 Taffy WASM의 네이티브 Grid 지원을 사용합니다.
 * Feature Flag(taffyGrid)가 활성화된 경우에만 사용됩니다.
 *
 * CSS Grid 속성 → TaffyStyle 변환 포함:
 * - gridTemplateColumns / gridTemplateRows (트랙 배열)
 * - gridAutoFlow, gridAutoColumns, gridAutoRows
 * - gridColumn / gridRow (line 기반 배치: "1 / 3", "span 2")
 * - gridArea (숫자 기반 shorthand: "row-start / col-start / row-end / col-end")
 * - gap / rowGap / columnGap
 * - justifyContent / justifyItems / alignItems / alignContent
 * - justifySelf / alignSelf (아이템)
 *
 * @since 2026-02-17 Phase 6 - Grid → Taffy Grid 통합
 */

// ─── CSS 파싱 유틸리티 ────────────────────────────────────────────────

/**
 * CSS grid-template 문자열을 트랙 토큰 배열로 파싱
 *
 * Phase 4-3: repeat() 전개는 Rust 브릿지(GridTemplateComponent::Repeat)에서 처리.
 * TS는 최상위 토큰 분리만 수행하며, repeat() 토큰은 그대로 전달.
 *
 * 예) "1fr 1fr 1fr" → ["1fr", "1fr", "1fr"]
 *     "200px auto 1fr" → ["200px", "auto", "1fr"]
 *     "repeat(3, 1fr)" → ["repeat(3, 1fr)"]
 *     "minmax(100px, 1fr) 200px" → ["minmax(100px, 1fr)", "200px"]
 *     "repeat(auto-fill, minmax(200px, 1fr)) 100px" → ["repeat(auto-fill, minmax(200px, 1fr))", "100px"]
 */
export function parseGridTemplate(template: string | undefined): string[] {
  if (!template || template.trim() === "") return [];

  const tokens: string[] = [];
  let current = "";
  let depth = 0;
  const s = template.trim();

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") {
      depth++;
      current += ch;
    } else if (ch === ")") {
      depth--;
      current += ch;
    } else if (ch === " " && depth === 0) {
      const t = current.trim();
      if (t) tokens.push(t);
      current = "";
    } else {
      current += ch;
    }
  }
  const last = current.trim();
  if (last) tokens.push(last);

  return tokens;
}
