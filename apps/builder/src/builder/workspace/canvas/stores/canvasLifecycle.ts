import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type CanvasBootstrapPhase =
  "idle" | "wasm" | "fonts" | "surface" | "first-frame" | "ready" | "error";

export interface CanvasPresentationTarget {
  projectId: string;
  /** 이 revision 이상을 포함한 프레임만 준비 완료로 인정한다. */
  documentRevision: number;
}

/**
 * 캔버스 표면의 bootstrap/복구 수명주기 상태.
 *
 * `isCanvasReady` 는 컴포넌트 mount가 아니라 현재 프로젝트 target을 포함한
 * 프레임이 실제 Skia main surface에 flush됐다는 acknowledgment다. target은
 * 프로젝트 hydration이 끝난 시점에 한 번 설정되고, SkiaCanvas가 성공한
 * presentation 뒤에만 확인한다. 따라서 RAF hot path의 버전 미러링은 없다.
 */
export interface CanvasLifecycleState {
  isCanvasReady: boolean;
  isContextLost: boolean;
  activeProjectId: string | null;
  bootstrapPhase: CanvasBootstrapPhase;
  presentationTarget: CanvasPresentationTarget | null;
  beginCanvasBootstrap: (projectId: string) => void;
  setBootstrapPhase: (phase: CanvasBootstrapPhase) => void;
  setPresentationTarget: (target: CanvasPresentationTarget) => void;
  acknowledgePresentedFrame: (frame: CanvasPresentationTarget) => void;
  failCanvasBootstrap: () => void;
  setContextLost: (lost: boolean) => void;
  reset: () => void;
}

const initialLifecycleState = {
  isCanvasReady: false,
  isContextLost: false,
  activeProjectId: null,
  bootstrapPhase: "idle" as CanvasBootstrapPhase,
  presentationTarget: null,
};

export const useCanvasLifecycleStore = create<CanvasLifecycleState>()(
  subscribeWithSelector((set) => ({
    ...initialLifecycleState,

    beginCanvasBootstrap: (projectId) => {
      set({
        isCanvasReady: false,
        activeProjectId: projectId,
        bootstrapPhase: "idle",
        presentationTarget: null,
      });
    },

    setBootstrapPhase: (phase) => {
      set((state) => {
        if (
          state.bootstrapPhase === phase ||
          (state.isCanvasReady && phase !== "error")
        ) {
          return state;
        }
        return { bootstrapPhase: phase };
      });
    },

    setPresentationTarget: (target) => {
      set((state) => {
        if (state.activeProjectId !== target.projectId) return state;
        return {
          isCanvasReady: false,
          presentationTarget: target,
          // 이미 surface가 한 번 준비된 프로젝트 전환/재진입이면 다음 실제
          // presentation만 남았다. cold boot는 wasm/fonts/surface 단계를 유지한다.
          bootstrapPhase:
            state.bootstrapPhase === "ready" ||
            state.bootstrapPhase === "first-frame"
              ? "first-frame"
              : state.bootstrapPhase,
        };
      });
    },

    acknowledgePresentedFrame: (frame) => {
      set((state) => {
        const target = state.presentationTarget;
        if (
          state.isCanvasReady ||
          !target ||
          frame.projectId !== target.projectId ||
          frame.documentRevision < target.documentRevision
        ) {
          return state;
        }
        return {
          isCanvasReady: true,
          bootstrapPhase: "ready",
        };
      });
    },

    failCanvasBootstrap: () => {
      set((state) =>
        state.isCanvasReady
          ? state
          : { isCanvasReady: false, bootstrapPhase: "error" },
      );
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
