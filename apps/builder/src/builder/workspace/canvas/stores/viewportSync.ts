import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { CanvasViewportSnapshot } from "./types";

export interface ViewportSyncState {
  zoom: number;
  panOffset: { x: number; y: number };
  containerSize: { width: number; height: number };
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
  setCanvasSize: (size: { width: number; height: number }) => void;
  setCameraGestureActive: (active: boolean) => void;
  setPageContentHeight: (pageId: string, height: number | null) => void;
  reset: () => void;
}

const initialViewportState = {
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  containerSize: { width: 0, height: 0 },
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
