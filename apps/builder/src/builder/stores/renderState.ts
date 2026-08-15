/**
 * Render State Store
 *
 * Phase G: WebGL 렌더링 전용 상태 관리
 *
 * UI 상태와 분리하여 불필요한 리렌더링 방지
 * Canvas 렌더링 관련 상태만 관리
 */

import { create } from "zustand";

interface RenderState {
  /** 렌더링 진행 중 여부 */
  isRendering: boolean;

  /** 총 프레임 카운트 */
  frameCount: number;

  /** 마지막 렌더링 시간 (ms) */
  lastRenderTime: number;

  /** WebGL 컨텍스트 손실 여부 */
  contextLost: boolean;

  /** 현재 FPS */
  fps: number;

  /** 평균 프레임 시간 (ms) */
  avgFrameTime: number;

  // Actions
  setRendering: (value: boolean) => void;
  incrementFrame: () => void;
  setContextLost: (value: boolean) => void;
  updateFps: (fps: number, avgFrameTime: number) => void;
  reset: () => void;
}

const initialState = {
  isRendering: false,
  frameCount: 0,
  lastRenderTime: 0,
  contextLost: false,
  fps: 0,
  avgFrameTime: 0,
};

export const useRenderState = create<RenderState>((set) => ({
  ...initialState,

  setRendering: (value) => set({ isRendering: value }),

  incrementFrame: () =>
    set((state) => ({
      frameCount: state.frameCount + 1,
      lastRenderTime: performance.now(),
    })),

  setContextLost: (value) => set({ contextLost: value }),

  updateFps: (fps, avgFrameTime) => set({ fps, avgFrameTime }),

  reset: () => set(initialState),
}));

/**
 * 렌더링 상태 선택자
 */
export const selectIsRendering = (state: RenderState) => state.isRendering;
export const selectContextLost = (state: RenderState) => state.contextLost;
export const selectFps = (state: RenderState) => state.fps;
