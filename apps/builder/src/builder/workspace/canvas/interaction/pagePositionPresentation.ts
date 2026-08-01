import { useSyncExternalStore } from "react";

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
  activePageId: string | null;
  activeOverride: PagePosition | null;
  version: number;
  isActive: boolean;
  startBreakpoint: string | null;
}

const EMPTY_PAGE_POSITIONS: PagePositionMap = Object.freeze({});
const INITIAL_SNAPSHOT: PagePositionPresentationSnapshot = Object.freeze({
  canonical: EMPTY_PAGE_POSITIONS,
  activePageId: null,
  activeOverride: null,
  version: 0,
  isActive: false,
  startBreakpoint: null,
});

let snapshot: PagePositionPresentationSnapshot = INITIAL_SNAPSHOT;
const listeners = new Set<() => void>();

function isSamePosition(
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
 * 현재 canonical page position map을 고정하고 active page 한 건만 transient로
 * 표시한다. 전체 positions map은 복사하지 않는다.
 */
export function beginPagePositionPresentation(
  canonical: PagePositionMap,
  pageId: string,
  startBreakpoint: string,
): boolean {
  const position = canonical[pageId];
  if (!position) {
    return false;
  }

  snapshot = {
    canonical,
    activePageId: pageId,
    activeOverride: { x: position.x, y: position.y },
    version: snapshot.version + 1,
    isActive: true,
    startBreakpoint,
  };
  notify();
  return true;
}

/** 현재 active page의 최신 transient 위치를 frame 단위로 publish한다. */
export function publishPagePositionPresentation(
  pageId: string,
  position: PagePosition,
): boolean {
  if (!snapshot.isActive || snapshot.activePageId !== pageId) {
    return false;
  }
  if (isSamePosition(snapshot.activeOverride, position)) {
    return false;
  }

  snapshot = {
    ...snapshot,
    activeOverride: { x: position.x, y: position.y },
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
    activePageId: null,
    activeOverride: null,
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
    activePageId: null,
    activeOverride: null,
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
  if (
    currentSnapshot.isActive &&
    currentSnapshot.activePageId === pageId &&
    currentSnapshot.activeOverride
  ) {
    return currentSnapshot.activeOverride;
  }

  return currentSnapshot.canonical[pageId];
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

/** page frame/title/hit-test consumer가 동일한 page coordinate reader를 사용한다. */
export function readPageFramePosition(
  pageId: string,
  currentSnapshot: PagePositionPresentationSnapshot = snapshot,
): PagePosition | undefined {
  return readPagePosition(pageId, currentSnapshot);
}

export function usePagePositionPresentation(): PagePositionPresentationSnapshot {
  return useSyncExternalStore(
    subscribePagePositionPresentation,
    getPagePositionPresentationSnapshot,
    () => INITIAL_SNAPSHOT,
  );
}

export function resetPagePositionPresentation(): void {
  snapshot = INITIAL_SNAPSHOT;
  notify();
}
