/**
 * Renderers - Public API
 *
 * React, PIXI, CSS 렌더러
 *
 * @packageDocumentation
 */

// React Renderer
export {
  renderToReact,
  generateCSSVariables,
  generateSizeVariables,
} from "./ReactRenderer";

export type { ReactRenderResult } from "./ReactRenderer";

// Variant/Size resolvers (Skia/Canvas 공용, ADR-100 PixiRenderer 제거 후 분리)
export { getVariantColors, getSizePreset } from "./utils/variantColors";

// CSS Generator
export { generateCSS, generateAllCSS } from "./CSSGenerator";

// ADR-108 P1: containerVariants 런타임 소비 helper
export { resolveContainerVariants } from "./resolveContainerVariants";
export type { ResolvedContainerVariants } from "./resolveContainerVariants";
export {
  matchNestedSelector,
  isSupportedNestedSelector,
} from "./matchNestedSelector";
export type { NestedSelectorChild } from "./matchNestedSelector";

// Token Resolver Utils
export {
  resolveToken,
  resolveColor,
  tokenToCSSVar,
  cssVarToTokenRef,
  resolveBoxShadow,
  hexStringToNumber,
} from "./utils/tokenResolver";

// FontSize resolver
export { resolveSpecFontSize } from "./utils/resolveSpecFontSize";

// ADR-142 #5 — generic shape-descriptor 생성기 (render.shapes 대체)
export { buildCatalogShapes } from "./buildCatalogShapes";

// ADR-142 G2(b) — 컴포넌트 시각 규칙 어댑터 (variant 색상 단일 진입점)
export {
  resolveComponentVisual,
  variantToVisual,
} from "./utils/resolveComponentVisual";
export type { ComponentVisualRule } from "./utils/resolveComponentVisual";

// ADR-142 §3 — 비-DOM-trivial primitive(원/선/아이콘) skiaPrimitive draw module
export {
  getSkiaPrimitive,
  getSkiaPrimitiveMode,
  SKIA_PRIMITIVES,
} from "./skiaPrimitives";
export type { SkiaPrimitiveDrawFn, SkiaPrimitiveMode } from "./skiaPrimitives";
// ADR-142 Inc3 — overlay 패턴 z-order 합성
export { composeCatalogShapes } from "./composeCatalogShapes";
