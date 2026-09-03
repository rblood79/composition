/**
 * Workspace Module
 *
 * 🚀 Phase 10: WebGL Builder 워크스페이스
 *
 * @since 2025-12-11 Phase 10 B1.1
 * @updated 2025-12-11 Phase 10 B1.2-B1.5 완료
 */

// Main Components
export { Workspace } from "./Workspace";
export { BuilderCanvas } from "./canvas/BuilderCanvas";

// Stores
export {
  useCanvasSyncStore,
  type CanvasSyncState,
  type GPUMetrics,
} from "./canvas/canvasSync";
export {
  useViewportSyncStore,
  useCanvasLifecycleStore,
  useCanvasMetricsStore,
  type ViewportSyncState,
  type CanvasLifecycleState,
  type CanvasMetricsState,
  type CanvasViewportSnapshot,
} from "./canvas/stores";
export {
  useCanvasStore,
  useCanvasElements,
  useCanvasSelectedElement,
  useCanvasSelectedElementIds,
  useCanvasUpdateElement,
  useCanvasSetSelectedElement,
} from "../stores/canvasStore"; // B2.4: Direct Zustand Access (moved to stores/)

// Utils
export { gpuProfiler, useGPUProfiler } from "./canvas/utils/gpuProfilerCore";

export { GPUDebugOverlay } from "./canvas/utils/GPUDebugOverlay";

// Style conversion (CSS → 렌더 속성)
export * from "./canvas/styleConversion";

// Selection (B1.3)
export * from "./canvas/selection";

// Text Edit Overlay (B1.5)
export * from "./overlay";
