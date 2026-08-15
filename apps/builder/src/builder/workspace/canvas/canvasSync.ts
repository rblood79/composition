/**
 * Canvas Sync Compatibility Layer
 *
 * ADR-037 Phase 5:
 * - viewport -> stores/viewportSync
 * - lifecycle -> stores/canvasLifecycle
 * - metrics -> stores/canvasMetrics
 *
 * 이 파일은 기존 호출부 호환을 위한 adapter/barrel만 담당한다.
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  useCanvasLifecycleStore,
  useCanvasMetricsStore,
  useViewportSyncStore,
  selectCanvasViewportSnapshot,
  isCanvasViewportSnapshotEqual,
  selectIsCanvasUsable,
  type CanvasLifecycleState,
  type CanvasMetricsState,
  type CanvasViewportSnapshot,
  type GPUMetrics,
  type ViewportSyncState,
} from "./stores";

export interface CanvasSyncState
  extends ViewportSyncState, CanvasLifecycleState, CanvasMetricsState {}

function createCanvasSyncState(): CanvasSyncState {
  const viewport = useViewportSyncStore.getState();
  const lifecycle = useCanvasLifecycleStore.getState();
  const metrics = useCanvasMetricsStore.getState();

  return {
    ...viewport,
    ...lifecycle,
    ...metrics,
  };
}

export const useCanvasSyncStore = create<CanvasSyncState>()(
  subscribeWithSelector(() => createCanvasSyncState()),
);

function syncCanvasSyncStore(): void {
  useCanvasSyncStore.setState(createCanvasSyncState());
}

useViewportSyncStore.subscribe(syncCanvasSyncStore);
useCanvasLifecycleStore.subscribe(syncCanvasSyncStore);
useCanvasMetricsStore.subscribe(syncCanvasSyncStore);

export {
  selectCanvasViewportSnapshot,
  isCanvasViewportSnapshotEqual,
  selectIsCanvasUsable,
};

// `detectSyncMismatch()` 는 삭제됐다 (2026-08-15) — 호출부 0건이었고, 구 렌더
//   버전 판정식이 양쪽 모두 0에 고정돼 **구조상 항상 false** 였다.
//
// `logGPUMetrics()` 도 삭제됐다 — 호출부 0건이었고, 로그 5줄 중
//   3줄(vram/textures/sprites)이 제거된 리소스 회계라 상시 0 이었다.
//   실시간 지표는 `GPUDebugOverlay` 가 담당한다.

export type { GPUMetrics, CanvasViewportSnapshot };

export default useCanvasSyncStore;
