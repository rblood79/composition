/**
 * Components - Public API
 *
 * Component Spec 정의
 *
 * @packageDocumentation
 */

// Button
export { ButtonSpec } from "./Button.spec";
export type { ButtonProps } from "./Button.spec";

// Text/Heading/Paragraph/Code/Kbd (TEXT_LEAF) — ADR-912 단계5 step4: spec 삭제 대상,
// catalog rule SSOT 로 이관 완료(측정/CSS/렌더 전부). barrel export 제거.

// Badge
export { BadgeSpec } from "./Badge.spec";
export type { BadgeProps } from "./Badge.spec";

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
export { SeparatorSpec } from "./Separator.spec";
export type { SeparatorProps } from "./Separator.spec";

// ToggleButton
export { ToggleButtonSpec } from "./ToggleButton.spec";
export type { ToggleButtonProps } from "./ToggleButton.spec";

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

// MeterValue
export { MeterValueSpec } from "./MeterValue.spec";
export type { MeterValueProps } from "./MeterValue.spec";

// ProgressBar
export {
  ProgressBarSpec,
  PROGRESSBAR_FILL_COLORS,
  PROGRESSBAR_DIMENSIONS,
} from "./ProgressBar.spec";
export type { ProgressBarProps } from "./ProgressBar.spec";

// ProgressBarTrack — ADR-912 단계5 value-fill-track: spec 삭제 (catalog cutover + virtual CSS)

// ProgressBarValue
export { ProgressBarValueSpec } from "./ProgressBarValue.spec";
export type { ProgressBarValueProps } from "./ProgressBarValue.spec";

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

// ColorSlider
export { ColorSliderSpec } from "./ColorSlider.spec";
export type { ColorSliderProps } from "./ColorSlider.spec";

// ColorArea
export { ColorAreaSpec } from "./ColorArea.spec";
export type { ColorAreaProps } from "./ColorArea.spec";

// ColorWheel
export { ColorWheelSpec } from "./ColorWheel.spec";
export type { ColorWheelProps } from "./ColorWheel.spec";

// ColorSwatch
export { ColorSwatchSpec } from "./ColorSwatch.spec";
export type { ColorSwatchProps } from "./ColorSwatch.spec";

// ColorSwatchPicker
export { ColorSwatchPickerSpec } from "./ColorSwatchPicker.spec";
export type { ColorSwatchPickerProps } from "./ColorSwatchPicker.spec";

// List
export { ListSpec } from "./List.spec";
export type { ListProps } from "./List.spec";

// Switcher
export { SwitcherSpec } from "./Switcher.spec";
export type { SwitcherProps } from "./Switcher.spec";

// Table
export { TableSpec } from "./Table.spec";
export type { TableProps, TableColumn, TableRow } from "./Table.spec";

// TableRow/TableCell (ADR-912 단계 4 C1 — Table 2D projected row/cell self-render)
export { TableRowSpec, TableCellSpec } from "./TableCell.spec";
export type { TableRowProps, TableCellProps } from "./TableCell.spec";

// Tree
export { TreeSpec } from "./Tree.spec";
export type { TreeProps } from "./Tree.spec";

// TreeItem
export { TreeItemSpec } from "./TreeItem.spec";
export type { TreeItemProps } from "./TreeItem.spec";

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

// MenuItem (ADR-068 — CSS 자동 생성 전용, Builder Skia 미등록 Q5=i)
export { MenuItemSpec } from "./MenuItem.spec";
export type { MenuItemProps } from "./MenuItem.spec";

// ListBoxItem (ADR-146 — Skia row projection renderer + generated CSS source)
export {
  ListBoxItemSpec,
  resolveListBoxItemMetric,
  resolveListBoxItemRowHeight,
} from "./ListBoxItem.spec";
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
export {
  GridListItemSpec,
  resolveGridListItemMetric,
} from "./GridListItem.spec";
export type { GridListItemProps } from "./GridListItem.spec";

// Disclosure
export { DisclosureSpec } from "./Disclosure.spec";
export type { DisclosureProps } from "./Disclosure.spec";

// DisclosureGroup
export { DisclosureGroupSpec } from "./DisclosureGroup.spec";
export type { DisclosureGroupProps } from "./DisclosureGroup.spec";

// Toolbar
export { ToolbarSpec } from "./Toolbar.spec";
export type { ToolbarProps } from "./Toolbar.spec";

// Toast
export { ToastSpec } from "./Toast.spec";
export type { ToastProps } from "./Toast.spec";

// Nav
export { NavSpec } from "./Nav.spec";
export type { NavProps } from "./Nav.spec";

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
export { SkeletonSpec } from "./Skeleton.spec";
export type { SkeletonProps } from "./Skeleton.spec";

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
export { LabelSpec } from "./Label.spec";
export type { LabelProps } from "./Label.spec";

// FieldError/Description (box+text leaf) — ADR-912 단계5 step5: barrel export 제거 (spec 삭제 — catalog rule 발효)
// Heading/Paragraph/Kbd/Code (TEXT_LEAF) — ADR-912 단계5 step4: barrel export 제거 (spec 삭제 대상)

// DisclosureHeader
export { DisclosureHeaderSpec } from "./DisclosureHeader.spec";
export type { DisclosureHeaderProps } from "./DisclosureHeader.spec";

// DisclosureContent
export { DisclosureContentSpec } from "./DisclosureContent.spec";
export type { DisclosureContentProps } from "./DisclosureContent.spec";

// SliderTrack — ADR-912 단계5 value-fill-track: spec 삭제 (catalog cutover + virtual CSS)

// SliderThumb
export { SliderThumbSpec } from "./SliderThumb.spec";
export type { SliderThumbProps } from "./SliderThumb.spec";

// SliderOutput
export { SliderOutputSpec } from "./SliderOutput.spec";
export type { SliderOutputProps } from "./SliderOutput.spec";

// Icon (ADR-019)
export { IconSpec } from "./Icon.spec";
export type { IconProps } from "./Icon.spec";

// Avatar
export { AvatarSpec } from "./Avatar.spec";
export type { AvatarProps } from "./Avatar.spec";

// AvatarGroup
export { AvatarGroupSpec } from "./AvatarGroup.spec";
export type { AvatarGroupProps } from "./AvatarGroup.spec";

// StatusLight
export { StatusLightSpec, STATUSLIGHT_DIMENSIONS } from "./StatusLight.spec";
export type { StatusLightProps } from "./StatusLight.spec";

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
