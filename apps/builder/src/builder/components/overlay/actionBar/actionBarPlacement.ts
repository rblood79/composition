/**
 * ADR-192 Phase 3 — 바 위치 계산 (순수).
 *
 * 기본 위치 = overlay 하단 중앙 (`left:50%; bottom:16px; translateX(-50%)`).
 * 사용자 이동은 그 기준의 상대 offset `{dx, dy}` 로만 저장해 뷰포트 크기가
 * 바뀌어도 "중앙 기준" 이 유지된다. clamp 는 바 전체가 overlay 안에 남도록.
 */
import type { ActionBarOffset } from "../../../stores/utils/actionBarStorage";

export const ACTION_BAR_BOTTOM_GAP = 16;

export interface Size {
  width: number;
  height: number;
}

/** 기본 위치의 바 좌상단 (overlay 로컬 좌표) */
export function defaultActionBarOrigin(overlay: Size, bar: Size) {
  return {
    x: (overlay.width - bar.width) / 2,
    y: overlay.height - ACTION_BAR_BOTTOM_GAP - bar.height,
  };
}

/**
 * offset 을 overlay 안으로 clamp. overlay 가 바보다 작으면 0 (기본 위치).
 * 반환은 항상 새 객체 — 호출부가 identity 로 변화를 판정할 수 있게.
 */
export function clampActionBarOffset(
  offset: ActionBarOffset,
  overlay: Size,
  bar: Size,
): ActionBarOffset {
  const origin = defaultActionBarOrigin(overlay, bar);
  const minDx = -origin.x;
  const maxDx = overlay.width - bar.width - origin.x;
  const minDy = -origin.y;
  const maxDy = overlay.height - bar.height - origin.y;
  if (maxDx < minDx || maxDy < minDy) return { dx: 0, dy: 0 };
  return {
    dx: Math.min(maxDx, Math.max(minDx, offset.dx)),
    dy: Math.min(maxDy, Math.max(minDy, offset.dy)),
  };
}

export function offsetsEqual(
  a: ActionBarOffset | null,
  b: ActionBarOffset | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.dx === b.dx && a.dy === b.dy;
}

/** CSS transform — 기본 translateX(-50%) 에 offset 을 더한다 */
export function actionBarTransform(offset: ActionBarOffset | null): string {
  if (!offset) return "translateX(-50%)";
  return `translate(calc(-50% + ${offset.dx}px), ${offset.dy}px)`;
}
