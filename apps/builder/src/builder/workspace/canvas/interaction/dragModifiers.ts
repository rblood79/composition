/**
 * 이동 modifier — ADR-178 Phase 3.
 *
 * - Shift 축 고정: 드래그 **중** 컨텍스트 한정 (HC5 — Shift 클릭 다중 선택
 *   토글/Shift 스크롤과 시점 분리: 클릭은 threshold 미만이라 축 고정이 아예
 *   개입하지 않는다). 시작점 기준 |dx| >= |dy| 면 수평 고정, 아니면 수직.
 * - Alt 드래그 복제: pointerdown 시점의 altKey 를 arm 해 두고 드롭 시점에
 *   기존 duplicate 파이프라인(copy/paste + trackMultiPaste 1 entry)으로
 *   복제본을 델타 위치에 생성한다 — 원본은 무변경(잔류).
 */

export interface DragPoint {
  x: number;
  y: number;
}

/**
 * Shift 축 고정 — 시작점 기준 지배 축만 남긴다.
 * |dx| >= |dy| → 수평 고정 (y = 시작 y), 아니면 수직 고정 (x = 시작 x).
 */
export function applyAxisLock(start: DragPoint, current: DragPoint): DragPoint {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? { x: current.x, y: start.y }
    : { x: start.x, y: current.y };
}

/** 델타 형태의 축 고정 (페이지 드래그 — 리더 델타에 적용). */
export function applyAxisLockToDelta(dx: number, dy: number): DragPoint {
  return Math.abs(dx) >= Math.abs(dy) ? { x: dx, y: 0 } : { x: 0, y: dy };
}

// ADR-179: Cmd/Ctrl 홀드 = 전 스냅 억제 — pointer handler(pointermove 세팅)와
// useDragBridge(스냅 판정 소비)가 공유하는 세션 플래그 (Alt arm 동형).
// pointerup 시 반드시 해제된다.
let snapSuppressed = false;

export function setDragSnapSuppressed(suppressed: boolean): void {
  snapSuppressed = suppressed;
}

export function isDragSnapSuppressed(): boolean {
  return snapSuppressed;
}

// Alt 드래그 복제 arm — pointerdown(요소 pendingDrag 설정 시점)의 altKey.
// pointer handler(세팅)와 useDragBridge(드롭 소비)가 모듈 경계를 넘어
// 공유하는 세션 플래그다. 드롭/취소 시 반드시 해제된다.
let altCloneArmed = false;

export function armDragAltClone(armed: boolean): void {
  altCloneArmed = armed;
}

export function isDragAltCloneArmed(): boolean {
  return altCloneArmed;
}
