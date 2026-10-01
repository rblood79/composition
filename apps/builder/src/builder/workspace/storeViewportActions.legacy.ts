/**
 * ADR-248 Phase 4e-7: the old Builder's zoom-menu Fit / Fill / Align pages — over the old canvas
 * size and the old store's page placement. The old `BuilderCore` passes it to the header; it goes
 * with the old Builder.
 */
import { useViewportSyncStore } from "./canvas/stores";
import {
  applyViewportState,
  computeFillViewport,
  computeFitViewport,
} from "./canvas/viewport/viewportActions";
import { alignPagesToScreen } from "./canvas/viewport/pageLayoutActions";
import type { ZoomControlsViewportActions } from "./ZoomControls";

export const STORE_VIEWPORT_ACTIONS: ZoomControlsViewportActions = {
  fit() {
    const { containerSize, canvasSize } = useViewportSyncStore.getState();
    if (containerSize.width === 0 || containerSize.height === 0) return;
    applyViewportState(computeFitViewport({ canvasSize, containerSize }));
  },
  fill() {
    const { containerSize, canvasSize } = useViewportSyncStore.getState();
    if (containerSize.width === 0 || containerSize.height === 0) return;
    applyViewportState(computeFillViewport({ canvasSize, containerSize }));
  },
  alignPages: alignPagesToScreen,
};
