/**
 * Primitives - Public API
 *
 * 디자인 토큰 (색상, 간격, 타이포그래피, radius, 그림자)
 *
 * @packageDocumentation
 */

// Colors
export {
  lightColors,
  darkColors,
  getColorToken,
  getColorTokens,
} from "./colors";

// Spacing
export {
  spacing,
  getSpacingToken,
  breadcrumbSeparatorAfterPaddingXPx,
  normalizeBreadcrumbRspSizeKey,
} from "./spacing";

// Typography
export {
  typography,
  fontFamily,
  fontWeight,
  lineHeight,
  getTypographyToken,
  getLabelLineHeight,
  getTextLineHeight,
  getDescriptionLineHeight,
} from "./typography";

// Radius
export { radius, getRadiusToken } from "./radius";

// Shadows
export {
  shadows,
  lightShadows,
  darkShadows,
  getShadowToken,
  parseShadow,
} from "./shadows";

export type { ParsedShadow } from "./shadows";

// Shadow 리터럴 ↔ 프리셋 역매핑 (ADR-166 후속) — 패널이 기록한 inline 리터럴을
//   Skia 는 theme 리터럴로, DOM 은 CSS 변수로 되돌린다.
export {
  mapShadowLayers,
  stripShadowInset,
  applyShadowInset,
  matchShadowPreset,
  normalizeShadowForTheme,
  shadowLiteralToCssVar,
} from "./shadowNormalize";

export type { ShadowPresetKey } from "./shadowNormalize";

// Font (CSS 표준 상수 — ADR-091 Phase 1)
export { FONT_STRETCH_KEYWORD_MAP } from "./font";

// HTML primitive defaults (ADR-096 Phase 2)
export {
  HTML_PRIMITIVE_DEFAULT_WIDTHS,
  HTML_PRIMITIVE_DEFAULT_HEIGHTS,
} from "./elementDefaults";

// Button-family height metric (ADR-105-a)
export { BUTTON_FAMILY_HEIGHTS } from "./buttonSizes";

// Field-family size metric (ADR-105-b)
export { FIELD_FAMILY_SIZES } from "./fieldSizes";

// Tab-family size metric (ADR-105-b)
export { TABS_SIZE_CONFIG } from "./tabSizes";

// CSS value parser SSOT (ADR-907 Phase 1 Layer A)
export {
  parsePxValue,
  parsePadding4Way,
  parseBorderWidth,
  parseGapValue,
} from "./cssValueParser";

// Container spacing primitive (ADR-907 Phase 2 Layer B)
export { resolveContainerSpacing } from "./containerSpacing";

export type {
  ContainerSpacing,
  ContainerSpacingDefaults,
  ContainerSpacingInput,
} from "./containerSpacing";
