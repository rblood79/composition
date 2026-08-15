import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { GPUMetrics } from "./types";

export interface CanvasMetricsState {
  gpuMetrics: GPUMetrics;
  updateGPUMetrics: (metrics: Partial<GPUMetrics>) => void;
  reset: () => void;
}

const initialGPUMetrics: GPUMetrics = {
  vramUsed: 0,
  textureCount: 0,
  spriteCount: 0,
  lastFrameTime: 0,
  averageFps: 0,
  boundsLookupAvgMs: 0,
  cullingFilterAvgMs: 0,
  blockLayoutAvgMs: 0,
  gridLayoutAvgMs: 0,
  skiaFrameTimeAvgMs: 0,
  elementCount: 0,
  contentRenderTimeMs: 0,
  blitTimeMs: 0,
  idleFrameRatio: 0,
  dirtyRectCountAvg: 0,
  contentRendersPerSec: 0,
  registryChangesPerSec: 0,
  presentFramesPerSec: 0,
  skiaTreeBuildTimeMs: 0,
  selectionBuildTimeMs: 0,
  aiBoundsBuildTimeMs: 0,
  commandCountAvg: 0,
  drawCallCountAvg: 0,
  gpuFrameTimeMs: 0,
};

export const useCanvasMetricsStore = create<CanvasMetricsState>()(
  subscribeWithSelector((set) => ({
    gpuMetrics: initialGPUMetrics,

    updateGPUMetrics: (metrics) => {
      set((state) => ({
        gpuMetrics: { ...state.gpuMetrics, ...metrics },
      }));
    },

    reset: () => {
      set({ gpuMetrics: initialGPUMetrics });
    },
  })),
);

export { initialGPUMetrics };
