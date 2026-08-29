/**
 * ADR-192 Phase 3 — 바 위치 계산 (순수).
 *
 * 자동 위치 = 선택 대상이 속한 page 하단 중앙. 사용자 이동 뒤에는 기존 overlay
 * 하단 중앙 기준 offset `{dx, dy}` 를 유지해 저장 포맷과 수동 위치 계약을 보존한다.
 * clamp 는 수동 위치에서 바 전체가 overlay 안에 남도록 한다.
 */
import type { ActionBarOffset } from "../../../stores/utils/actionBarStorage";
import { SELECTION_DIMENSION_LABEL_BOTTOM_EXTENT } from "../../../workspace/canvas/selectionOverlayGeometry";

export const ACTION_BAR_BOTTOM_GAP = 16;
export const ACTION_BAR_PAGE_CLEARANCE = 10;
export const ACTION_BAR_PAGE_GAP =
  SELECTION_DIMENSION_LABEL_BOTTOM_EXTENT + ACTION_BAR_PAGE_CLEARANCE;

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface PageActionBarAnchorInput {
  pagePosition: Point;
  pageSize: Size;
  panOffset: Point;
  zoom: number;
}

/** page 전체 높이 아래, page width 중앙의 overlay-local screen 좌표 */
export function pageActionBarAnchor({
  pagePosition,
  pageSize,
  panOffset,
  zoom,
}: PageActionBarAnchorInput): Point {
  return {
    x: (pagePosition.x + pageSize.width / 2) * zoom + panOffset.x,
    y:
      (pagePosition.y + pageSize.height) * zoom +
      panOffset.y +
      ACTION_BAR_PAGE_GAP,
  };
}

/** 기본 위치의 바 좌상단 (overlay 로컬 좌표) */
export function defaultActionBarOrigin(overlay: Size, bar: Size) {
  return {
    x: (overlay.width - bar.width) / 2,
    y: overlay.height - ACTION_BAR_BOTTOM_GAP - bar.height,
  };
}

/** 자동 page anchor에서 수동 drag 좌표계로 점프 없이 전환할 base offset */
export function pageAnchorToManualOffset(
  anchor: Point,
  overlay: Size,
  bar: Size,
): ActionBarOffset {
  const manualOrigin = defaultActionBarOrigin(overlay, bar);
  return {
    dx: anchor.x - overlay.width / 2,
    dy: anchor.y - manualOrigin.y,
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
