import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { CanvasViewportSnapshot } from "./types";
import type { PageLayoutPanelMetrics } from "../pageLayoutConstants";

export interface ViewportSyncState {
  zoom: number;
  panOffset: { x: number; y: number };
  containerSize: { width: number; height: number };
  pageLayoutPanelMetrics: PageLayoutPanelMetrics;
  canvasSize: { width: number; height: number };
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  setViewportSnapshot: (viewport: CanvasViewportSnapshot) => void;
  setContainerSize: (size: { width: number; height: number }) => void;
  setPageLayoutPanelMetrics: (metrics: PageLayoutPanelMetrics) => void;
  setCanvasSize: (size: { width: number; height: number }) => void;
  reset: () => void;
}

const initialViewportState = {
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  containerSize: { width: 0, height: 0 },
  pageLayoutPanelMetrics: { leftWidth: 0, rightWidth: 0, gap: 0 },
  canvasSize: { width: 1920, height: 1080 },
};

export const useViewportSyncStore = create<ViewportSyncState>()(
  subscribeWithSelector((set) => ({
    ...initialViewportState,

    setZoom: (zoom) => {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[ViewportSync] setZoom is deprecated — use applyViewportState()",
        );
      }
      set({ zoom: Math.max(0.1, Math.min(5, zoom)) });
    },

    setPanOffset: (offset) => {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[ViewportSync] setPanOffset is deprecated — use applyViewportState()",
        );
      }
      set({ panOffset: offset });
    },

    setViewportSnapshot: (viewport) => {
      set({
        panOffset: viewport.panOffset,
        zoom: Math.max(0.1, Math.min(5, viewport.zoom)),
      });
    },

    setContainerSize: (size) => {
      set({ containerSize: size });
    },

    setPageLayoutPanelMetrics: (metrics) => {
      set((state) => {
        if (
          state.pageLayoutPanelMetrics.leftWidth === metrics.leftWidth &&
          state.pageLayoutPanelMetrics.rightWidth === metrics.rightWidth &&
          state.pageLayoutPanelMetrics.gap === metrics.gap
        ) {
          return state;
        }
        return { pageLayoutPanelMetrics: metrics };
      });
    },

    setCanvasSize: (size) => {
      set({ canvasSize: size });
    },

    reset: () => {
      set(initialViewportState);
    },
  })),
);

/**
 * BuilderCanvas 가 pageLayoutPanelMetrics 를 구독할 때 쓰는 selector.
 *
 * 이 값은 frame edit mode 의 frameAreas 계산에만 쓰인다. 그런데 패널 크기 조절
 * 중에는 PanelWorkspace 가 매 프레임 `data-page-layout-*-panel-width` 를 고쳐 쓰고
 * useWorkspaceCanvasSizing 의 MutationObserver 가 그 값을 여기로 옮기므로, 값을
 * 그대로 구독하면 BuilderCanvas 전체가 매 프레임 재렌더된다 (2026-09-02 실측:
 * Navigator 드래그 중 JS 할당 109 MB/s · GC 10회/2초 → 이 구독 차단 시 21 MB/s ·
 * 1회. 프레임 드롭의 주원인). frame edit mode 가 아니면 null 을 돌려 store 변경이
 * 재렌더로 이어지지 않게 한다.
 */
export const selectFrameAreaPanelMetrics = (
  state: Pick<ViewportSyncState, "pageLayoutPanelMetrics">,
  isFrameEditMode: boolean,
): PageLayoutPanelMetrics | null =>
  isFrameEditMode ? state.pageLayoutPanelMetrics : null;

export const selectCanvasViewportSnapshot = (
  state: Pick<ViewportSyncState, "panOffset" | "zoom">,
): CanvasViewportSnapshot => ({
  panOffset: state.panOffset,
  zoom: state.zoom,
});

export function isCanvasViewportSnapshotEqual(
  a: CanvasViewportSnapshot,
  b: CanvasViewportSnapshot,
): boolean {
  return (
    a.zoom === b.zoom &&
    a.panOffset.x === b.panOffset.x &&
    a.panOffset.y === b.panOffset.y
  );
}
