/**
 * Position Sticky Resolver (ADR-100 Phase 3)
 *
 * 엔진 레이아웃 결과에 post-layout 보정 적용.
 * Chrome Blink 기법: 3단계 상태 전환 (normal → stuck → limit)
 */

export interface StickyInput {
  /** 레이아웃 결과 y 좌표 */
  elementY: number;
  /** CSS top 값 (px) */
  stickyTop: number;
  /** 현재 스크롤 오프셋 */
  scrollOffset: number;
  /** sticky 제한 컨테이너 상단 y */
  containerTop: number;
  /** sticky 제한 컨테이너 하단 y */
  containerBottom: number;
  /** 요소 높이 */
  elementHeight: number;
}

/**
 * sticky 요소의 보정된 y 좌표를 계산.
 *
 * 3단계 상태:
 * 1. Normal — 아직 스크롤되지 않음 → 원래 y
 * 2. Stuck  — 뷰포트 top에 고정 → scrollOffset + stickyTop
 * 3. Limit  — 부모 하단에 도달 → containerBottom - elementHeight
 */
export function resolveStickyY(input: StickyInput): number {
  const { elementY, stickyTop, scrollOffset, containerBottom, elementHeight } =
    input;

  const viewportTop = scrollOffset + stickyTop;

  // Normal: 아직 고정 위치에 도달하지 않음
  if (elementY >= viewportTop) return elementY;

  // Stuck: 뷰포트 top에 고정
  const stuckY = viewportTop;

  // Limit: 부모 하단을 벗어나지 않음
  const maxY = containerBottom - elementHeight;
  return Math.min(stuckY, maxY);
}

export interface StickyInputX {
  /** 레이아웃 결과 x 좌표 */
  elementX: number;
  /** CSS left 값 (px) */
  stickyLeft: number;
  /** 현재 수평 스크롤 오프셋 */
  scrollOffset: number;
  /** sticky 제한 컨테이너 좌측 x */
  containerLeft: number;
  /** sticky 제한 컨테이너 우측 x */
  containerRight: number;
  /** 요소 너비 */
  elementWidth: number;
}

/**
 * sticky 요소의 보정된 x 좌표를 계산 (수평 스크롤용).
 *
 * 3단계 상태:
 * 1. Normal — 아직 스크롤되지 않음 → 원래 x
 * 2. Stuck  — 뷰포트 left에 고정 → scrollOffset + stickyLeft
 * 3. Limit  — 부모 우측에 도달 → containerRight - elementWidth
 */
export function resolveStickyX(input: StickyInputX): number {
  const { elementX, stickyLeft, scrollOffset, containerRight, elementWidth } =
    input;

  const viewportLeft = scrollOffset + stickyLeft;

  // Normal: 아직 고정 위치에 도달하지 않음
  if (elementX >= viewportLeft) return elementX;

  // Stuck: 뷰포트 left에 고정
  const stuckX = viewportLeft;

  // Limit: 부모 우측을 벗어나지 않음
  const maxX = containerRight - elementWidth;
  return Math.min(stuckX, maxX);
}
