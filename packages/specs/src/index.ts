/**
 * @composition/specs
 *
 * Component Spec Architecture - Single Source of Truth
 * Builder(Skia Canvas)와 Publish(React)의 100% 시각적 일치 보장
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
  // Shape Types
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
  // ComboBox Items Types (ADR-073)
  StoredComboBoxItem,
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
// 2026-07-22: wrap 블록 높이 측정기 주입 hook — builder 가 paint 동일 엔진
//   (measureWrappedTextHeight, CanvasKit-backed)을 주입해 escape(listbox_item)의
//   stacked slot offset 이 멀티라인 wrap 과 정합. 미주입 시 단일 줄 fallback(BC).
export {
  setSpecWrappedTextHeightMeasurer,
  measureSpecWrappedTextHeight,
  type SpecWrappedTextHeightMeasurer,
} from "./renderers/utils/measureText";

// ─── Primitives ──────────────────────────────────────────────────────────────
export {
  // Colors
  lightColors,
  TAILWIND_PALETTE,
  SEMANTIC_PALETTE_MAP,
  resolveSemanticHex,
  resolveSemanticColors,
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
  getTextLineHeight,
  getDescriptionLineHeight,
  // Radius
  radius,
  getRadiusToken,
  // Shadows — light 별칭 `shadows` 는 제거됨 (2026-07-25). light 값이 필요하면 `lightShadows`
  //   를 명시하고, theme 을 따라야 하면 `getShadowToken(name, theme)` 을 쓴다
  lightShadows,
  darkShadows,
  getShadowToken,
  parseShadow,
  // Shadow 리터럴 ↔ 프리셋 역매핑 (ADR-166 후속) — 패널이 기록한 inline 리터럴의 theme 추종
  mapShadowLayers,
  stripShadowInset,
  applyShadowInset,
  matchShadowPreset,
  normalizeShadowForTheme,
  shadowLiteralToCssVar,
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

// ─── Renderers ───────────────────────────────────────────────────────────────
export {
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
  // ADR-912 단계5: resolveComponentVisual / variantToVisual 함수는 test-only(production 호출 0) →
  //   barrel 제외. ComponentVisualRule 타입만 정본 re-export(아래 export type).
  // ADR-142 §3 — skiaPrimitive draw module (원/선/아이콘 등 비-trivial)
  canMaterializeSkiaPresentationFill,
  getSkiaPrimitive,
  getSkiaPrimitiveMode,
  SKIA_PRIMITIVES,
  // ADR-142 Inc3 — overlay 패턴 z-order 합성
  composeCatalogShapes,
} from "./renderers";
export type { SkiaPresentationMaterializationContext } from "./renderers";

export type {
  ResolvedContainerVariants,
  NestedSelectorChild,
} from "./renderers";
export type { SkiaPrimitiveDrawFn } from "./renderers";
export type { ComponentVisualRule } from "./renderers";
export type { CatalogResolvedPaint } from "./renderers";

// ADR-912 Δ7: layout token table 단일 source (shared resolver 가 import)
export { LAYOUT_TOKEN_STYLES, layoutTokenToCssLines } from "./renderers";
export type { LayoutToken } from "./renderers";

// ─── Components ──────────────────────────────────────────────────────────────

// ADR-912 R6 (2026-06-15): Card 본체 S2 재설계 catalog cutover → CardSpec/CardProps export 제거.
//   시각 = COMPONENT_RULES_TABLE.Card(variants 4종 fill) + buildCatalogShapes shell. propagation
//   규칙은 propagationRegistry.ts 인라인 보존. CardHeader/CardContent/CardFooter/CardPreview 자식 4도
//   childSpec→catalog cutover(2026-06-15) — FormField/DialogFooter 동형.

// ADR-912 단계5 step4 Dialog 단건 (2026-06-16): DialogSpec/DialogProps export 제거 — catalog cutover,
//   spec 삭제. 시각 SSOT = componentRulesTable.Dialog + STRUCTURE_META virtual override(archetype
//   overlay, Modal 동형). backdrop/shadow 는 skiaPrimitive escape. DialogProps 외부 소비 0.

// DialogFooter — ADR-912 childSpec→catalog cutover (2026-06-15): barrel export 제거
//   (spec 삭제 — catalog rule + buildCatalogShapes generic 으로 시각 이전). 사용자 명시 삭제 승인.

// Link (box+text leaf) — ADR-912 단계5 step5: barrel export 제거 (spec 삭제 — catalog rule 발효)

// Popover (overlay archetype) — ADR-912 단계5 step4 Popover 단건 (2026-06-16): barrel export 제거
//   (spec 삭제 — catalog rule + generate-css STRUCTURE_META virtual override 로 generated CSS 재생성,
//    Skia = skiaPrimitive popover_shadow/popover_arrow escape + generic box). 사용자 명시 삭제 승인.

// ADR-912 단계5 step4 (2026-06-17): BodySpec/BodyProps export 제거 — catalog cutover spec 물리 삭제.
//   시각 = componentRulesTable.body + generate-css virtual(STRUCTURE_META "Body"). Skia = generic box.

// ADR-912 단계5 step4 type-augment 그룹 (2026-06-16): ToggleButtonGroupSpec/Props export 제거 —
//   catalog cutover spec 삭제. 시각 = componentRulesTable + generate-css virtual(STRUCTURE_META indicatorMode/
//   delegation carry). Skia = catalog generic(buildSpecNodeData isCatalogCutover 게이트).

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

// Select/ComboBox — ADR-912 단계5 step4 (2026-06-17): catalog cutover spec 삭제로 export 제거.
//   시각/CSS 는 STRUCTURE_META virtual, Skia 는 buildCatalogShapes generic 으로 이전.

// IllustratedMessage — ADR-151 후속 (2026-07-17): escape 기하 발산 (Skia 48 vs CSS 240) 수정.
//   DOM(IllustratedMessage.tsx)/Skia escape/layout(calculateContentHeight) 3경로 공유 metric SSOT.
export {
  ILLUSTRATED_MESSAGE_BOX,
  resolveIllustratedMessageMetric,
} from "./renderers/utils/illustratedMessageMetrics";
export type {
  IllustratedMessageMetric,
  IllustratedMessageSizeLike,
} from "./renderers/utils/illustratedMessageMetrics";

// ListBox — ADR-912 단계5 step4 (2026-06-17): ListBox.spec 물리 삭제(catalog cutover).
//   resolveListBoxSpacingMetric + 2 타입은 collectionItemMetrics 로 이관(GridList 선례). ListBoxSpec/Props 제거.
export { resolveListBoxSpacingMetric } from "./renderers/utils/collectionItemMetrics";
export type {
  ListBoxSpacingInput,
  ListBoxSpacingMetric,
} from "./renderers/utils/collectionItemMetrics";

// ListBoxItem — ADR-912 (2026-06-14): spec 물리 삭제(catalog cutover). metric resolver 만 유지.
export {
  resolveListBoxItemMetric,
  resolveListBoxItemRowHeight,
} from "./renderers/utils/collectionItemMetrics";

// ADR-160: collection projection 행 텍스트 측정 SSOT (ListBox/GridList 공용). layout(M1)·
//   buildSpecNodeData 공동 호출자 + escape 소비자가 동일 심볼로 rowHeight/slot 블록/maxWidth 산출.
export { resolveCollectionRowMetric } from "./renderers/utils/collectionItemMetrics";
export type {
  CollectionRowMetric,
  CollectionRowMetricInput,
  CollectionRowMetricEntry,
  CollectionRowSlotBlock,
  CollectionRowSlotRole,
} from "./renderers/utils/collectionItemMetrics";
// 2026-08-22: GridList 카드 선택 체크박스 블록 — 카드 높이 4경로(escape / layout per-card /
//   layout owner / virtualization stride)가 같은 심볼로 블록·델타를 얻는다.
export {
  buildCardSelectionEntry,
  resolveCardSelectionExtra,
} from "./renderers/utils/collectionItemMetrics";
// ADR-160 후속: ListBoxItem 행 텍스트 좌우 inset(textX/rightReserve) 단일 공식. escape·M1 공동 호출.
export { resolveListBoxItemInset } from "./renderers/utils/collectionItemMetrics";
export type {
  ListBoxItemInsetInput,
  CollectionRowInset,
} from "./renderers/utils/collectionItemMetrics";

// Header (ADR-099 Phase 3 — section 헤더). ADR-912 단계5 step4 (2026-06-16): Header.spec.ts 삭제 —
//   시각 SSOT = componentRulesTable.Header + ListBox.spec inline child spec (childSpecs CSS emit).
// Slider — ADR-912 단계5 step4 (2026-06-17): Slider.spec.ts 물리 삭제(catalog cutover). export 제거.
//   시각 SSOT = componentRulesTable.Slider + STRUCTURE_META virtual(slider archetype). SLIDER_FILL_COLORS
//   외부 소비처 0건(SliderTrack/SliderThumb rule variant fill {color.accent} 로 대체). SliderProps 외부 import 0.
// ADR-912 단계5 step4 (2026-06-17): Meter.spec 물리 삭제(catalog cutover).
//   barHeight 상수(valueFillMetrics)는 ADR-912 Phase 5 후속 (2026-06-20) 에서 소비처(utils.ts)가
//   catalog MeterTrack.sizes.height read-through 로 흡수 → valueFillMetrics 모듈 전체 삭제(dead).
//   METER_FILL_COLORS(rule.variants.fillBar 로 이관됨, dead) + MeterSpec/MeterProps 제거.

// ADR-912 단계5 value-fill-track: MeterTrackSpec 삭제 — catalog 발효(value_fill_bar escape)
//   + generate-css virtual(archetype:progress) + layout 로컬 미러(VALUE_FILL_TRACK_HEIGHT) 로 대체.

// ADR-912 value-label (2026-06-11): MeterValueSpec 삭제 — catalog 발효(buildCatalogShapes text)
//   + generate-css virtual(archetype:progress) + specTextStyle catalogType 측정으로 대체.

// ADR-912 단계5 step4 (2026-06-17): ProgressBar.spec 물리 삭제(catalog cutover).
//   barHeight 상수(valueFillMetrics)는 ADR-912 Phase 5 후속 (2026-06-20) 에서 소비처(utils.ts)가
//   catalog ProgressBarTrack.sizes.height read-through 로 흡수 → valueFillMetrics 모듈 전체 삭제(dead).
//   PROGRESSBAR_FILL_COLORS(rule.variants.fillBar 로 이관됨, dead) + ProgressBarSpec/ProgressBarProps 제거.

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

// TabsSpec/TabsProps/TabItem — ADR-912 단계5 step4 (2026-06-17): Tabs.spec.ts 삭제 — catalog cutover 완료.
//   시각 SSOT = componentRulesTable + STRUCTURE_META(generate-css). Property Panel = binding.props.accepts.
//   layout height = resolveSkiaRule("Tabs"). Skia 게이트 = isCatalogCutover (catalog 자동).
//   items propagation(Tabs → TabList)은 propagationRegistry.ts 의 tabsPropagationSpec 인라인.
// ADR-912 projection 3 cutover (2026-06-15): TabListSpec/TabSpec/TabListProps/TabProps export 제거
//   — catalog cutover, spec 삭제. 시각 SSOT = componentRulesTable + tablist_divider/tab_indicator escape.

// Menu — ADR-912 단계5 step4 경량 이관 (2026-06-17): spec 물리 삭제(catalog cutover).
//   MenuSpec/MenuProps + MENU_ITEM_DIMENSIONS(dead, 외부 소비 0) 제거. 측정은 specTextStyle
//   catalogType:"Menu" (resolveSkiaRule), CSS 는 STRUCTURE_META virtual override.

// ADR-912 단계5 step4 (2026-06-16): Breadcrumbs.spec.ts 삭제 — catalog cutover 완료.
//   시각 SSOT = componentRulesTable + STRUCTURE_META(generate-css). Property Panel =
//   binding.props.accepts(resolveEditContract). layout height = resolveSkiaRule("Breadcrumbs").
//   Skia 게이트 = isCatalogCutover (catalog 자동). BreadcrumbSpec/BreadcrumbItemProps 도 동일 삭제.

// ADR-912 R7 G1-c (2026-06-15): PaginationSpec/PaginationProps export 제거 — catalog cutover.
//   시각 SSOT = COMPONENT_RULES_TABLE.Pagination + generate-css virtual. binding.accepts D2.

// ADR-912 단계5 step4 (2026-06-17): TagGroupSpec/TagGroupProps export 제거 — catalog cutover
//   spec 물리 삭제. 시각 SSOT = COMPONENT_RULES_TABLE.TagGroup (containerStyles/containerVariants
//   포함) + generate-css. layout = catalog fallback 메커니즘(8aa773bcc). binding.accepts D2.
//   TagGroupProps 외부 소비 0 (unified.types TagGroupElementProps / RAC AriaTagGroupProps 별개).

// ADR-912 collection sub-part cutover (2026-06-15): TagListSpec / TAG_CHIP_SIZES /
//   TagListProps export 제거 — TagList.spec.ts 물리 삭제(catalog cutover 완료).
//   chip 치수는 Tag/TagList catalog rule, layout 은 implicitStyles 자족화로 이관됨.

// ADR-912 단계5 step4 (2026-06-17): TagSpec/TagSpecProps export 제거 — catalog cutover spec 물리
//   삭제. chip 시각 SSOT = COMPONENT_RULES_TABLE.Tag (appendTagRowProjection). StoredTagItem/
//   RuntimeTagItem(taggroup-items)은 별개 파일로 유지.

// ADR-912 단계5 step4 경량 이관 (2026-06-17): GridList.spec 물리 삭제(catalog cutover).
//   resolveGridListSpacingMetric + 2 타입은 collectionItemMetrics 로 이관(아래). GridListSpec/Props 제거.
// ADR-912 (2026-06-14): GridListItem.spec 물리 삭제(catalog cutover). metric resolver 만 유지.
export {
  resolveGridListItemMetric,
  resolveGridListSpacingMetric,
  COLLECTION_TEXT_DEFAULT_FONT_SIZE,
} from "./renderers/utils/collectionItemMetrics";
export type {
  GridListSpacingMetric,
  GridListSpacingInput,
} from "./renderers/utils/collectionItemMetrics";

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
// ADR-912 단계5 step4 (2026-06-17): DatePicker.spec/DateRangePicker.spec 물리 삭제(catalog cutover).
//   spec-free shapes 빌더/상수는 renderers/datePickerShapes.ts 로 추출 → barrel 호환 위해 재export.
//   DatePickerSpec/DateRangePickerSpec/Props 제거. SSOT = componentRulesTable + STRUCTURE_META,
//   Property Panel = binding.accepts, Skia = datefield_trigger primitive, propagation = 인라인.
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

// ADR-912 단계5 step4 (2026-06-17): DateFieldSpec/DateFieldProps export 제거 — catalog cutover spec 물리 삭제.
//   Skia = 투명 컨테이너(빈 shapes). layout intrinsicHeight = utils.ts rule 인라인 미러. TimeField 동형.

// ADR-912 단계5 step4 (2026-06-17): DateInputSpec/DateInputProps export 제거 — catalog cutover spec 물리 삭제.
//   Skia = datefield_segments replace primitive. layout height = utils.ts rule 인라인 미러.

// Calendar (calendar archetype) — ADR-912 단계5 step4 date-color (2026-06-16): barrel export 제거
//   (spec 삭제 — catalog rule + STRUCTURE_META virtual override(calendar archetype). Skia 는
//    calendar_grid skiaPrimitive escape. propagation 은 propagationRegistry 인라인). 사용자 명시 삭제 승인.

// ADR-912 단계5 step4 small 그룹 (2026-06-16): CalendarHeader/CalendarGrid.spec 물리 삭제 —
//   catalog cutover. skipCSSGeneration:true → generated CSS 없음(virtual override 불요). Skia 는
//   inline_icon_text / calendar_grid_only replace primitive(spec-free)가 대체. layout consumer 0
//   (utils.ts CalendarHeader height 분기는 rule 인라인 미러로 이미 전환). binding.accepts D2.

// RangeCalendar (calendar archetype, ...CalendarSpec spread) — ADR-912 단계5 step4 date-color
//   (2026-06-16): barrel export 제거 (spec 삭제 — Calendar 와 시각 동형 STRUCTURE_META virtual).

// ColorPicker — ADR-912 Color container cutover (2026-06-17): spec export 제거.
//   시각 SSOT = componentRulesTable + buildCatalogShapes generic shell.

// ADR-912 6 registry collapse — Color leaf 5종 box-only cutover (2026-06-11):
//   ColorSlider/ColorArea/ColorWheel/ColorSwatch/TailSwatch spec 삭제.
// ADR-912 Color container cutover (2026-06-17):
//   ColorPicker/ColorSwatchPicker spec 삭제. DOM child 합성은 rendererMap, Skia 는 catalog shell.

// ColorSwatchPicker — ADR-912 Color container cutover (2026-06-17): spec export 제거.

// ADR-912 단계5 step4 (2026-06-17): InputSpec/InputProps export 제거 — catalog cutover spec 물리 삭제.
//   시각 SSOT = componentRulesTable.Input (generate-css virtual + Skia generic). Field.Input 의
//   InputProps 는 react-aria-components 출처(spec 무관).

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

// ADR-912 단계5 step4 (2026-06-17): InlineAlertSpec/InlineAlertProps re-export 제거 — InlineAlert.spec
//   물리 삭제(catalog cutover). 자식 font/padding/gap 은 componentRulesTable.InlineAlert.sizes +
//   STRUCTURE_META virtual(generated CSS) + resolveSkiaRule read-through(layout consumer)로 갈음.

// ─── Phase 6: ADR-030 Phase 2 Components ────────────────────────────────────
// ADR-912 R7 G1-c (2026-06-15): ButtonGroupSpec/ButtonGroupProps 삭제 — catalog cutover. 시각 SSOT =
//   COMPONENT_RULES_TABLE.ButtonGroup + generate-css virtual, D2 properties = binding.accepts. layout
//   (flex/gap)은 factory props.style SSOT. factory 자식 Button×2 자동생성 → box-shell(Pagination 동형).

// ─── Phase 7: ADR-030 Phase 3 Extended Controls ─────────────────────────────
// ADR-912 단계5: ProgressCircleSpec/PROGRESSCIRCLE_* 삭제 — catalog cutover(value_fill_arc) +
//   generate-css virtual 일반화(archetype:progress). diameter 는 layout 인라인 미러로 이관.
// ADR-912 후속 cleanup: ImageSpec/IMAGE_DIMENSIONS/ImageProps re-export 제거 — 유일 소비처가
//   dead getEditor 체인(specRegistry)이었고 함께 제거됨. Image 렌더는 catalog rule 경유.

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
} from "./runtime/tagToElement";
export { resolveContainerStylesFallback } from "./runtime/containerStylesFallback";
