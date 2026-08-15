/**
 * Selection System Index
 *
 * 🚀 Phase 10 B1.3: Selection + Transform 모듈 내보내기
 *
 * @since 2025-12-11 Phase 10 B1.3
 */

// Types
export type {
  HandlePosition,
  HandleType,
  CursorStyle,
  BoundingBox,
  TransformBox,
  DragOperation,
  DragState,
  SelectionState,
  HandleConfig,
} from "./types";

export {
  HANDLE_CONFIGS,
  HANDLE_SIZE,
  SELECTION_COLOR,
  HANDLE_FILL_COLOR,
  HANDLE_STROKE_COLOR,
  LASSO_COLOR,
  LASSO_FILL_ALPHA,
  calculateBounds,
  calculateCombinedBounds,
  boxesIntersect,
  pointInBox,
  hitTestHandle,
  hitTestSelectionBounds,
} from "./types";

export { getResizeCursorForAngle, resolveHandleCursor } from "./resizeCursors";

// Selection 컴포넌트 제거 후 hit-test 유틸리티만 유지
export {
  findBodySelectionAtCanvasPoint,
  pickTopmostHitElementId,
} from "./selectionHitTest";
export type {
  BodySelectionResult,
  CanvasPoint,
  FrameBodySelectionArea,
  PageLike,
  PagePositionMap,
} from "./selectionHitTest";

// Hooks
export { useDragInteraction } from "./useDragInteraction";
export type {
  UseDragInteractionOptions,
  UseDragInteractionReturn,
} from "./useDragInteraction";
