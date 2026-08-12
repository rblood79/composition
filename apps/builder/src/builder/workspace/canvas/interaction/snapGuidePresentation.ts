/**
 * 스냅 정렬선 transient presentation (ADR-179 C6)
 *
 * pagePositionPresentation 동형 축소판 — 드래그 중 정렬선 목록의 module-level
 * transient 소스. usePageDrag 가 positions publish 와 같은 RAF 콜백에서 프레임당
 * 1회 publish 하고, finish/cancel 시 clear 한다.
 *
 * invalidation 은 pagePositionPresentation 에 편승한다 — guides 는 (스냅 반영
 * position, 드래그 시작 시 고정된 candidates) 의 순수 파생이라 position publish
 * 없이 단독으로 변하는 경우가 없다. 소비처(skiaOverlayBuilder)는 renderSkia
 * 시점에 snapshot 을 읽는다. 단 두 가지 순서 계약:
 * - publish 는 position publish **전** (position notify 가 트리거하는 rerender
 *   가 최신 정렬선을 읽도록)
 * - clear 는 finish/cancel presentation notify **전** (stale 정렬선 잔상 방지)
 */

import type { SnapGuide } from "./snapGuides";

export interface SnapGuidePresentationSnapshot {
  guides: readonly SnapGuide[];
  version: number;
}

const INITIAL_SNAPSHOT: SnapGuidePresentationSnapshot = Object.freeze({
  guides: [],
  version: 0,
});

let snapshot: SnapGuidePresentationSnapshot = INITIAL_SNAPSHOT;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function guidesSignature(guides: readonly SnapGuide[]): string {
  return guides
    .map((g) => `${g.axis}:${g.position}:${g.start}:${g.end}`)
    .join("|");
}

/** 동일 guides 재publish 는 no-op (version 불변 + notify 생략) */
export function publishSnapGuides(guides: readonly SnapGuide[]): boolean {
  if (guidesSignature(snapshot.guides) === guidesSignature(guides)) {
    return false;
  }
  snapshot = {
    guides: guides.map((g) => ({ ...g })),
    version: snapshot.version + 1,
  };
  notify();
  return true;
}

export function clearSnapGuides(): void {
  if (snapshot.guides.length === 0) {
    return;
  }
  snapshot = { guides: [], version: snapshot.version + 1 };
  notify();
}

export function getSnapGuidePresentationSnapshot(): SnapGuidePresentationSnapshot {
  return snapshot;
}

export function subscribeSnapGuidePresentation(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetSnapGuidePresentation(): void {
  snapshot = INITIAL_SNAPSHOT;
  notify();
}
