export interface PagePosition {
  x: number;
  y: number;
}

export interface PagePositionDelta {
  dx: number;
  dy: number;
}

export type PagePositionMap = Record<string, PagePosition | undefined>;

export interface PagePositionPresentationSnapshot {
  canonical: PagePositionMap;
  /**
   * ADR-178: 드래그 중인 페이지들의 transient override — 드래그 대상 수만큼의
   * **소집합** Map (선택 페이지 수 ≤ 전체). 전체 positions map 은 복사하지
   * 않는다 (ADR-176 O(1) 계약 승계 — R3).
   */
  activeOverrides: ReadonlyMap<string, PagePosition> | null;
  version: number;
  isActive: boolean;
  startBreakpoint: string | null;
}

const EMPTY_PAGE_POSITIONS: PagePositionMap = Object.freeze({});
const INITIAL_SNAPSHOT: PagePositionPresentationSnapshot = Object.freeze({
  canonical: EMPTY_PAGE_POSITIONS,
  activeOverrides: null,
  version: 0,
  isActive: false,
  startBreakpoint: null,
});

let snapshot: PagePositionPresentationSnapshot = INITIAL_SNAPSHOT;
const listeners = new Set<() => void>();

export function isSamePosition(
  left: PagePosition | null | undefined,
  right: PagePosition | null | undefined,
): boolean {
  return left?.x === right?.x && left?.y === right?.y;
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * 현재 canonical page position map을 고정하고 드래그 대상 페이지(들)만
 * transient로 표시한다. 전체 positions map은 복사하지 않는다.
 *
 * ADR-178: 다중 페이지 드래그 — canonical 에 위치가 없는 pageId 는 제외하고,
 * 전부 없으면 false (드래그 불가). 단일은 요소 1개 배열로 동일 경로.
 */
export function beginPagePositionPresentation(
  canonical: PagePositionMap,
  pageIds: readonly string[],
  startBreakpoint: string,
): boolean {
  const overrides = new Map<string, PagePosition>();
  for (const pageId of pageIds) {
    const position = canonical[pageId];
    if (position) {
      overrides.set(pageId, { x: position.x, y: position.y });
    }
  }
  if (overrides.size === 0) {
    return false;
  }

  snapshot = {
    canonical,
    activeOverrides: overrides,
    version: snapshot.version + 1,
    isActive: true,
    startBreakpoint,
  };
  notify();
  return true;
}

/**
 * 드래그 대상 페이지들의 최신 transient 위치를 frame 단위로 publish한다 —
 * 프레임당 1회 호출 (ADR-176 G2 계약). begin 에 없던 pageId 는 무시.
 */
export function publishPagePositionPresentation(
  positions: ReadonlyArray<{ pageId: string; position: PagePosition }>,
): boolean {
  const current = snapshot.activeOverrides;
  if (!snapshot.isActive || !current) {
    return false;
  }

  let changed = false;
  const next = new Map(current);
  for (const { pageId, position } of positions) {
    const existing = current.get(pageId);
    if (!existing || isSamePosition(existing, position)) {
      continue;
    }
    next.set(pageId, { x: position.x, y: position.y });
    changed = true;
  }
  if (!changed) {
    return false;
  }

  snapshot = {
    ...snapshot,
    activeOverrides: next,
    version: snapshot.version + 1,
  };
  notify();
  return true;
}

/** 정상 종료 후 canonical map reference로 교체하고 transient override를 제거한다. */
export function finishPagePositionPresentation(
  canonical: PagePositionMap,
): void {
  snapshot = {
    canonical,
    activeOverrides: null,
    version: snapshot.version + 1,
    isActive: false,
    startBreakpoint: null,
  };
  notify();
}

/** 취소 시 canonical map은 유지하고 transient override만 제거한다. */
export function cancelPagePositionPresentation(): void {
  if (!snapshot.isActive) {
    return;
  }

  snapshot = {
    ...snapshot,
    activeOverrides: null,
    version: snapshot.version + 1,
    isActive: false,
    startBreakpoint: null,
  };
  notify();
}

export function getPagePositionPresentationSnapshot(): PagePositionPresentationSnapshot {
  return snapshot;
}

export function subscribePagePositionPresentation(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readPagePosition(
  pageId: string,
  currentSnapshot: PagePositionPresentationSnapshot = snapshot,
): PagePosition | undefined {
  if (currentSnapshot.isActive && currentSnapshot.activeOverrides) {
    const override = currentSnapshot.activeOverrides.get(pageId);
    if (override) {
      return override;
    }
  }

  return currentSnapshot.canonical[pageId];
}

/**
 * Interaction hit-test용 page position 판독.
 *
 * transient presentation은 drag가 active인 동안에만 canonical 좌표보다 우선한다.
 * drag 종료 뒤 snapshot.canonical은 마지막 drag breakpoint의 참조를 유지하므로,
 * inactive 상태에서는 caller가 제공한 현재 breakpoint map을 사용해야 한다.
 */
export function readPagePositionForInteraction(
  pageId: string,
  currentCanonical: PagePositionMap,
  currentSnapshot: PagePositionPresentationSnapshot = snapshot,
): PagePosition | undefined {
  if (!currentSnapshot.isActive) {
    return currentCanonical[pageId];
  }

  return readPagePosition(pageId, currentSnapshot) ?? currentCanonical[pageId];
}

export function readPagePositionDelta(
  pageId: string,
  currentSnapshot: PagePositionPresentationSnapshot = snapshot,
): PagePositionDelta | null {
  if (!currentSnapshot.isActive) {
    return null;
  }

  const canonical = currentSnapshot.canonical[pageId];
  const presented = readPagePosition(pageId, currentSnapshot);
  if (!canonical || !presented) {
    return null;
  }

  const dx = presented.x - canonical.x;
  const dy = presented.y - canonical.y;
  if (dx === 0 && dy === 0) {
    return null;
  }

  return { dx, dy };
}

export function resetPagePositionPresentation(): void {
  snapshot = INITIAL_SNAPSHOT;
  notify();
}
