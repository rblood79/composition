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

// Dialog
export { DialogSpec } from "./Dialog.spec";
export type { DialogProps } from "./Dialog.spec";

// DialogFooter — ADR-912 childSpec→catalog cutover (2026-06-15): export 제거 (spec 삭제).
//   시각은 catalog rule(COMPONENT_RULES_TABLE.DialogFooter) + buildCatalogShapes generic.

// Link (box+text leaf) — ADR-912 단계5 step5: barrel export 제거 (spec 삭제 — catalog rule 발효)

// Popover
export { PopoverSpec } from "./Popover.spec";
export type { PopoverProps } from "./Popover.spec";

// Separator

// ToggleButton

// ToggleButtonGroup
export { ToggleButtonGroupSpec } from "./ToggleButtonGroup.spec";
export type { ToggleButtonGroupProps } from "./ToggleButtonGroup.spec";

// Section
export { SectionSpec } from "./Section.spec";
export type { SectionProps } from "./Section.spec";

// Body (ADR-902 후속 — 페이지 루트 theme-aware 배경)
export { BodySpec } from "./Body.spec";
export type { BodyProps } from "./Body.spec";

// Tooltip
export { TooltipSpec, TOOLTIP_MAX_WIDTH } from "./Tooltip.spec";
export type { TooltipProps } from "./Tooltip.spec";

// TextField
export { TextFieldSpec } from "./TextField.spec";
export type { TextFieldProps } from "./TextField.spec";

// TextArea
export { TextAreaSpec } from "./TextArea.spec";
export type { TextAreaProps } from "./TextArea.spec";

// NumberField
export { NumberFieldSpec } from "./NumberField.spec";
export type { NumberFieldProps } from "./NumberField.spec";

// SearchField
export { SearchFieldSpec } from "./SearchField.spec";
export type { SearchFieldProps } from "./SearchField.spec";

// Checkbox
export { CheckboxSpec, CHECKBOX_CHECKED_COLORS } from "./Checkbox.spec";
export type { CheckboxProps } from "./Checkbox.spec";

// CheckboxGroup
export { CheckboxGroupSpec } from "./CheckboxGroup.spec";
export type { CheckboxGroupProps } from "./CheckboxGroup.spec";

// CheckboxItems — ADR-912 collection sub-part cutover (2026-06-14): 중간 컨테이너 폐기, spec 삭제.

// Radio
export { RadioSpec, RADIO_SELECTED_COLORS } from "./Radio.spec";
export type { RadioProps } from "./Radio.spec";

// RadioGroup
export { RadioGroupSpec } from "./RadioGroup.spec";
export type { RadioGroupProps } from "./RadioGroup.spec";

// RadioItems — ADR-912 collection sub-part cutover (2026-06-14): 중간 컨테이너 폐기, spec 삭제.

// Switch
export { SwitchSpec, SWITCH_SELECTED_TRACK_COLORS } from "./Switch.spec";
export type { SwitchProps } from "./Switch.spec";

// Form
export { FormSpec } from "./Form.spec";
export type { FormProps } from "./Form.spec";

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

// Meter
export { MeterSpec, METER_FILL_COLORS, METER_DIMENSIONS } from "./Meter.spec";
export type { MeterProps } from "./Meter.spec";

// MeterTrack — ADR-912 단계5 value-fill-track: spec 삭제 (catalog cutover + virtual CSS)

// MeterValue — ADR-912 value-label (2026-06-11): spec 삭제 (catalog cutover + virtual CSS)

// ProgressBar
export {
  ProgressBarSpec,
  PROGRESSBAR_FILL_COLORS,
  PROGRESSBAR_DIMENSIONS,
} from "./ProgressBar.spec";
export type { ProgressBarProps } from "./ProgressBar.spec";

// ProgressBarTrack — ADR-912 단계5 value-fill-track: spec 삭제 (catalog cutover + virtual CSS)
// ProgressBarValue — ADR-912 value-label (2026-06-11): spec 삭제 (catalog cutover + virtual CSS)

// Input
export { InputSpec } from "./Input.spec";
export type { InputProps } from "./Input.spec";

// DatePicker
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
} from "./DatePicker.spec";
export type { DatePickerProps, DatePickerShapesInput } from "./DatePicker.spec";

// DateRangePicker
export { DateRangePickerSpec } from "./DateRangePicker.spec";
export type { DateRangePickerProps } from "./DateRangePicker.spec";

// DateField
export { DateFieldSpec } from "./DateField.spec";
export type { DateFieldProps } from "./DateField.spec";

// DateInput (DateField/TimeField 입력 영역)
export { DateInputSpec } from "./DateInput.spec";
export type { DateInputProps } from "./DateInput.spec";

// TimeField
export { TimeFieldSpec } from "./TimeField.spec";
export type { TimeFieldProps } from "./TimeField.spec";

// Calendar
export { CalendarSpec } from "./Calendar.spec";
export type { CalendarProps } from "./Calendar.spec";

// CalendarHeader (Calendar 슬롯 — index.ts barrel 과 정합)
export { CalendarHeaderSpec } from "./CalendarHeader.spec";
export type { CalendarHeaderProps } from "./CalendarHeader.spec";

// CalendarGrid (Calendar 슬롯 — index.ts barrel 과 정합)
export { CalendarGridSpec } from "./CalendarGrid.spec";
export type { CalendarGridProps } from "./CalendarGrid.spec";

// RangeCalendar
export { RangeCalendarSpec } from "./RangeCalendar.spec";
export type { RangeCalendarProps } from "./RangeCalendar.spec";

// ColorPicker
export { ColorPickerSpec } from "./ColorPicker.spec";
export type { ColorPickerProps } from "./ColorPicker.spec";

// ColorField
export { ColorFieldSpec } from "./ColorField.spec";
export type { ColorFieldProps } from "./ColorField.spec";

// ADR-912 6 registry collapse — Color leaf 5종 box-only cutover (2026-06-11):
//   ColorSlider/ColorArea/ColorWheel/ColorSwatch/TailSwatch spec 삭제 (catalog cutover 완결,
//   시각 SSOT = componentRulesTable). ColorSwatchPicker(container)는 다음 slice 분리 → 보존.

// ColorSwatchPicker
export { ColorSwatchPickerSpec } from "./ColorSwatchPicker.spec";
export type { ColorSwatchPickerProps } from "./ColorSwatchPicker.spec";

// Switcher — ADR-912 Switcher cleanup 으로 제거 (RAC ToggleButtonGroup 으로 대체).

// Table
export { TableSpec } from "./Table.spec";
export type { TableProps, TableColumn, TableRow } from "./Table.spec";

// TableRow/TableCell — ADR-912 collection sub-part cutover (2026-06-14): spec 물리 삭제됨.
//   projected Row/Cell node 는 catalog cutover generic 경로(buildCatalogShapes + table_row escape).

// Tree
export { TreeSpec } from "./Tree.spec";
export type { TreeProps } from "./Tree.spec";

// TreeItem — ADR-912 R1 후속 (2026-06-12): catalog cutover, spec 삭제

// Tabs
export { TabsSpec } from "./Tabs.spec";
export type { TabsProps } from "./Tabs.spec";
// ADR-912 projection 3 cutover (2026-06-15): TabListSpec/TabSpec export 제거 — catalog cutover, spec 삭제.

// Menu
export { MenuSpec } from "./Menu.spec";
export type { MenuProps } from "./Menu.spec";

// ListBoxItem (ADR-146 — Skia row projection renderer + generated CSS source)
// ADR-912 cutover: metric resolver 는 collectionItemMetrics 로 분리(spec body 삭제 대비).
// ADR-912 (2026-06-14): ListBoxItem.spec 물리 삭제 — metric resolver 만 유지(catalog cutover).
export {
  resolveListBoxItemMetric,
  resolveListBoxItemRowHeight,
} from "../renderers/utils/collectionItemMetrics";

// Breadcrumbs
export { BreadcrumbsSpec } from "./Breadcrumbs.spec";
export type { BreadcrumbsProps } from "./Breadcrumbs.spec";
// ADR-912 projection 3 cutover (2026-06-15): BreadcrumbSpec export 제거 — catalog cutover, spec 삭제.

// Pagination — ADR-912 R7 G1-c (2026-06-15): catalog cutover, spec 삭제. binding.accepts D2.

// TagGroup
export { TagGroupSpec } from "./TagGroup.spec";
export type { TagGroupProps } from "./TagGroup.spec";

// TagList — ADR-912 collection sub-part cutover (2026-06-15): spec 물리 삭제.
//   catalog rule + implicitStyles 자족화로 시각/layout 이관 완료.

// Tag
export { TagSpec } from "./Tag.spec";
export type { TagProps as TagSpecProps } from "./Tag.spec";

// GridList
export { GridListSpec } from "./GridList.spec";
export type { GridListProps } from "./GridList.spec";

// GridListItem — ADR-912 (2026-06-14): spec 물리 삭제(catalog cutover). metric resolver 만 유지.
export { resolveGridListItemMetric } from "../renderers/utils/collectionItemMetrics";

// Disclosure / DisclosureGroup — ADR-912 Disclosure 군 일괄 cutover (2026-06-10) spec 삭제.
//   시각 SSOT = componentRulesTable catalog rule.

// Toolbar
export { ToolbarSpec } from "./Toolbar.spec";
export type { ToolbarProps } from "./Toolbar.spec";

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

// DropZone
export { DropZoneSpec } from "./DropZone.spec";
export type { DropZoneProps } from "./DropZone.spec";

// FileTrigger
export { FileTriggerSpec } from "./FileTrigger.spec";
export type { FileTriggerProps } from "./FileTrigger.spec";

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

// Avatar
export { AvatarSpec } from "./Avatar.spec";
export type { AvatarProps } from "./Avatar.spec";

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

// IllustratedMessage
export {
  IllustratedMessageSpec,
  ILLUSTRATION_DIMENSIONS,
} from "./IllustratedMessage.spec";
export type { IllustratedMessageProps } from "./IllustratedMessage.spec";

// CardView / TableView — ADR-912 R7 G1-b: spec 삭제 (catalog cutover, binding.accepts D2).
//   CARDVIEW_DENSITY_GAP / TABLEVIEW_ROW_HEIGHTS 도 동시 삭제(spec 외 consumer 0).
