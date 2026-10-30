/**
 * Renderers - Public API
 *
 * CSS Generator + Skia shape/token resolver (ADR-912 단계5 — ReactRenderer orphan 제거)
 *
 * @packageDocumentation
 */

// Variant/Size resolvers (Skia/Canvas 공용)
export { getVariantColors, getSizePreset } from "./utils/variantColors";

// CSS Generator
export {
  generateCSS,
  CATALOG_TOKEN_VAR_PREFIX,
  catalogTokenVarName,
  withCatalogTokenVars,
} from "./CSSGenerator";
export { s2ControlPaddingY } from "./utils/controlPadding";
export {
  ofHeight,
  centerPadding,
  em,
  ruleLengthRef,
  parseRuleLengthRef,
  parseRuleLengthTerms,
  ruleLengthPx,
  ruleLengthCss,
  ruleSizeLengthRef,
  ruleSizeLengthRefs,
  defineRuleLengthForms,
  DEVICE_TOUCH_REF,
} from "./utils/ruleLength";
export type { RuleLengthForm } from "./utils/ruleLength";
// ADR-248 Phase 3: archetype base CSS (root + child selectors) — the typed part-rule compiler
//   reads the same declarations the generator emits.
export { ARCHETYPE_BASE_STYLES } from "./CSSGenerator";

// ADR-912 Δ7: layout token table 단일 source (CSSGenerator + shared resolver 공용)
export { LAYOUT_TOKEN_STYLES, layoutTokenToCssLines } from "./layoutTokens";
export type { LayoutToken } from "./layoutTokens";

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
  resolveBorderWidthPx,
  borderWidthToCSS,
  resolveColor,
  tokenToCSSVar,
  tokenToCSSLength,
  ICON_SIZE_TOKEN_REF,
  colorTokenCssValue,
  colorTokenCssNames,
  cssVarToTokenRef,
  resolveBoxShadow,
  hexStringToNumber,
} from "./utils/tokenResolver";

// FontSize resolver
export { resolveSpecFontSize } from "./utils/resolveSpecFontSize";

// ADR-142 #5 — generic shape-descriptor 생성기 (render.shapes 대체)
export { buildCatalogShapes, resolveLeadingSlot } from "./buildCatalogShapes";
// ADR-923 r15m1 — 노드 텍스트 원천 계약 (Preview · Skia · 레이아웃 공용 단일 지점)
export {
  resolveTextSourceKey,
  resolveTextSourceText,
  textFromValue,
  textSourceOrder,
} from "./utils/textSource";
export type { TextSourceKey } from "./utils/textSource";
export type { CatalogResolvedPaint } from "./catalogPaint";

// ADR-912 단계5: ComponentVisualRule 타입만 production 정본으로 re-export.
//   resolveComponentVisual / variantToVisual 함수는 test-only(production 호출 0) → barrel
//   제외. test 는 직접 경로(./utils/resolveComponentVisual)로 import.
export type { ComponentVisualRule } from "./utils/resolveComponentVisual";

// ADR-142 §3 — 비-DOM-trivial primitive(원/선/아이콘) skiaPrimitive draw module
export {
  canMaterializeSkiaPresentationFill,
  getSkiaPrimitive,
  getSkiaPrimitiveMode,
  SKIA_PRIMITIVES,
} from "./skiaPrimitives";
export type {
  SkiaPresentationMaterializationContext,
  SkiaPrimitiveDrawFn,
  SkiaPrimitiveMode,
} from "./skiaPrimitives";
// ADR-142 Inc3 — overlay 패턴 z-order 합성
export { composeCatalogShapes } from "./composeCatalogShapes";
