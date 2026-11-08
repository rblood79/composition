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
export { TAILWIND_PALETTE } from "./generated/tailwindPalette";
// ADR-302 — 테마 색 역할 → (축, 사다리 단) alias 표
export {
  COLOR_ALIASES,
  STATUS_FAMILIES,
  NAMED_HUE_FAMILIES,
  SEMANTIC_CSS_VARS,
} from "./colorAliases";
export type {
  ColorAxis,
  ColorAliasEntry,
  ColorAliasStep,
} from "./colorAliases";
// ADR-302 — Spectrum 색 사다리 primitive (테마 생성 lazy chunk 만 값으로 import — 사용자 결정 8)
export { SPECTRUM_LADDERS } from "./generated/spectrumLadders";
// ADR-302 Phase 3 — 기본 preset 의 두 축 사다리 (DOM `--tint-N` · `--tone-N` seed, initial)
export { SPECTRUM_DEFAULT_LADDERS } from "./generated/spectrumThemeColors";
export type { SpectrumLadderFamily } from "./generated/spectrumLadders";
// Chart 시리즈 팔레트 표 (categorical 리터럴 · accent 명도 사다리)
export {
  CHART_CATEGORICAL_HEX,
  CHART_CATEGORICAL_COUNT,
  CHART_CATEGORICAL_TOKENS,
  CHART_ACCENT_TOKENS,
  chartCategoricalCssVar,
} from "./chartPaletteMap";
export type {
  ChartCategoricalToken,
  ChartAccentToken,
} from "./chartPaletteMap";
export type {
  TailwindPaletteFamily,
  TailwindPaletteStep,
} from "./generated/tailwindPalette";

// Spacing
export {
  spacing,
  S2_SPACING_SCALE,
  getSpacingToken,
  normalizeBreadcrumbRspSizeKey,
} from "./spacing";

// Typography
export {
  DEFAULT_SANS_FAMILY,
  DEFAULT_SANS_STACK,
  SPECTRUM_SANS_FAMILY,
  SPECTRUM_SANS_STACK,
  SPECTRUM_SANS_FONT,
  SPECTRUM_SANS_FONT_CSS,
  cssFontVariations,
  SPECTRUM_SERIF_FAMILY,
  SPECTRUM_SERIF_STACK,
  SPECTRUM_CODE_FAMILY,
  SPECTRUM_CODE_STACK,
  SPECTRUM_FONT_FACES,
  spectrumFontFacesFor,
} from "./spectrumFonts";
export type { SpectrumFontFace } from "./spectrumFonts";
export { spectrumLocaleFont } from "./spectrumLocaleFonts";
export {
  typography,
  fontFamily,
  fontWeight,
  lineHeight,
  getTypographyToken,
  getLabelLineHeight,
  getTextLineHeight,
  getDescriptionLineHeight,
  S2_FONT_SIZE_BASE,
  S2_FONT_RATIO,
  s2FontSize,
  s2LineHeight,
  s2TypographyTokens,
  TYPOGRAPHY_STEPS,
} from "./typography";

// Radius
export { radius, getRadiusToken } from "./radius";

// Device axis (ADR-295 Decision 2)
export {
  S2_DEVICE,
  S2_TOUCH_MEDIA,
  S2_CONTROL_HEIGHT,
  S2_ICON_SIZE,
  S2_CONTROL_HEIGHT_SM,
  S2_FIELD_BUTTON_SIZE,
  S2_BAR_MIN_WIDTH,
  S2_TABLE_SELECTION_COLUMN_WIDTH,
  S2_TOAST_EDGE,
  s2ControlHeights,
  s2SizeTokens,
  size,
} from "./device";
export type { S2Device } from "./device";

// Border width (ADR-227 Phase 3)
export {
  borderWidth,
  DEFAULT_BORDER_WIDTH_TOKEN,
  getBorderWidthToken,
  setBorderSnapRatio,
  snapBorderWidth,
  snapBorderWidthAt,
} from "./border";

// Shadows
export {
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
  parsePxOnlyValue,
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
