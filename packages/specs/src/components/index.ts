/**
 * Components - Public API
 *
 * Component Spec 정의
 *
 * @packageDocumentation
 */

// Button

// Text/Heading/Paragraph/Code/Kbd (TEXT_LEAF) — ADR-912 단계5 step4: spec 삭제 대상,
// catalog rule SSOT 로 이관 완료(측정/CSS/렌더 전부). barrel export 제거.

// Badge

// Card
// ADR-912 R6 (2026-06-15): Card 본체 S2 재설계 catalog cutover → CardSpec/CardProps export 제거.
//   CardHeader/CardContent/CardFooter/CardPreview 자식 4도 childSpec→catalog cutover(2026-06-15).
//   시각 = catalog rule, propagation 은 propagationRegistry.ts 인라인 보존.

// Dialog — ADR-912 단계5 step4 Dialog 단건 (2026-06-16): catalog cutover → spec 삭제.
//   시각 SSOT = componentRulesTable.Dialog + STRUCTURE_META virtual override(archetype overlay).
//   backdrop/shadow 는 skiaPrimitive escape. (구) DialogSpec/DialogProps export 제거.

// DialogFooter — ADR-912 childSpec→catalog cutover (2026-06-15): export 제거 (spec 삭제).
//   시각은 catalog rule(COMPONENT_RULES_TABLE.DialogFooter) + buildCatalogShapes generic.

// Link (box+text leaf) — ADR-912 단계5 step5: barrel export 제거 (spec 삭제 — catalog rule 발효)

// Popover (overlay archetype) — ADR-912 단계5 step4 Popover 단건 (2026-06-16): export 제거
//   (spec 삭제 — catalog rule + STRUCTURE_META virtual override). 사용자 명시 삭제 승인.

// Separator

// ToggleButton

// ToggleButtonGroup — ADR-912 단계5 step4 type-augment 그룹 (2026-06-16): catalog cutover spec 삭제로 export 제거.

// Section

// Body — ADR-912 단계5 step4 (2026-06-17): catalog cutover → spec 물리 삭제 (export 제거).

// Tooltip — ADR-912 단계5 step4 Tooltip 단건 (2026-06-16): catalog cutover → spec 삭제.
//   시각 SSOT = componentRulesTable.Tooltip + STRUCTURE_META virtual override. arrow maxWidth 는
//   skiaPrimitives.ts 인라인. (구) TooltipSpec/TOOLTIP_MAX_WIDTH/TooltipProps export 제거.

// TextField

// TextArea

// NumberField

// SearchField

// Checkbox — ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): catalog cutover, spec 삭제.
//   CHECKBOX_CHECKED_COLORS 상수 코드 사용 0(ADR-142 B2 rule fill 흡수) → 함께 제거.

// CheckboxGroup

// CheckboxItems — ADR-912 collection sub-part cutover (2026-06-14): 중간 컨테이너 폐기, spec 삭제.

// Radio — ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): catalog cutover, spec 삭제.

// RadioGroup

// RadioItems — ADR-912 collection sub-part cutover (2026-06-14): 중간 컨테이너 폐기, spec 삭제.

// Switch — ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): catalog cutover, spec 삭제.

// Form

// ADR-912 childSpec→catalog cutover (2026-06-15): FormFieldSpec 삭제 — catalog 등록(FAMILY_2).
//   DialogFooter 동형. 시각은 rule + buildCatalogShapes generic, layout 은 factory props.style.

// Select
export { SelectSpec } from "./Select.spec";
export type { SelectProps } from "./Select.spec";

// ComboBox
export { ComboBoxSpec } from "./ComboBox.spec";
export type { ComboBoxProps } from "./ComboBox.spec";

// ListBox
export { ListBoxSpec, resolveListBoxSpacingMetric } from "./ListBox.spec";
export type {
  ListBoxProps,
  ListBoxSpacingInput,
  ListBoxSpacingMetric,
} from "./ListBox.spec";

// Slider
export { SliderSpec, SLIDER_FILL_COLORS } from "./Slider.spec";
export type { SliderProps } from "./Slider.spec";

// Meter — ADR-912 단계5 step4 경량 이관 (2026-06-17): spec 물리 삭제(catalog cutover).
//   METER_DIMENSIONS 는 valueFillMetrics 로 이관. METER_FILL_COLORS(dead) + Spec/Props 제거.
export { METER_DIMENSIONS } from "../renderers/utils/valueFillMetrics";

// MeterTrack — ADR-912 단계5 value-fill-track: spec 삭제 (catalog cutover + virtual CSS)

// MeterValue — ADR-912 value-label (2026-06-11): spec 삭제 (catalog cutover + virtual CSS)

// ProgressBar — ADR-912 단계5 step4 경량 이관 (2026-06-17): spec 물리 삭제(catalog cutover).
//   PROGRESSBAR_DIMENSIONS 는 valueFillMetrics 로 이관. PROGRESSBAR_FILL_COLORS(dead) + Spec/Props 제거.
export { PROGRESSBAR_DIMENSIONS } from "../renderers/utils/valueFillMetrics";

// ProgressBarTrack — ADR-912 단계5 value-fill-track: spec 삭제 (catalog cutover + virtual CSS)
// ProgressBarValue — ADR-912 value-label (2026-06-11): spec 삭제 (catalog cutover + virtual CSS)

// Input — ADR-912 단계5 step4 (2026-06-17): InputSpec/InputProps export 제거 (catalog cutover spec 물리 삭제)

// DatePicker / DateRangePicker
// ADR-912 단계5 step4 (2026-06-17): DatePicker.spec/DateRangePicker.spec 물리 삭제.
//   spec-free shapes 빌더/상수는 renderers/datePickerShapes.ts 로 추출 → barrel 호환 위해 재export.
//   DatePickerSpec/DateRangePickerSpec/Props 는 catalog cutover 로 제거 (SSOT = componentRulesTable +
//   STRUCTURE_META, Property Panel = binding.accepts, Skia = datefield_trigger primitive,
//   propagation = propagationRegistry 인라인).
export {
  buildDatePickerShapes,
  buildDatePlaceholder,
  DATE_PICKER_INPUT_HEIGHT,
  DATE_PICKER_INPUT_PADDING,
  DATE_PICKER_BORDER_RADIUS,
  DATE_PICKER_ICON_SIZE,
  DATE_PICKER_SIZES,
  DATE_PICKER_STATES,
} from "../renderers/datePickerShapes";
export type { DatePickerShapesInput } from "../renderers/datePickerShapes";

// DateField
export { DateFieldSpec } from "./DateField.spec";
export type { DateFieldProps } from "./DateField.spec";

// DateInput — ADR-912 단계5 step4 (2026-06-17): catalog cutover → spec 물리 삭제 (export 제거).

// TimeField

// Calendar (calendar archetype) — ADR-912 단계5 step4 date-color (2026-06-16): export 제거
//   (spec 삭제 — catalog rule + STRUCTURE_META virtual override). 사용자 명시 삭제 승인.

// CalendarHeader/CalendarGrid — ADR-912 단계5 step4 small 그룹 (2026-06-16): spec 물리 삭제.
//   catalog cutover, skipCSSGeneration:true, Skia replace primitive(spec-free) 대체.

// RangeCalendar (...CalendarSpec spread) — ADR-912 단계5 step4 date-color (2026-06-16): export 제거
//   (spec 삭제 — Calendar 와 시각 동형 STRUCTURE_META virtual).

// ColorPicker
export { ColorPickerSpec } from "./ColorPicker.spec";
export type { ColorPickerProps } from "./ColorPicker.spec";

// ColorField

// ADR-912 6 registry collapse — Color leaf 5종 box-only cutover (2026-06-11):
//   ColorSlider/ColorArea/ColorWheel/ColorSwatch/TailSwatch spec 삭제 (catalog cutover 완결,
//   시각 SSOT = componentRulesTable). ColorSwatchPicker(container)는 다음 slice 분리 → 보존.

// ColorSwatchPicker
export { ColorSwatchPickerSpec } from "./ColorSwatchPicker.spec";
export type { ColorSwatchPickerProps } from "./ColorSwatchPicker.spec";

// Switcher — ADR-912 Switcher cleanup 으로 제거 (RAC ToggleButtonGroup 으로 대체).

// Table/Tree — ADR-912 단계5 step4 trivial 그룹 (2026-06-16): spec 물리 삭제.
//   catalog cutover (FAMILY_5 발효 + table/tree DELEGATING 등록), skipCSSGeneration:true,
//   box-only generic 대체, 외부 type import 0. TableRow/TableCell.spec 은 이미 삭제(2026-06-14),
//   TreeItem.spec 은 이미 삭제(2026-06-12).

// Tabs — ADR-912 단계5 step4 (2026-06-17): Tabs.spec.ts 삭제 (catalog cutover 완료).
// ADR-912 projection 3 cutover (2026-06-15): TabListSpec/TabSpec export 제거 — catalog cutover, spec 삭제.

// Menu — ADR-912 단계5 step4 경량 이관 (2026-06-17): spec 물리 삭제(catalog cutover).
//   MenuSpec/MenuProps + MENU_ITEM_DIMENSIONS(dead) 제거.

// ListBoxItem (ADR-146 — Skia row projection renderer + generated CSS source)
// ADR-912 cutover: metric resolver 는 collectionItemMetrics 로 분리(spec body 삭제 대비).
// ADR-912 (2026-06-14): ListBoxItem.spec 물리 삭제 — metric resolver 만 유지(catalog cutover).
export {
  resolveListBoxItemMetric,
  resolveListBoxItemRowHeight,
} from "../renderers/utils/collectionItemMetrics";

// Breadcrumbs — ADR-912 단계5 step4 (2026-06-16): catalog cutover, spec 삭제.
//   시각 SSOT = componentRulesTable + STRUCTURE_META. BreadcrumbSpec 도 동일 삭제(이전 cutover).

// Pagination — ADR-912 R7 G1-c (2026-06-15): catalog cutover, spec 삭제. binding.accepts D2.

// TagGroup — ADR-912 단계5 step4 (2026-06-17): catalog cutover, spec 물리 삭제.
//   시각 SSOT = COMPONENT_RULES_TABLE.TagGroup (containerStyles/containerVariants). binding.accepts D2.

// TagList — ADR-912 collection sub-part cutover (2026-06-15): spec 물리 삭제.
//   catalog rule + implicitStyles 자족화로 시각/layout 이관 완료.

// Tag — ADR-912 단계5 step4 (2026-06-17): catalog cutover, spec 물리 삭제.
//   chip 시각 SSOT = COMPONENT_RULES_TABLE.Tag (appendTagRowProjection).

// GridList — ADR-912 단계5 step4 경량 이관 (2026-06-17): spec 물리 삭제(catalog cutover).
//   resolveGridListSpacingMetric + 2 타입은 collectionItemMetrics 로 이관. GridListSpec/Props 제거.
// GridListItem — ADR-912 (2026-06-14): spec 물리 삭제(catalog cutover). metric resolver 만 유지.
export {
  resolveGridListItemMetric,
  resolveGridListSpacingMetric,
} from "../renderers/utils/collectionItemMetrics";
export type {
  GridListSpacingMetric,
  GridListSpacingInput,
} from "../renderers/utils/collectionItemMetrics";

// Disclosure / DisclosureGroup — ADR-912 Disclosure 군 일괄 cutover (2026-06-10) spec 삭제.
//   시각 SSOT = componentRulesTable catalog rule.

// Toolbar

// Toast — ADR-912 R7 G1-c (2026-06-15): 순수 box-shell catalog cutover, spec 삭제. binding.accepts D2.
//   좌측 accent bar 는 RAC 공식(react-aria.adobe.com/Toast) 미준수 변형이라 제거.

// Group
export { GroupSpec } from "./Group.spec";
export type { GroupProps } from "./Group.spec";

// Frame — ADR-130: canonical layout container (D3, distinct from RAC Group D1/ARIA)
export { FrameSpec } from "./Frame.spec";
export type { FrameProps } from "./Frame.spec";

// Slot
export { SlotSpec } from "./Slot.spec";
export type { SlotProps } from "./Slot.spec";

// Skeleton

// DropZone — ADR-912 단계5 step4 Phase 1 batch 2 (2026-06-16): catalog cutover, spec 삭제.
//   시각 SSOT = COMPONENT_RULES_TABLE.DropZone + generate-css virtual override.

// FileTrigger

// Label

// FieldError/Description (box+text leaf) — ADR-912 단계5 step5: barrel export 제거 (spec 삭제 — catalog rule 발효)
// Heading/Paragraph/Kbd/Code (TEXT_LEAF) — ADR-912 단계5 step4: barrel export 제거 (spec 삭제 대상)

// DisclosureHeader — ADR-912 Disclosure 군 일괄 cutover (2026-06-10): spec 삭제됨.
//   barrel export 정리 누락분 제거 (2026-06-11). 시각 SSOT = componentRulesTable.DisclosureHeader.
// DisclosureContent — ADR-912 단계5 spec 삭제 (catalog cutover 완결). 시각 SSOT = componentRulesTable.DisclosureContent.

// SliderTrack — ADR-912 단계5 value-fill-track: spec 삭제 (catalog cutover + virtual CSS)

// SliderThumb — ADR-912 catalog cutover (2026-06-16): spec 삭제 (slider_thumb escape, replace)

// SliderOutput — ADR-912 value-label (2026-06-11): spec 삭제 (catalog cutover + virtual CSS)

// Icon (ADR-019)

// Avatar — ADR-912 단계5 step4 Phase 1 batch 1 (2026-06-16): spec 삭제 (catalog cutover,
//   COMPONENT_RULES_TABLE.Avatar + virtual archetype:simple + avatar primitive replace)

// AvatarGroup — ADR-912 R7 G1-a: spec 삭제 (catalog cutover, binding.accepts D2)

// StatusLight

// InlineAlert
export { InlineAlertSpec } from "./InlineAlert.spec";
export type { InlineAlertProps } from "./InlineAlert.spec";

// ButtonGroup — ADR-912 R7 G1-c (2026-06-15): catalog cutover, spec 삭제. binding.accepts D2.

// ─── Phase 3: ADR-030 Extended Controls ──────────────────────────────────────

// ProgressCircle — ADR-912 단계5: spec 삭제 (catalog cutover + generate-css virtual archetype:progress)

// Image
export { ImageSpec, IMAGE_DIMENSIONS } from "./Image.spec";
export type { ImageProps } from "./Image.spec";

// ─── Phase 4: ADR-030 Advanced Components ─────────────────────────────────────

// IllustratedMessage — ADR-912 단계5 step4 type-augment 그룹 (2026-06-16): catalog cutover spec 삭제로
//   IllustratedMessageSpec/Props + ILLUSTRATION_DIMENSIONS export 제거 (Skia escape 자체 상수 사용).

// CardView / TableView — ADR-912 R7 G1-b: spec 삭제 (catalog cutover, binding.accepts D2).
//   CARDVIEW_DENSITY_GAP / TABLEVIEW_ROW_HEIGHTS 도 동시 삭제(spec 외 consumer 0).
