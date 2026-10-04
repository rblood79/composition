/**
 * Layout Engine 공통 타입 정의
 *
 * @since 2026-01-28 Phase 2 - 하이브리드 레이아웃 엔진
 * @updated 2026-01-28 Phase 6 - P2 기능 (vertical-align, LineBox)
 */

/**
 * 마진/패딩 값 (상하좌우)
 */
export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
