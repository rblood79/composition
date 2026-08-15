import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

/**
 * 캔버스 표면의 수명주기 상태.
 *
 * `renderVersion` / `lastPixiRenderVersion` / `incrementRenderVersion` /
 * `syncPixiVersion` / `selectIsSyncMismatch` 는 삭제됐다 (2026-08-15).
 * store 렌더 버전과 PixiJS 렌더러의 확인 응답을 대조하던 프로토콜인데,
 * ADR-900 이후 `incrementRenderVersion` 의 호출부가 0건이라 `renderVersion`
 * 이 0 에 머물렀고, 유일한 `syncPixiVersion` 호출부는 그 0 을 그대로 되비추고
 * 있었다 — 불일치 판정이 `0 - 0 > 2` 로 **구조상 항상 false** 였다.
 */
export interface CanvasLifecycleState {
  isCanvasReady: boolean;
  isContextLost: boolean;
  setCanvasReady: (ready: boolean) => void;
  setContextLost: (lost: boolean) => void;
  reset: () => void;
}

const initialLifecycleState = {
  isCanvasReady: false,
  isContextLost: false,
};

export const useCanvasLifecycleStore = create<CanvasLifecycleState>()(
  subscribeWithSelector((set) => ({
    ...initialLifecycleState,

    setCanvasReady: (ready) => {
      set({ isCanvasReady: ready });
    },

    setContextLost: (lost) => {
      set({ isContextLost: lost });
      if (lost) {
        console.warn("⚠️ [CanvasLifecycle] WebGL context lost");
      } else {
        console.log("✅ [CanvasLifecycle] WebGL context restored");
      }
    },

    reset: () => {
      set(initialLifecycleState);
    },
  })),
);

export const selectIsCanvasUsable = (
  state: Pick<CanvasLifecycleState, "isCanvasReady" | "isContextLost">,
): boolean => state.isCanvasReady && !state.isContextLost;
