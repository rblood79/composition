/**
 * Layout Engine 모듈
 *
 * ADR-005: Taffy WASM 단일 엔진으로 전체 트리 레이아웃 계산.
 * fullTreeLayout.ts가 모든 display 타입(flex/grid/block)을 단일 WASM 호출로 처리.
 *
 * @since 2026-01-28 Phase 2 - 하이브리드 레이아웃 엔진
 * @updated 2026-03-01 ADR-009 Foundation 완료 - Dropflow 제거, 단일 엔진 전환
 */

// Re-export types
export type {
  LayoutEngine,
  ComputedLayout,
  LayoutContext,
} from "./LayoutEngine";
export type {
  Margin,
  BoxModel,
  VerticalAlign,
  LineBoxItem,
  LineBox,
} from "./types";
export type { CSSVariableScope } from "./cssValueParser";

// Re-export utilities
export {
  parseMargin,
  parsePadding,
  parseBorder,
  parseBoxModel,
  parseSize,
  calculateContentWidth,
  calculateContentHeight,
  resetWarnedTokens,
  // 🚀 Phase 6: vertical-align, line-height
  parseVerticalAlign,
  parseLineHeight,
  // 🚀 §6 P1: 버튼 size config 단일 소스
  getButtonSizeConfig,
  // 🚀 §6 P1: intrinsic size 주입 (엔진 공유)
  enrichWithIntrinsicSize,
  INLINE_BLOCK_TAGS,
  getPhantomIndicatorWidth,
} from "./utils";

// W3-7: CSS var() DOM fallback 헬퍼
export { createVariableScopeWithDOMFallback } from "./cssValueParser";

// ADR-005 Phase 2: Persistent Taffy Tree + Incremental Layout
export {
  calculateFullTreeLayout,
  computePresentationLayoutTargeted,
  resetPersistentTree,
} from "./fullTreeLayout";

// ADR-005 Phase 3: Flat Render Command Stream — 공유 Layout Map
export {
  publishLayoutMap,
  publishLayoutMapsBatch,
  publishFilteredChildrenMap,
  publishSyntheticElementsMap,
  getSharedLayoutMap,
  getSharedLayoutVersion,
  onLayoutPublished,
} from "./fullTreeLayout";
