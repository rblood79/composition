import type { PagePositionPresentationSnapshot } from "./interaction/pagePositionPresentation";
import type { CameraState } from "./skia/types";

export interface CanvasFramePresentationSnapshot {
  readonly cameraState: Readonly<CameraState>;
  readonly pagePositionSnapshot: PagePositionPresentationSnapshot;
}

export type CanvasFramePresentationListener = (
  cameraState: Readonly<CameraState>,
  pagePositionSnapshot: PagePositionPresentationSnapshot,
) => void;

let latestCameraState: Readonly<CameraState> | null = null;
let latestPagePositionSnapshot: PagePositionPresentationSnapshot | null = null;
const listeners = new Set<CanvasFramePresentationListener>();

/**
 * Skia가 현재 프레임에 실제로 소비하는 camera/page snapshot을 DOM overlay에 전달한다.
 * 별도 RAF나 React store를 만들지 않아 두 consumer가 같은 browser paint를 공유한다.
 */
export function publishCanvasFramePresentation(
  cameraState: Readonly<CameraState>,
  pagePositionSnapshot: PagePositionPresentationSnapshot,
): void {
  latestCameraState = cameraState;
  latestPagePositionSnapshot = pagePositionSnapshot;
  for (const listener of listeners) {
    listener(cameraState, pagePositionSnapshot);
  }
}

export function getCanvasFramePresentationSnapshot(): CanvasFramePresentationSnapshot | null {
  if (!latestCameraState || !latestPagePositionSnapshot) return null;
  return {
    cameraState: latestCameraState,
    pagePositionSnapshot: latestPagePositionSnapshot,
  };
}

export function subscribeCanvasFramePresentation(
  listener: CanvasFramePresentationListener,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetCanvasFramePresentation(): void {
  latestCameraState = null;
  latestPagePositionSnapshot = null;
}
