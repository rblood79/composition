/** Catalog와 renderer가 공유하는 실행 기능. 컴포넌트 spec registry는 포함하지 않는다. */
export type {
  ComponentSpec,
  ComponentState,
  VariantSpec,
  FillStateTokens,
  FillTokenSpec,
  SizeSpec,
  RenderSpec,
  ContainerVariantStyles,
  PropertySchema,
  SectionDef,
  FieldDef,
  BaseFieldDef,
  VisibilityCondition,
  VariantField,
  SizeField,
  BooleanField,
  EnumField,
  StringField,
  NumberField,
  IconField,
  CustomField,
  ChildrenManagerField,
  DerivedUpdateFn,
  CustomFieldComponentProps,
  PropagationRule,
  PropagationSpec,
  Shape,
  ShapeBase,
  RectShape,
  RoundRectShape,
  CircleShape,
  TextShape,
  ShadowShape,
  BorderShape,
  BorderStyleValue,
  ContainerShape,
  ContainerLayout,
  GradientShape,
  ImageShape,
  LineShape,
  IconFontShape,
  ColorValue,
  TokenRef,
  ColorTokenRef,
  SpacingTokenRef,
  TypographyTokenRef,
  RadiusTokenRef,
  ShadowTokenRef,
  StrictTokenRef,
  TokenCategories,
  ColorTokens,
  SpacingTokens,
  TypographyTokens,
  RadiusTokens,
  ShadowTokens,
  BorderWidthTokens,
  BorderWidthTokenRef,
  StateStyles,
  StateEffect,
  StoredMenuItem,
  StoredMenuSection,
  StoredMenuSeparator,
  StoredMenuEntry,
  RuntimeMenuItem,
  ItemsManagerField,
  ItemsManagerFieldItemSchema,
  StoredSelectItem,
  StoredComboBoxItem,
  StoredListBoxItem,
  StoredListBoxSection,
  StoredListBoxEntry,
  RuntimeListBoxItem,
  StoredTagItem,
  RuntimeTagItem,
  StoredBreadcrumbItem,
  RuntimeBreadcrumbItem,
  StoredGridListItem,
  StoredGridListSection,
  StoredGridListEntry,
  RuntimeGridListItem,
} from "./types";

export {
  toRuntimeListBoxItem,
  isListBoxSectionEntry,
} from "./types/listbox-items";

export { toRuntimeTagItem } from "./types/taggroup-items";

export {
  toRuntimeGridListItem,
  isGridListSectionEntry,
} from "./types/gridlist-items";

export { isMenuSectionEntry, isMenuSeparatorEntry } from "./types/menu-items";

export { isValidTokenRef } from "./types";

export {
  getIconData,
  LUCIDE_ICON_NAMES,
  LUCIDE_ALIASES,
} from "./icons/lucideIcons";
export type { LucideIconData } from "./icons/lucideIcons";

export { resolveStateColors } from "./utils/stateEffect";

export { resolveFillTokens, resolveIndicatorFill } from "./utils/fillTokens";

export { racStateAttrs, type RacStateInput } from "./utils/racStateAttrs";

export {
  setSpecWrappedTextHeightMeasurer,
  measureSpecWrappedTextHeight,
  type SpecWrappedTextHeightMeasurer,
} from "./renderers/utils/measureText";

export {
  lightColors,
  TAILWIND_PALETTE,
  SEMANTIC_PALETTE_MAP,
  resolveSemanticHex,
  resolveSemanticColors,
  CHART_CATEGORICAL_HEX,
  CHART_CATEGORICAL_COUNT,
  CHART_CATEGORICAL_TOKENS,
  CHART_ACCENT_STEPS,
  CHART_ACCENT_TOKENS,
  CHART_ACCENT_DEFAULT_HEX,
  chartCategoricalCssVar,
  resolveChartPaletteColors,
  darkColors,
  getColorToken,
  getColorTokens,
  spacing,
  getSpacingToken,
  normalizeBreadcrumbRspSizeKey,
  typography,
  fontFamily,
  fontWeight,
  lineHeight,
  getTypographyToken,
  getLabelLineHeight,
  getTextLineHeight,
  getDescriptionLineHeight,
  radius,
  getRadiusToken,
  borderWidth,
  DEFAULT_BORDER_WIDTH_TOKEN,
  getBorderWidthToken,
  lightShadows,
  darkShadows,
  getShadowToken,
  parseShadow,
  mapShadowLayers,
  stripShadowInset,
  applyShadowInset,
  matchShadowPreset,
  normalizeShadowForTheme,
  shadowLiteralToCssVar,
  FONT_STRETCH_KEYWORD_MAP,
  HTML_PRIMITIVE_DEFAULT_WIDTHS,
  HTML_PRIMITIVE_DEFAULT_HEIGHTS,
  parsePxValue,
  parsePxOnlyValue,
  parsePadding4Way,
  parseBorderWidth,
  parseGapValue,
  resolveContainerSpacing,
} from "./primitives";

export type { ParsedShadow, ShadowPresetKey } from "./primitives";
export type { TailwindPaletteFamily, TailwindPaletteStep } from "./primitives";
export type {
  SemanticPaletteToken,
  SemanticPaletteEntry,
  PaletteRef,
} from "./primitives";
export type {
  ContainerSpacing,
  ContainerSpacingDefaults,
  ContainerSpacingInput,
} from "./primitives";

export {
  getVariantColors,
  getSizePreset,
  generateCSS,
  resolveContainerVariants,
  matchNestedSelector,
  isSupportedNestedSelector,
  resolveToken,
  resolveBorderWidthPx,
  borderWidthToCSS,
  resolveColor,
  tokenToCSSVar,
  cssVarToTokenRef,
  resolveBoxShadow,
  hexStringToNumber,
  resolveSpecFontSize,
  buildCatalogShapes,
  resolveLeadingSlot,
  resolveTextSourceKey,
  resolveTextSourceText,
  textFromValue,
  textSourceOrder,
  canMaterializeSkiaPresentationFill,
  getSkiaPrimitive,
  getSkiaPrimitiveMode,
  SKIA_PRIMITIVES,
  composeCatalogShapes,
  ARCHETYPE_BASE_STYLES,
} from "./renderers";
export type { SkiaPresentationMaterializationContext } from "./renderers";
export type { TextSourceKey } from "./renderers";

export type {
  ResolvedContainerVariants,
  NestedSelectorChild,
} from "./renderers";
export type { SkiaPrimitiveDrawFn } from "./renderers";
export type { ComponentVisualRule } from "./renderers";
export type { CatalogResolvedPaint } from "./renderers";

export { LAYOUT_TOKEN_STYLES, layoutTokenToCssLines } from "./renderers";
export type { LayoutToken } from "./renderers";

export {
  ILLUSTRATED_MESSAGE_BOX,
  resolveIllustratedMessageMetric,
  resolveIllustratedMessageText,
} from "./renderers/utils/illustratedMessageMetrics";
export type {
  IllustratedMessageMetric,
  IllustratedMessageSizeLike,
} from "./renderers/utils/illustratedMessageMetrics";

export { resolveListBoxSpacingMetric } from "./renderers/utils/collectionItemMetrics";
export type {
  ListBoxSpacingInput,
  ListBoxSpacingMetric,
} from "./renderers/utils/collectionItemMetrics";

export {
  resolveListBoxItemMetric,
  resolveListBoxItemRowHeight,
} from "./renderers/utils/collectionItemMetrics";

export { resolveCollectionRowMetric } from "./renderers/utils/collectionItemMetrics";
export type {
  CollectionRowMetric,
  CollectionRowMetricInput,
  CollectionRowMetricEntry,
  CollectionRowSlotBlock,
  CollectionRowSlotRole,
} from "./renderers/utils/collectionItemMetrics";

export { resolveListBoxItemInset } from "./renderers/utils/collectionItemMetrics";
export type {
  ListBoxItemInsetInput,
  CollectionRowInset,
} from "./renderers/utils/collectionItemMetrics";

export {
  resolveGridListItemMetric,
  resolveGridListSpacingMetric,
  COLLECTION_TEXT_DEFAULT_FONT_SIZE,
} from "./renderers/utils/collectionItemMetrics";
export type {
  GridListSpacingMetric,
  GridListSpacingInput,
} from "./renderers/utils/collectionItemMetrics";

export {
  buildDateInputDisplayText,
  buildDatePickerShapes,
  buildDatePlaceholder,
  DATE_PICKER_INPUT_HEIGHT,
  DATE_PICKER_INPUT_PADDING,
  DATE_PICKER_BORDER_RADIUS,
  DATE_PICKER_ICON_SIZE,
  DATE_PICKER_SIZES,
  DATE_PICKER_STATES,
} from "./renderers/datePickerShapes";
export type { DatePickerShapesInput } from "./renderers/datePickerShapes";

export * from "./chart";

export * from "./data/fieldIdIndex";

// `variables: "auto"` delegation variables (ADR-059 v2): the generator's derivation, also read by
// the catalog part rules (ADR-253 — a side label field's hint indent reads `--{prefix}-gap`).
export { deriveAutoDelegationVariables } from "./runtime/deriveAutoDelegationVariables";
