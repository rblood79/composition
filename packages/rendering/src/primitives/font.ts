/**
 * Font Primitives — CSS 표준 상수
 *
 * CSS font-stretch keyword → CanvasKit FontWidth 인덱스 매핑.
 * CSS 표준 (9 keyword) 이며 Spec SSOT 영역이 아닌 CSS 표준 상수로 별도 분리.
 *
 * ADR-091 Phase 1 — `cssResolver.ts:181` FONT_STRETCH_KEYWORD_MAP 이관.
 *
 * @packageDocumentation
 */

/**
 * font-stretch keyword → CanvasKit FontWidth (1~9) 매핑.
 *
 * - CSS 표준: `ultra-condensed` (50%) ~ `ultra-expanded` (200%)
 * - CanvasKit Paint API 의 `FontWidth` 인덱스 범위 (1~9)
 */
export const FONT_STRETCH_KEYWORD_MAP: Record<string, number> = {
  "ultra-condensed": 1,
  "extra-condensed": 2,
  condensed: 3,
  "semi-condensed": 4,
  normal: 5,
  "semi-expanded": 6,
  expanded: 7,
  "extra-expanded": 8,
  "ultra-expanded": 9,
};
