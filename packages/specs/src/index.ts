/**
 * @composition/specs
 *
 * Component Spec Architecture - Single Source of Truth
 * Builder(WebGL)와 Publish(React)의 100% 시각적 일치 보장
 *
 * @packageDocumentation
 */

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  // Spec Types
  ComponentSpec,
  ComponentState,
  VariantSpec,
  // ADR-908 Phase 1: Fill Spec Schema SSOT (타입만 도입)
  FillStateTokens,
  FillTokenSpec,
  SizeSpec,
  RenderSpec,
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
  // Shape Types
  Shape,
  ShapeBase,
  RectShape,
  RoundRectShape,
  CircleShape,
  TextShape,
  ShadowShape,
  BorderShape,
  ContainerShape,
  ContainerLayout,
  GradientShape,
  ImageShape,
  LineShape,
  IconFontShape,
  ColorValue,
  // Token Types
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
  // State Types
  StateStyles,
  StateEffect,
  // Menu Items Types (ADR-068 + ADR-099 Phase 5)
  StoredMenuItem,
  StoredMenuSection,
  StoredMenuSeparator,
  StoredMenuEntry,
  RuntimeMenuItem,
  // Items Manager Field (ADR-073)
  ItemsManagerField,
  ItemsManagerFieldItemSchema,
  // Select Items Types (ADR-073)
  StoredSelectItem,
  RuntimeSelectItem,
  // ComboBox Items Types (ADR-073)
  StoredComboBoxItem,
  RuntimeComboBoxItem,
  // ListBox Items Types (ADR-076 + ADR-099 Phase 1)
  StoredListBoxItem,
  StoredListBoxSection,
  StoredListBoxEntry,
  RuntimeListBoxItem,
  // TagGroup Items Types (ADR-097)
  StoredTagItem,
  RuntimeTagItem,
  // Breadcrumb Items Types (ADR-912 영역 B (A))
  StoredBreadcrumbItem,
  RuntimeBreadcrumbItem,
  // GridList Items Types (ADR-099 Phase 5)
  StoredGridListItem,
  StoredGridListSection,
  StoredGridListEntry,
  RuntimeGridListItem,
} from "./types";

// ADR-073: Select/ComboBox items runtime converters
export { toRuntimeSelectItem } from "./types/select-items";
export { toRuntimeComboBoxItem } from "./types/combobox-items";

// ADR-076 + ADR-099 Phase 1: ListBox items runtime converter + section guard
export {
  toRuntimeListBoxItem,
  isListBoxSectionEntry,
} from "./types/listbox-items";

// ADR-097: TagGroup items runtime converter
export { toRuntimeTagItem } from "./types/taggroup-items";

// ADR-099 Phase 5: GridList items runtime converter + section guard
export {
  toRuntimeGridListItem,
  isGridListSectionEntry,
} from "./types/gridlist-items";

// ADR-068 + ADR-099 Phase 5: Menu section/separator guards
export { isMenuSectionEntry, isMenuSeparatorEntry } from "./types/menu-items";

export { isValidTokenRef } from "./types";

// ─── Icons ──────────────────────────────────────────────────────────────────
export {
  getIconData,
  LUCIDE_ICON_NAMES,
  LUCIDE_ALIASES,
} from "./icons/lucideIcons";
export type { LucideIconData } from "./icons/lucideIcons";

// ─── Utils ──────────────────────────────────────────────────────────────────
export { resolveStateColors } from "./utils/stateEffect";
// ADR-908 Phase 4: Fill token SSOT accessor (legacy seam 제거)
export { resolveFillTokens, resolveIndicatorFill } from "./utils/fillTokens";
// ADR-912 단계 3: RAC data-* → ComponentState derive (Skia state parity)
export { racStateAttrs, type RacStateInput } from "./utils/racStateAttrs";

// ─── Primitives ──────────────────────────────────────────────────────────────
export {
  // Colors
  lightColors,
  darkColors,
  getColorToken,
  getColorTokens,
  // Spacing
  spacing,
  getSpacingToken,
  breadcrumbSeparatorAfterPaddingXPx,
  normalizeBreadcrumbRspSizeKey,
  // Typography
  typography,
  fontFamily,
  fontWeight,
  lineHeight,
  getTypographyToken,
  getLabelLineHeight,
  // Radius
  radius,
  getRadiusToken,
  // Shadows
  shadows,
  getShadowToken,
  parseShadow,
  // Font (CSS 표준 상수 — ADR-091 Phase 1)
  FONT_STRETCH_KEYWORD_MAP,
  // HTML primitive defaults (ADR-096 Phase 2)
  HTML_PRIMITIVE_DEFAULT_WIDTHS,
  HTML_PRIMITIVE_DEFAULT_HEIGHTS,
  // CSS value parser SSOT (ADR-907 Layer A)
  parsePxValue,
  parsePadding4Way,
  parseBorderWidth,
  parseGapValue,
  // Container spacing primitive (ADR-907 Layer B)
  resolveContainerSpacing,
} from "./primitives";

export type { ParsedShadow } from "./primitives";
export type {
  ContainerSpacing,
  ContainerSpacingDefaults,
  ContainerSpacingInput,
} from "./primitives";

// ─── Renderers ───────────────────────────────────────────────────────────────
export {
  // React Renderer
  renderToReact,
  generateCSSVariables,
  generateSizeVariables,
  // Variant/Size resolvers (Skia/Canvas 공용)
  getVariantColors,
  getSizePreset,
  // CSS Generator
  generateCSS,
  generateAllCSS,
  // ADR-108 P1: containerVariants 런타임 helper
  resolveContainerVariants,
  matchNestedSelector,
  isSupportedNestedSelector,
  // Token Resolver
  resolveToken,
  resolveColor,
  tokenToCSSVar,
  cssVarToTokenRef,
  resolveBoxShadow,
  hexStringToNumber,
  // FontSize resolver
  resolveSpecFontSize,
  // ADR-142 #5 — generic shape-descriptor 생성기
  buildCatalogShapes,
  // ADR-142 G2(b) — 컴포넌트 시각 규칙 어댑터
  resolveComponentVisual,
  variantToVisual,
  // ADR-142 §3 — skiaPrimitive draw module (원/선/아이콘 등 비-trivial)
  getSkiaPrimitive,
  getSkiaPrimitiveMode,
  SKIA_PRIMITIVES,
  // ADR-142 Inc3 — overlay 패턴 z-order 합성
  composeCatalogShapes,
} from "./renderers";

export type { ReactRenderResult } from "./renderers";
export type {
  ResolvedContainerVariants,
  NestedSelectorChild,
} from "./renderers";
export type { SkiaPrimitiveDrawFn } from "./renderers";
export type { ComponentVisualRule } from "./renderers";

// ─── Components ──────────────────────────────────────────────────────────────

// ADR-912 R6 (2026-06-15): Card 본체 S2 재설계 catalog cutover → CardSpec/CardProps export 제거.
//   시각 = COMPONENT_RULES_TABLE.Card(variants 4종 fill) + buildCatalogShapes shell. propagation
//   규칙은 propagationRegistry.ts 인라인 보존. CardHeader/CardContent/CardFooter/CardPreview 자식 4도
//   childSpec→catalog cutover(2026-06-15) — FormField/DialogFooter 동형.

export { DialogSpec } from "./components/Dialog.spec";
export type { DialogProps } from "./components/Dialog.spec";

// DialogFooter — ADR-912 childSpec→catalog cutover (2026-06-15): barrel export 제거
//   (spec 삭제 — catalog rule + buildCatalogShapes generic 으로 시각 이전). 사용자 명시 삭제 승인.

// Link (box+text leaf) — ADR-912 단계5 step5: barrel export 제거 (spec 삭제 — catalog rule 발효)

export { PopoverSpec } from "./components/Popover.spec";
export type { PopoverProps } from "./components/Popover.spec";

// ADR-902 후속: Body 는 페이지 루트 theme-aware 배경을 Spec SSOT 로 선언.
export { BodySpec } from "./components/Body.spec";
export type { BodyProps } from "./components/Body.spec";

// ADR-912 단계5 step4 type-augment 그룹 (2026-06-16): ToggleButtonGroupSpec/Props export 제거 —
//   catalog cutover spec 삭제. 시각 = componentRulesTable + generate-css virtual(STRUCTURE_META indicatorMode/
//   delegation carry). Skia = catalog generic(buildSpecNodeData isCatalogSkiaCutover 게이트).

// ADR-912 단계5 step4 Tooltip 단건 (2026-06-16): TooltipSpec/TOOLTIP_MAX_WIDTH/TooltipProps export
//   제거 — catalog cutover, spec 삭제. 시각 SSOT = componentRulesTable.Tooltip + STRUCTURE_META virtual
//   override(generate-css). TOOLTIP_MAX_WIDTH(arrow maxWidth)는 skiaPrimitives.ts 내부로 인라인 이관.
//   TooltipProps 외부 소비 0건(builder factory 는 자체 TooltipElementProps 사용).

// ─── Phase 2: Form Components ───────────────────────────────────────────────

// Checkbox/Radio/Switch — ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): catalog cutover
//   (FAMILY_3) → spec 삭제. 시각 = componentRulesTable + generate-css virtual override(STRUCTURE_META
//   archetype "toggle-indicator"). indicator(track/thumb/box/dot)는 skiaPrimitive draw module
//   (spec-free, visual rule 주입) / DOM React 직접. CHECKBOX_CHECKED_COLORS/RADIO_SELECTED_COLORS/
//   SWITCH_SELECTED_TRACK_COLORS 상수는 ADR-142 B2 에서 이미 코드 사용 0(rule fill 흡수) → 함께 제거.

// CheckboxItemsSpec — ADR-912 (2026-06-14): 중간 컨테이너 폐기, spec 삭제.

// RadioItemsSpec — ADR-912 (2026-06-14): 중간 컨테이너 폐기, spec 삭제.

// ADR-912 childSpec→catalog cutover (2026-06-15): FormFieldSpec 삭제 — catalog 등록(FAMILY_2)으로
//   Skia/Taffy/DOM 시각을 rule + buildCatalogShapes generic 으로 이전. DialogFooter 동형.

export { SelectSpec } from "./components/Select.spec";
export type { SelectProps } from "./components/Select.spec";

export { ComboBoxSpec } from "./components/ComboBox.spec";
export type { ComboBoxProps } from "./components/ComboBox.spec";

export {
  ListBoxSpec,
  resolveListBoxSpacingMetric,
} from "./components/ListBox.spec";
export type {
  ListBoxProps,
  ListBoxSpacingInput,
  ListBoxSpacingMetric,
} from "./components/ListBox.spec";

// ListBoxItem — ADR-912 (2026-06-14): spec 물리 삭제(catalog cutover). metric resolver 만 유지.
export {
  resolveListBoxItemMetric,
  resolveListBoxItemRowHeight,
} from "./renderers/utils/collectionItemMetrics";

// Header (ADR-099 Phase 3 — section 헤더, CSS 자동 생성 전용, Builder Skia 미등록)
export { HeaderSpec } from "./components/Header.spec";
export type { HeaderProps } from "./components/Header.spec";

export { SliderSpec, SLIDER_FILL_COLORS } from "./components/Slider.spec";
export type { SliderProps } from "./components/Slider.spec";

export {
  MeterSpec,
  METER_FILL_COLORS,
  METER_DIMENSIONS,
} from "./components/Meter.spec";
export type { MeterProps } from "./components/Meter.spec";

// ADR-912 단계5 value-fill-track: MeterTrackSpec 삭제 — catalog 발효(value_fill_bar escape)
//   + generate-css virtual(archetype:progress) + layout 로컬 미러(VALUE_FILL_TRACK_HEIGHT) 로 대체.

// ADR-912 value-label (2026-06-11): MeterValueSpec 삭제 — catalog 발효(buildCatalogShapes text)
//   + generate-css virtual(archetype:progress) + specTextStyle catalogType 측정으로 대체.

export {
  ProgressBarSpec,
  PROGRESSBAR_FILL_COLORS,
  PROGRESSBAR_DIMENSIONS,
} from "./components/ProgressBar.spec";
export type { ProgressBarProps } from "./components/ProgressBar.spec";

// ADR-912 단계5 value-fill-track: ProgressBarTrackSpec 삭제 — catalog 발효(value_fill_bar escape)
//   + generate-css virtual(archetype:progress) + layout 로컬 미러(PROGRESSBARTRACK_HEIGHT) 로 대체.
// ADR-912 value-label (2026-06-11): ProgressBarValueSpec 삭제 — MeterValue 동형.

// ─── Phase 3: Composite Components ──────────────────────────────────────────
// ADR-912 단계5 step4 trivial 그룹 (2026-06-16): Table/Tree.spec 물리 삭제 — catalog cutover
//   (FAMILY_5 발효 + tree/table DELEGATING 등록). skipCSSGeneration:true → generated CSS 없음
//   (virtual override 불요). render.shapes box-only generic 대체, layout consumer 0, 외부 type
//   import 0 (TableProps/TableColumn/TableRow 는 shared Table.tsx 자체 정의 + resolveCollectionItems
//   TableColumnDef 자체 정의 — spec type 미참조). TableRow/TableCell.spec 은 이미 삭제됨(2026-06-14).
// TreeItemSpec/TreeItemProps — ADR-912 R1 후속 (2026-06-12): catalog cutover, spec 삭제

export { TabsSpec } from "./components/Tabs.spec";
export type { TabsProps, TabItem } from "./components/Tabs.spec";
// ADR-912 projection 3 cutover (2026-06-15): TabListSpec/TabSpec/TabListProps/TabProps export 제거
//   — catalog cutover, spec 삭제. 시각 SSOT = componentRulesTable + tablist_divider/tab_indicator escape.

export { MenuSpec } from "./components/Menu.spec";
export type { MenuProps } from "./components/Menu.spec";

export { BreadcrumbsSpec } from "./components/Breadcrumbs.spec";
export type { BreadcrumbsProps } from "./components/Breadcrumbs.spec";
// ADR-912 projection 3 cutover (2026-06-15): BreadcrumbSpec/BreadcrumbItemProps export 제거 —
//   catalog cutover, spec 삭제. 시각 SSOT = componentRulesTable + breadcrumb_crumb escape.

// ADR-912 R7 G1-c (2026-06-15): PaginationSpec/PaginationProps export 제거 — catalog cutover.
//   시각 SSOT = COMPONENT_RULES_TABLE.Pagination + generate-css virtual. binding.accepts D2.

export { TagGroupSpec } from "./components/TagGroup.spec";
export type { TagGroupProps } from "./components/TagGroup.spec";

// ADR-912 collection sub-part cutover (2026-06-15): TagListSpec / TAG_CHIP_SIZES /
//   TagListProps export 제거 — TagList.spec.ts 물리 삭제(catalog cutover 완료).
//   chip 치수는 Tag/TagList catalog rule, layout 은 implicitStyles 자족화로 이관됨.

export { TagSpec } from "./components/Tag.spec";
export type { TagProps as TagSpecProps } from "./components/Tag.spec";

export {
  GridListSpec,
  resolveGridListSpacingMetric,
} from "./components/GridList.spec";
export type {
  GridListProps,
  GridListSpacingMetric,
  GridListSpacingInput,
} from "./components/GridList.spec";

// ADR-912 (2026-06-14): GridListItem.spec 물리 삭제(catalog cutover). metric resolver 만 유지.
export { resolveGridListItemMetric } from "./renderers/utils/collectionItemMetrics";

// ADR-912 Disclosure 군 일괄 cutover (2026-06-10) — Disclosure/DisclosureGroup spec 삭제.
//   시각 SSOT = componentRulesTable catalog rule.

// ADR-912 R7 G1-c (2026-06-15): ToastSpec/ToastProps export 제거 — 순수 box-shell catalog cutover.
//   시각 SSOT = COMPONENT_RULES_TABLE.Toast + generate-css virtual(archetype alert). 좌측 accent bar
//   는 RAC 공식 미준수 변형이라 제거. binding.accepts D2(variant/size/defaultTitle/...).

export { GroupSpec } from "./components/Group.spec";
export type { GroupProps } from "./components/Group.spec";

// Frame — ADR-130: canonical layout container
export { FrameSpec } from "./components/Frame.spec";
export type { FrameProps } from "./components/Frame.spec";

export { SlotSpec } from "./components/Slot.spec";
export type { SlotProps } from "./components/Slot.spec";

// ADR-912 단계5 step4 Phase 1 batch 2 (2026-06-16): DropZoneSpec 삭제 — catalog cutover.
//   시각 SSOT = COMPONENT_RULES_TABLE.DropZone (variant fill + sizes paddingX/paddingY/gap) +
//   generate-css virtual override. D2 = DropZone.binding.accepts. Skia = generic box(spec-free).

// ─── Phase 4: Special Components ────────────────────────────────────────────
export {
  DatePickerSpec,
  buildDatePickerShapes,
  buildDatePlaceholder,
  DATE_PICKER_INPUT_HEIGHT,
  DATE_PICKER_INPUT_PADDING,
  DATE_PICKER_BORDER_RADIUS,
  DATE_PICKER_ICON_SIZE,
  DATE_PICKER_SIZES,
  DATE_PICKER_STATES,
} from "./components/DatePicker.spec";
export type {
  DatePickerProps,
  DatePickerShapesInput,
} from "./components/DatePicker.spec";

export { DateRangePickerSpec } from "./components/DateRangePicker.spec";
export type { DateRangePickerProps } from "./components/DateRangePicker.spec";

export { DateFieldSpec } from "./components/DateField.spec";
export type { DateFieldProps } from "./components/DateField.spec";

export { DateInputSpec } from "./components/DateInput.spec";
export type { DateInputProps } from "./components/DateInput.spec";

export { CalendarSpec } from "./components/Calendar.spec";
export type { CalendarProps } from "./components/Calendar.spec";

// ADR-912 단계5 step4 small 그룹 (2026-06-16): CalendarHeader/CalendarGrid.spec 물리 삭제 —
//   catalog cutover. skipCSSGeneration:true → generated CSS 없음(virtual override 불요). Skia 는
//   inline_icon_text / calendar_grid_only replace primitive(spec-free)가 대체. layout consumer 0
//   (utils.ts CalendarHeader height 분기는 rule 인라인 미러로 이미 전환). binding.accepts D2.

export { RangeCalendarSpec } from "./components/RangeCalendar.spec";
export type { RangeCalendarProps } from "./components/RangeCalendar.spec";

export { ColorPickerSpec } from "./components/ColorPicker.spec";
export type { ColorPickerProps } from "./components/ColorPicker.spec";

// ADR-912 6 registry collapse — Color leaf 5종 box-only cutover (2026-06-11):
//   ColorSlider/ColorArea/ColorWheel/ColorSwatch/TailSwatch spec 삭제. ColorSwatchPicker(container) 보존.

export { ColorSwatchPickerSpec } from "./components/ColorSwatchPicker.spec";
export type { ColorSwatchPickerProps } from "./components/ColorSwatchPicker.spec";

export { InputSpec } from "./components/Input.spec";
export type { InputProps } from "./components/Input.spec";

// ADR-912 Switcher cleanup — SwitcherSpec 제거 (RAC ToggleButtonGroup 으로 대체).

// ─── Phase 5: Child Composition Specs (Compositional 전환) ─────────────────

// FieldError/Description (box+text leaf) — ADR-912 단계5 step5: barrel export 제거 (spec 삭제 — catalog rule 발효)
// Heading/Paragraph/Kbd/Code (TEXT_LEAF) — ADR-912 단계5 step4: barrel export 제거 (spec 삭제 대상)

// ADR-912 Disclosure 군 일괄 cutover (2026-06-10) — DisclosureHeaderSpec 삭제. 시각 SSOT = componentRulesTable.DisclosureHeader.

// ADR-912 단계5 — DisclosureContentSpec 삭제 (catalog cutover 완결, Description 동형).
//   시각 SSOT = componentRulesTable.DisclosureContent (catalog rule).

// ADR-912 단계5 value-fill-track: SliderTrackSpec 삭제 — catalog 발효(slider_fill_bar escape)
//   + generate-css virtual(archetype:slider) + 부모 Slider.spec.indicator 기반 size metric 으로 대체.

// ADR-912 catalog cutover (2026-06-16): SliderThumbSpec 삭제 — catalog 등록(slider_thumb escape, replace)
//   + rule SliderThumb.sizes(14/18/22/26 Slider.indicator.thumbSize SSOT 미러)로 대체. DOM 은 RAC Slider
//   self-compose(DELEGATING_RAC_RENDERERS → 자식 재귀 skip, DOM no-op).

// ADR-912 value-label (2026-06-11): SliderOutputSpec 삭제 — catalog 발효(buildCatalogShapes text)
//   + generate-css virtual(archetype:simple) + specTextStyle catalogType 측정으로 대체.

// ADR-912 R1 (2026-06-12): SelectTriggerSpec/SelectValueSpec/SelectIconSpec 삭제 —
//   catalog cutover (rule table + buildCatalogShapes generic + icon_font escape).

// ─── Phase 6: ADR-030 New Components ────────────────────────────────────────
// ADR-912 단계5 step4 Phase 1 batch 1 (2026-06-16): AvatarSpec 삭제 — catalog cutover.
//   시각 SSOT = COMPONENT_RULES_TABLE.Avatar (variant fill + sizes) + generate-css virtual
//   (archetype:simple). Skia = skiaPrimitives.ts avatar primitive(replace). D2 = binding.accepts.

// ADR-912 R7 G1-a (2026-06-15): AvatarGroupSpec 삭제 — catalog cutover. 시각 SSOT =
//   COMPONENT_RULES_TABLE.AvatarGroup, D2 properties = binding.accepts(AvatarGroup.binding.ts).

export { InlineAlertSpec } from "./components/InlineAlert.spec";
export type { InlineAlertProps } from "./components/InlineAlert.spec";

// ─── Phase 6: ADR-030 Phase 2 Components ────────────────────────────────────
// ADR-912 R7 G1-c (2026-06-15): ButtonGroupSpec/ButtonGroupProps 삭제 — catalog cutover. 시각 SSOT =
//   COMPONENT_RULES_TABLE.ButtonGroup + generate-css virtual, D2 properties = binding.accepts. layout
//   (flex/gap)은 factory props.style SSOT. factory 자식 Button×2 자동생성 → box-shell(Pagination 동형).

// ─── Phase 7: ADR-030 Phase 3 Extended Controls ─────────────────────────────
// ADR-912 단계5: ProgressCircleSpec/PROGRESSCIRCLE_* 삭제 — catalog cutover(value_fill_arc) +
//   generate-css virtual 일반화(archetype:progress). diameter 는 layout 인라인 미러로 이관.

export { ImageSpec, IMAGE_DIMENSIONS } from "./components/Image.spec";
export type { ImageProps } from "./components/Image.spec";

// ─── Phase 8: ADR-030 Phase 4 Advanced Components ────────────────────────────
// ADR-912 단계5 step4 type-augment 그룹 (2026-06-16): IllustratedMessageSpec/Props +
//   ILLUSTRATION_DIMENSIONS export 제거 — catalog cutover spec 삭제. 시각 = componentRulesTable +
//   generate-css virtual(STRUCTURE_META alert archetype + headingFontSize rule 보강). Skia =
//   skiaPrimitive illustrated_message escape(자체 ILLUSTRATION_ESCAPE_DIMS, spec 의존 0).

// ADR-912 R7 G1-b (2026-06-15): CardViewSpec/CARDVIEW_DENSITY_GAP + TableViewSpec/
//   TABLEVIEW_ROW_HEIGHTS 삭제 — catalog cutover. 시각 SSOT = COMPONENT_RULES_TABLE.{CardView,
//   TableView}, D2 properties = binding.accepts. CARDVIEW_DENSITY_GAP/TABLEVIEW_ROW_HEIGHTS 는
//   spec 외 consumer 0(grep 실측) → 동시 삭제. CardView gap/TableView 행높이는 factory props.style.

// Properties-only Specs
// ADR-912 단계5 step4 trivial 그룹 (2026-06-16): FieldSpec 물리 삭제 — catalog cutover.
//   skipCSSGeneration:true + render.shapes=()=>[] (Skia 0 shape) + 외부 consumer 0. binding.accepts D2.
// ADR-912 단계5 step4 small-B (2026-06-16): ModalSpec export 제거 — catalog cutover, STRUCTURE_META
//   virtual override 가 CSS 생성(diff 0). binding.accepts D2 / Skia generic box.
// ADR-912 6 registry collapse — TailSwatchSpec 삭제 (color leaf box-only cutover, 2026-06-11).

// ─── Runtime (ADR-058 Pre-Phase 0 + Phase 1) ───────────────────────────────
// ─── Registry SSOT (ADR-108 P0) ──────────────────────────────────────────────
export {
  getElementForTag,
  hasSpec,
  getDefaultSizeForTag,
  BASE_TAG_SPEC_MAP,
  TAG_SPEC_MAP,
  LOWERCASE_TAG_SPEC_MAP,
  expandChildSpecs,
} from "./runtime/tagToElement";
export { resolveContainerStylesFallback } from "./runtime/containerStylesFallback";
