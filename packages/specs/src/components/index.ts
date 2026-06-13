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
export { CardSpec } from "./Card.spec";
export type { CardProps } from "./Card.spec";

// CardHeader (ADR-092 Phase 1)
export { CardHeaderSpec } from "./CardHeader.spec";
export type { CardHeaderProps } from "./CardHeader.spec";

// CardContent (ADR-092 Phase 1)
export { CardContentSpec } from "./CardContent.spec";
export type { CardContentProps } from "./CardContent.spec";

// CardFooter (ADR-092 Phase 1)
export { CardFooterSpec } from "./CardFooter.spec";
export type { CardFooterProps } from "./CardFooter.spec";

// CardPreview (Disclosure·Tree 버그 클래스 수정 — container slot spec)
export { CardPreviewSpec } from "./CardPreview.spec";
export type { CardPreviewProps } from "./CardPreview.spec";

// Dialog
export { DialogSpec } from "./Dialog.spec";
export type { DialogProps } from "./Dialog.spec";

// DialogFooter (Disclosure·Tree 버그 클래스 수정 — container slot spec)
export { DialogFooterSpec } from "./DialogFooter.spec";
export type { DialogFooterProps } from "./DialogFooter.spec";

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

// CheckboxItems (ADR-093 Phase 1 — CheckboxGroup 중간 컨테이너 spec)
export { CheckboxItemsSpec } from "./CheckboxItems.spec";
export type { CheckboxItemsProps } from "./CheckboxItems.spec";

// Radio
export { RadioSpec, RADIO_SELECTED_COLORS } from "./Radio.spec";
export type { RadioProps } from "./Radio.spec";

// RadioGroup
export { RadioGroupSpec } from "./RadioGroup.spec";
export type { RadioGroupProps } from "./RadioGroup.spec";

// RadioItems (ADR-093 Phase 1 — RadioGroup 중간 컨테이너 spec)
export { RadioItemsSpec } from "./RadioItems.spec";
export type { RadioItemsProps } from "./RadioItems.spec";

// Switch
export { SwitchSpec, SWITCH_SELECTED_TRACK_COLORS } from "./Switch.spec";
export type { SwitchProps } from "./Switch.spec";

// Form
export { FormSpec } from "./Form.spec";
export type { FormProps } from "./Form.spec";

// FormField (Disclosure·Tree 버그 클래스 수정 — container slot spec)
export { FormFieldSpec } from "./FormField.spec";
export type { FormFieldProps } from "./FormField.spec";

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

// List
export { ListSpec } from "./List.spec";
export type { ListProps } from "./List.spec";

// Switcher — ADR-912 Switcher cleanup 으로 제거 (RAC ToggleButtonGroup 으로 대체).

// Table
export { TableSpec } from "./Table.spec";
export type { TableProps, TableColumn, TableRow } from "./Table.spec";

// TableRow/TableCell (ADR-912 단계 4 C1 — Table 2D projected row/cell self-render)
export { TableRowSpec, TableCellSpec } from "./TableCell.spec";
export type { TableRowProps, TableCellProps } from "./TableCell.spec";

// Tree
export { TreeSpec } from "./Tree.spec";
export type { TreeProps } from "./Tree.spec";

// TreeItem — ADR-912 R1 후속 (2026-06-12): catalog cutover, spec 삭제

// Tabs
export { TabsSpec } from "./Tabs.spec";
export type { TabsProps } from "./Tabs.spec";
export { TabListSpec } from "./TabList.spec";
export type { TabListProps } from "./TabList.spec";
export { TabSpec } from "./Tab.spec";
export type { TabProps } from "./Tab.spec";

// Menu
export { MenuSpec } from "./Menu.spec";
export type { MenuProps } from "./Menu.spec";

// ListBoxItem (ADR-146 — Skia row projection renderer + generated CSS source)
// ADR-912 cutover: metric resolver 는 collectionItemMetrics 로 분리(spec body 삭제 대비).
export {
  resolveListBoxItemMetric,
  resolveListBoxItemRowHeight,
} from "../renderers/utils/collectionItemMetrics";
export { ListBoxItemSpec } from "./ListBoxItem.spec";
export type { ListBoxItemProps } from "./ListBoxItem.spec";

// Breadcrumbs
export { BreadcrumbsSpec } from "./Breadcrumbs.spec";
export type { BreadcrumbsProps } from "./Breadcrumbs.spec";
export { BreadcrumbSpec } from "./Breadcrumb.spec";
export type { BreadcrumbItemProps } from "./Breadcrumb.spec";

// Pagination
export { PaginationSpec } from "./Pagination.spec";
export type { PaginationProps } from "./Pagination.spec";

// TagGroup
export { TagGroupSpec } from "./TagGroup.spec";
export type { TagGroupProps } from "./TagGroup.spec";

// TagList (ADR-093 Phase 1 — TagGroup 중간 컨테이너 spec)
export { TagListSpec } from "./TagList.spec";
export type { TagListProps } from "./TagList.spec";

// Tag
export { TagSpec } from "./Tag.spec";
export type { TagProps as TagSpecProps } from "./Tag.spec";

// GridList
export { GridListSpec } from "./GridList.spec";
export type { GridListProps } from "./GridList.spec";

// GridListItem (ADR-090 — Spec metadata 전용, skipCSSGeneration: true)
// ADR-912 cutover: metric resolver 는 collectionItemMetrics 로 분리(spec body 삭제 대비).
export { resolveGridListItemMetric } from "../renderers/utils/collectionItemMetrics";
export { GridListItemSpec } from "./GridListItem.spec";
export type { GridListItemProps } from "./GridListItem.spec";

// Disclosure / DisclosureGroup — ADR-912 Disclosure 군 일괄 cutover (2026-06-10) spec 삭제.
//   시각 SSOT = componentRulesTable catalog rule.

// Toolbar
export { ToolbarSpec } from "./Toolbar.spec";
export type { ToolbarProps } from "./Toolbar.spec";

// Toast
export { ToastSpec } from "./Toast.spec";
export type { ToastProps } from "./Toast.spec";

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

// MaskedFrame
export { MaskedFrameSpec } from "./MaskedFrame.spec";
export type { MaskedFrameProps } from "./MaskedFrame.spec";

// Label

// FieldError/Description (box+text leaf) — ADR-912 단계5 step5: barrel export 제거 (spec 삭제 — catalog rule 발효)
// Heading/Paragraph/Kbd/Code (TEXT_LEAF) — ADR-912 단계5 step4: barrel export 제거 (spec 삭제 대상)

// DisclosureHeader — ADR-912 Disclosure 군 일괄 cutover (2026-06-10): spec 삭제됨.
//   barrel export 정리 누락분 제거 (2026-06-11). 시각 SSOT = componentRulesTable.DisclosureHeader.
// DisclosureContent — ADR-912 단계5 spec 삭제 (catalog cutover 완결). 시각 SSOT = componentRulesTable.DisclosureContent.

// SliderTrack — ADR-912 단계5 value-fill-track: spec 삭제 (catalog cutover + virtual CSS)

// SliderThumb
export { SliderThumbSpec } from "./SliderThumb.spec";
export type { SliderThumbProps } from "./SliderThumb.spec";

// SliderOutput — ADR-912 value-label (2026-06-11): spec 삭제 (catalog cutover + virtual CSS)

// Icon (ADR-019)

// Avatar
export { AvatarSpec } from "./Avatar.spec";
export type { AvatarProps } from "./Avatar.spec";

// AvatarGroup
export { AvatarGroupSpec } from "./AvatarGroup.spec";
export type { AvatarGroupProps } from "./AvatarGroup.spec";

// StatusLight

// InlineAlert
export { InlineAlertSpec } from "./InlineAlert.spec";
export type { InlineAlertProps } from "./InlineAlert.spec";

// ButtonGroup
export { ButtonGroupSpec } from "./ButtonGroup.spec";
export type { ButtonGroupProps } from "./ButtonGroup.spec";

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

// CardView
export { CardViewSpec, CARDVIEW_DENSITY_GAP } from "./CardView.spec";
export type { CardViewProps } from "./CardView.spec";

// TableView
export { TableViewSpec, TABLEVIEW_ROW_HEIGHTS } from "./TableView.spec";
export type { TableViewProps } from "./TableView.spec";
