/**
 * Alt 거리 측정 transient presentation
 *
 * snapGuidePresentation 동형 축소판 — hover + Alt 상태의 측정 세그먼트
 * 목록을 module-level snapshot 으로 공유한다. useElementHoverInteraction 이
 * publish/clear 하고 (변경 시 overlayVersion 증가로 재렌더 트리거),
 * skiaOverlayBuilder 가 renderSkia 시점에 snapshot 을 읽는다.
 */

import type { MeasureGuide } from "./measureGuides";

export interface MeasureGuidePresentationSnapshot {
  guides: readonly MeasureGuide[];
  version: number;
}

const INITIAL_SNAPSHOT: MeasureGuidePresentationSnapshot = Object.freeze({
  guides: [],
  version: 0,
});

let snapshot: MeasureGuidePresentationSnapshot = INITIAL_SNAPSHOT;

function guidesSignature(guides: readonly MeasureGuide[]): string {
  return guides
    .map((g) => `${g.axis}:${g.start}:${g.end}:${g.cross}`)
    .join("|");
}

/** 동일 guides 재publish 는 no-op — 변경 여부를 반환 (overlay 재렌더 판단용) */
export function publishMeasureGuides(guides: readonly MeasureGuide[]): boolean {
  if (guidesSignature(snapshot.guides) === guidesSignature(guides)) {
    return false;
  }
  snapshot = {
    guides: guides.map((g) => ({ ...g })),
    version: snapshot.version + 1,
  };
  return true;
}

/** 변경 여부를 반환 (이미 비어 있으면 false) */
export function clearMeasureGuides(): boolean {
  if (snapshot.guides.length === 0) {
    return false;
  }
  snapshot = { guides: [], version: snapshot.version + 1 };
  return true;
}

export function getMeasureGuidePresentationSnapshot(): MeasureGuidePresentationSnapshot {
  return snapshot;
}

export function resetMeasureGuidePresentation(): void {
  snapshot = INITIAL_SNAPSHOT;
}
