import { useSyncExternalStore } from "react";
import type { ViewportState } from "./ViewportController";

const INITIAL_VIEWPORT_PRESENTATION: ViewportState = Object.freeze({
  x: 0,
  y: 0,
  scale: 1,
});

let viewportPresentationSnapshot: ViewportState = INITIAL_VIEWPORT_PRESENTATION;
const listeners = new Set<() => void>();
const zoomListeners = new Set<() => void>();

function isViewportStateEqual(
  left: ViewportState,
  right: ViewportState,
): boolean {
  return left.x === right.x && left.y === right.y && left.scale === right.scale;
}

/**
 * Controller가 frame 단위로 publish하는 화면 표시용 viewport snapshot이다.
 *
 * canonical Zustand mirror, history, persistence와 의도적으로 분리한다. Canvas와
 * coordinate consumer는 controller를 직접 읽고, React presentation consumer만 이
 * external store를 구독한다.
 */
export function publishViewportPresentation(next: ViewportState): boolean {
  if (isViewportStateEqual(viewportPresentationSnapshot, next)) return false;

  const zoomChanged = viewportPresentationSnapshot.scale !== next.scale;
  viewportPresentationSnapshot = { ...next };
  for (const listener of listeners) {
    listener();
  }
  if (zoomChanged) {
    for (const listener of zoomListeners) {
      listener();
    }
  }
  return true;
}

export function getViewportPresentationSnapshot(): ViewportState {
  return viewportPresentationSnapshot;
}

export function subscribeViewportPresentation(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeViewportPresentationZoom(
  listener: () => void,
): () => void {
  zoomListeners.add(listener);
  return () => {
    zoomListeners.delete(listener);
  };
}

export function useViewportPresentationZoom(): number {
  return useSyncExternalStore(
    subscribeViewportPresentationZoom,
    () => viewportPresentationSnapshot.scale,
    () => INITIAL_VIEWPORT_PRESENTATION.scale,
  );
}

export function resetViewportPresentation(): void {
  publishViewportPresentation(INITIAL_VIEWPORT_PRESENTATION);
}
