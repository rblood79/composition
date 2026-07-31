/**
 * Viewport Module
 *
 * 🚀 Phase 12 B3.2: 고성능 뷰포트 컨트롤
 *
 * @since 2025-12-12 Phase 12 B3.2
 */

export {
  ViewportController,
  getViewportController,
  resetViewportController,
  type ViewportState,
  type ViewportControllerOptions,
} from "./ViewportController";

export { useViewportControl } from "./useViewportControl";
export {
  ViewportControlBridge,
  type ViewportControlBridgeProps,
} from "./ViewportControlBridge";
export {
  ViewportInteractionSession,
  type ViewportFrameScheduler,
  type ViewportInteractionFinishReason,
  type ViewportInteractionKind,
  type ViewportInteractionSessionOptions,
} from "./ViewportInteractionSession";
