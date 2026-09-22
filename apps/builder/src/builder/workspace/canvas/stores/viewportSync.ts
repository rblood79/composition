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
  /**
   * ADR-221 — 카메라 제스처 (휠 pan/zoom · 스페이스/중클릭 pan) 진행 중. `useViewportControl`
   * 의 `onInteractionStart/End` 가 세우고, DOM chrome (페이지 헤더 층) 이 이 동안 배치를 멈춘다.
   * 프로그램 zoom · 페이지 drag 는 게이트 대상이 아니다 (breakdown §3).
   */
  cameraGestureActive: boolean;
  /**
   * ADR-231 — 레이아웃이 발행한 페이지별 body 높이 (border-box). Components 페이지 frame 높이의
   * 원천 (`buildPageFrames`). 레이아웃 **입력** 이 아니다 — dimension key · available 상자에 넣지
   * 않는다 (R1 루프 차단). 같은 값이면 no-op.
   */
  pageContentHeights: ReadonlyMap<string, number>;
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  setViewportSnapshot: (viewport: CanvasViewportSnapshot) => void;
  setContainerSize: (size: { width: number; height: number }) => void;
  setPageLayoutPanelMetrics: (metrics: PageLayoutPanelMetrics) => void;
  setCanvasSize: (size: { width: number; height: number }) => void;
  setCameraGestureActive: (active: boolean) => void;
  setPageContentHeight: (pageId: string, height: number | null) => void;
  reset: () => void;
}

const initialViewportState = {
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  containerSize: { width: 0, height: 0 },
  pageLayoutPanelMetrics: { leftWidth: 0, rightWidth: 0, gap: 0 },
  canvasSize: { width: 1920, height: 1080 },
  cameraGestureActive: false,
  pageContentHeights: new Map<string, number>() as ReadonlyMap<string, number>,
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

    setPageContentHeight: (pageId, height) => {
      set((state) => {
        const prev = state.pageContentHeights.get(pageId);
        if (height === null) {
          if (prev === undefined) return state;
          const next = new Map(state.pageContentHeights);
          next.delete(pageId);
          return { pageContentHeights: next };
        }
        if (!Number.isFinite(height) || prev === height) return state;
        const next = new Map(state.pageContentHeights);
        next.set(pageId, height);
        return { pageContentHeights: next };
      });
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

    setCameraGestureActive: (active) => {
      set((state) =>
        state.cameraGestureActive === active
          ? state
          : { cameraGestureActive: active },
      );
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
