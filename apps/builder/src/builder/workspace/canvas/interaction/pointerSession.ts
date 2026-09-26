const DOUBLE_CLICK_THRESHOLD = 300;

export interface PointerSessionSnapshot {
  lastClickTargetId: string | null;
  lastClickTime: number;
}

export function isPointerDoubleClick(
  snapshot: PointerSessionSnapshot,
  targetId: string | null,
  now: number,
  threshold = DOUBLE_CLICK_THRESHOLD,
): boolean {
  if (!targetId) {
    return false;
  }

  if (snapshot.lastClickTargetId !== targetId) {
    return false;
  }

  return now - snapshot.lastClickTime < threshold;
}

export function commitPointerClick(
  targetId: string | null,
  now: number,
): PointerSessionSnapshot {
  return {
    lastClickTargetId: targetId,
    lastClickTime: now,
  };
}

export function resetPointerClick(): PointerSessionSnapshot {
  return {
    lastClickTargetId: null,
    lastClickTime: 0,
  };
}

export function resolveDoubleClickTargetId(
  hitElementId: string | null,
  selectedTargetId: string | null,
): string | null {
  return hitElementId ?? selectedTargetId;
}

/**
 * ADR-150 A3' — double-click 연속성 키. collection projection 을 owner 로 돌린 클릭은 원래 hit 노드 id
 * (카드 · 자식 단위) 로 잇는다 — owner id 로 이으면 서로 다른 카드를 300ms 안에 한 번씩 눌러도
 * double-click 이 된다. 원래 hit 가 없는 클릭은 선택 id 그대로 (동작 변경 0). 기록 (`commitPointerClick`)
 * 과 판정 (`isPointerDoubleClick`) 이 같은 키를 써야 한다.
 */
export function resolvePointerClickKey(
  sourceHit: { nodeId: string } | null | undefined,
  targetId: string | null,
): string | null {
  return sourceHit?.nodeId ?? targetId;
}
