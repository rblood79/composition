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
} from "./renderers";

export type { ReactRenderResult } from "./renderers";
export type {
  ResolvedContainerVariants,
  NestedSelectorChild,
} from "./renderers";

// ─── Components ──────────────────────────────────────────────────────────────
export { ButtonSpec } from "./components/Button.spec";
export type { ButtonProps } from "./components/Button.spec";

export { TextSpec } from "./components/Text.spec";
export type { TextProps } from "./components/Text.spec";

export { BadgeSpec } from "./components/Badge.spec";
export type { BadgeProps } from "./components/Badge.spec";

export { CardSpec } from "./components/Card.spec";
export type { CardProps } from "./components/Card.spec";

export { CardHeaderSpec } from "./components/CardHeader.spec";
export type { CardHeaderProps } from "./components/CardHeader.spec";

export { CardContentSpec } from "./components/CardContent.spec";
export type { CardContentProps } from "./components/CardContent.spec";

export { CardFooterSpec } from "./components/CardFooter.spec";
export type { CardFooterProps } from "./components/CardFooter.spec";

export { DialogSpec } from "./components/Dialog.spec";
export type { DialogProps } from "./components/Dialog.spec";

export { LinkSpec } from "./components/Link.spec";
export type { LinkProps } from "./components/Link.spec";

export { PopoverSpec } from "./components/Popover.spec";
export type { PopoverProps } from "./components/Popover.spec";

export { SectionSpec } from "./components/Section.spec";
export type { SectionProps } from "./components/Section.spec";

// ADR-902 후속: Body 는 페이지 루트 theme-aware 배경을 Spec SSOT 로 선언.
export { BodySpec } from "./components/Body.spec";
export type { BodyProps } from "./components/Body.spec";

export { SeparatorSpec } from "./components/Separator.spec";
export type { SeparatorProps } from "./components/Separator.spec";

export { ToggleButtonSpec } from "./components/ToggleButton.spec";
export type { ToggleButtonProps } from "./components/ToggleButton.spec";

export { ToggleButtonGroupSpec } from "./components/ToggleButtonGroup.spec";
export type { ToggleButtonGroupProps } from "./components/ToggleButtonGroup.spec";

export { TooltipSpec, TOOLTIP_MAX_WIDTH } from "./components/Tooltip.spec";
export type { TooltipProps } from "./components/Tooltip.spec";

// ─── Phase 2: Form Components ───────────────────────────────────────────────
export { TextFieldSpec } from "./components/TextField.spec";
export type { TextFieldProps } from "./components/TextField.spec";

export { TextAreaSpec } from "./components/TextArea.spec";
export type { TextAreaProps } from "./components/TextArea.spec";

export { NumberFieldSpec } from "./components/NumberField.spec";
export type { NumberFieldProps } from "./components/NumberField.spec";

export { SearchFieldSpec } from "./components/SearchField.spec";
export type { SearchFieldProps } from "./components/SearchField.spec";

export {
  CheckboxSpec,
  CHECKBOX_CHECKED_COLORS,
} from "./components/Checkbox.spec";
export type { CheckboxProps } from "./components/Checkbox.spec";

export { CheckboxGroupSpec } from "./components/CheckboxGroup.spec";
export type { CheckboxGroupProps } from "./components/CheckboxGroup.spec";

export { CheckboxItemsSpec } from "./components/CheckboxItems.spec";
export type { CheckboxItemsProps } from "./components/CheckboxItems.spec";

export { RadioSpec, RADIO_SELECTED_COLORS } from "./components/Radio.spec";
export type { RadioProps } from "./components/Radio.spec";

export { RadioGroupSpec } from "./components/RadioGroup.spec";
export type { RadioGroupProps } from "./components/RadioGroup.spec";

export { RadioItemsSpec } from "./components/RadioItems.spec";
export type { RadioItemsProps } from "./components/RadioItems.spec";

export {
  SwitchSpec,
  SWITCH_SELECTED_TRACK_COLORS,
} from "./components/Switch.spec";
export type { SwitchProps } from "./components/Switch.spec";

export { FormSpec } from "./components/Form.spec";
export type { FormProps } from "./components/Form.spec";

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

// ListBoxItem (ADR-078 — CSS 자동 생성 전용, Builder Skia 미등록 Q5=i)
export {
  ListBoxItemSpec,
  resolveListBoxItemMetric,
} from "./components/ListBoxItem.spec";
export type { ListBoxItemProps } from "./components/ListBoxItem.spec";

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

export { MeterTrackSpec } from "./components/MeterTrack.spec";
export type { MeterTrackProps } from "./components/MeterTrack.spec";

export { MeterValueSpec } from "./components/MeterValue.spec";
export type { MeterValueProps } from "./components/MeterValue.spec";

export {
  ProgressBarSpec,
  PROGRESSBAR_FILL_COLORS,
  PROGRESSBAR_DIMENSIONS,
} from "./components/ProgressBar.spec";
export type { ProgressBarProps } from "./components/ProgressBar.spec";

export { ProgressBarTrackSpec } from "./components/ProgressBarTrack.spec";
export type { ProgressBarTrackProps } from "./components/ProgressBarTrack.spec";

export { ProgressBarValueSpec } from "./components/ProgressBarValue.spec";
export type { ProgressBarValueProps } from "./components/ProgressBarValue.spec";

// ─── Phase 3: Composite Components ──────────────────────────────────────────
export { TableSpec } from "./components/Table.spec";
export type {
  TableProps,
  TableColumn,
  TableRow,
} from "./components/Table.spec";

export { TreeSpec } from "./components/Tree.spec";
export type { TreeProps } from "./components/Tree.spec";

export { TabsSpec } from "./components/Tabs.spec";
export type { TabsProps, TabItem } from "./components/Tabs.spec";
export { TabListSpec } from "./components/TabList.spec";
export type { TabListProps } from "./components/TabList.spec";
export { TabPanelsSpec } from "./components/TabPanels.spec";
export type { TabPanelsProps } from "./components/TabPanels.spec";
export { TabPanelSpec } from "./components/TabPanel.spec";
export type { TabPanelProps } from "./components/TabPanel.spec";
export { TabSpec } from "./components/Tab.spec";
export type { TabProps } from "./components/Tab.spec";

export { MenuSpec } from "./components/Menu.spec";
export type { MenuProps } from "./components/Menu.spec";

export { MenuItemSpec } from "./components/MenuItem.spec";
export type { MenuItemProps } from "./components/MenuItem.spec";

export { BreadcrumbsSpec } from "./components/Breadcrumbs.spec";
export type { BreadcrumbsProps } from "./components/Breadcrumbs.spec";
export { BreadcrumbSpec } from "./components/Breadcrumb.spec";
export type { BreadcrumbItemProps } from "./components/Breadcrumb.spec";

export { PaginationSpec } from "./components/Pagination.spec";
export type { PaginationProps } from "./components/Pagination.spec";

export { TagGroupSpec } from "./components/TagGroup.spec";
export type { TagGroupProps } from "./components/TagGroup.spec";

export { TagListSpec, TAG_CHIP_SIZES } from "./components/TagList.spec";
export type { TagListProps } from "./components/TagList.spec";

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

export {
  GridListItemSpec,
  resolveGridListItemMetric,
} from "./components/GridListItem.spec";
export type { GridListItemProps } from "./components/GridListItem.spec";

export { DisclosureSpec } from "./components/Disclosure.spec";
export type { DisclosureProps } from "./components/Disclosure.spec";

export { DisclosureGroupSpec } from "./components/DisclosureGroup.spec";
export type { DisclosureGroupProps } from "./components/DisclosureGroup.spec";

export { ToolbarSpec } from "./components/Toolbar.spec";
export type { ToolbarProps } from "./components/Toolbar.spec";

export { ToastSpec } from "./components/Toast.spec";
export type { ToastProps } from "./components/Toast.spec";

export { GroupSpec } from "./components/Group.spec";
export type { GroupProps } from "./components/Group.spec";

// Frame — ADR-130: canonical layout container
export { FrameSpec } from "./components/Frame.spec";
export type { FrameProps } from "./components/Frame.spec";

export { SlotSpec } from "./components/Slot.spec";
export type { SlotProps } from "./components/Slot.spec";

export { SkeletonSpec } from "./components/Skeleton.spec";
export type { SkeletonProps } from "./components/Skeleton.spec";

export { DropZoneSpec } from "./components/DropZone.spec";
export type { DropZoneProps } from "./components/DropZone.spec";

export { FileTriggerSpec } from "./components/FileTrigger.spec";
export type { FileTriggerProps } from "./components/FileTrigger.spec";

export { MaskedFrameSpec } from "./components/MaskedFrame.spec";
export type { MaskedFrameProps } from "./components/MaskedFrame.spec";

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

export { TimeFieldSpec } from "./components/TimeField.spec";
export type { TimeFieldProps } from "./components/TimeField.spec";

export { DateInputSpec } from "./components/DateInput.spec";
export type { DateInputProps } from "./components/DateInput.spec";

export { CalendarSpec } from "./components/Calendar.spec";
export type { CalendarProps } from "./components/Calendar.spec";

export { CalendarHeaderSpec } from "./components/CalendarHeader.spec";
export type { CalendarHeaderProps } from "./components/CalendarHeader.spec";

export { CalendarGridSpec } from "./components/CalendarGrid.spec";
export type { CalendarGridProps } from "./components/CalendarGrid.spec";

export { RangeCalendarSpec } from "./components/RangeCalendar.spec";
export type { RangeCalendarProps } from "./components/RangeCalendar.spec";

export { ColorPickerSpec } from "./components/ColorPicker.spec";
export type { ColorPickerProps } from "./components/ColorPicker.spec";

export { ColorFieldSpec } from "./components/ColorField.spec";
export type { ColorFieldProps } from "./components/ColorField.spec";

export { ColorSliderSpec } from "./components/ColorSlider.spec";
export type { ColorSliderProps } from "./components/ColorSlider.spec";

export { ColorAreaSpec } from "./components/ColorArea.spec";
export type { ColorAreaProps } from "./components/ColorArea.spec";

export { ColorWheelSpec } from "./components/ColorWheel.spec";
export type { ColorWheelProps } from "./components/ColorWheel.spec";

export { ColorSwatchSpec } from "./components/ColorSwatch.spec";
export type { ColorSwatchProps } from "./components/ColorSwatch.spec";

export { ColorSwatchPickerSpec } from "./components/ColorSwatchPicker.spec";
export type { ColorSwatchPickerProps } from "./components/ColorSwatchPicker.spec";

export { ListSpec } from "./components/List.spec";
export type { ListProps } from "./components/List.spec";

export { InputSpec } from "./components/Input.spec";
export type { InputProps } from "./components/Input.spec";

export { SwitcherSpec } from "./components/Switcher.spec";
export type { SwitcherProps } from "./components/Switcher.spec";

export { NavSpec } from "./components/Nav.spec";
export type { NavProps } from "./components/Nav.spec";

// ─── Phase 5: Child Composition Specs (Compositional 전환) ─────────────────
export { LabelSpec } from "./components/Label.spec";
export type { LabelProps } from "./components/Label.spec";

export { FieldErrorSpec } from "./components/FieldError.spec";
export type { FieldErrorProps } from "./components/FieldError.spec";

export { HeadingSpec } from "./components/Heading.spec";
export type { HeadingProps } from "./components/Heading.spec";

export { ParagraphSpec } from "./components/Paragraph.spec";
export type { ParagraphProps } from "./components/Paragraph.spec";

export { KbdSpec } from "./components/Kbd.spec";
export type { KbdProps } from "./components/Kbd.spec";

export { CodeSpec } from "./components/Code.spec";
export type { CodeProps } from "./components/Code.spec";

export { DisclosureHeaderSpec } from "./components/DisclosureHeader.spec";
export type { DisclosureHeaderProps } from "./components/DisclosureHeader.spec";

export { DisclosureContentSpec } from "./components/DisclosureContent.spec";
export type { DisclosureContentProps } from "./components/DisclosureContent.spec";

export { DescriptionSpec } from "./components/Description.spec";
export type { DescriptionProps } from "./components/Description.spec";

export { SliderTrackSpec } from "./components/SliderTrack.spec";
export type { SliderTrackProps } from "./components/SliderTrack.spec";

export { SliderThumbSpec } from "./components/SliderThumb.spec";
export type { SliderThumbProps } from "./components/SliderThumb.spec";

export { SliderOutputSpec } from "./components/SliderOutput.spec";
export type { SliderOutputProps } from "./components/SliderOutput.spec";

export { DateSegmentSpec } from "./components/DateSegment.spec";
export type {
  DateSegmentProps,
  DateSegmentType,
} from "./components/DateSegment.spec";

export { IconSpec } from "./components/Icon.spec";
export type { IconProps } from "./components/Icon.spec";

export { SelectTriggerSpec } from "./components/SelectTrigger.spec";
export type { SelectTriggerProps } from "./components/SelectTrigger.spec";

export { SelectValueSpec } from "./components/SelectValue.spec";
export type { SelectValueProps } from "./components/SelectValue.spec";

export { SelectIconSpec } from "./components/SelectIcon.spec";
export type { SelectIconProps } from "./components/SelectIcon.spec";

// ─── Phase 6: ADR-030 New Components ────────────────────────────────────────
export { AvatarSpec } from "./components/Avatar.spec";
export type { AvatarProps } from "./components/Avatar.spec";

export { AvatarGroupSpec } from "./components/AvatarGroup.spec";
export type { AvatarGroupProps } from "./components/AvatarGroup.spec";

export {
  StatusLightSpec,
  STATUSLIGHT_DIMENSIONS,
} from "./components/StatusLight.spec";
export type { StatusLightProps } from "./components/StatusLight.spec";

export { InlineAlertSpec } from "./components/InlineAlert.spec";
export type { InlineAlertProps } from "./components/InlineAlert.spec";

// ─── Phase 6: ADR-030 Phase 2 Components ────────────────────────────────────
export { ButtonGroupSpec } from "./components/ButtonGroup.spec";
export type { ButtonGroupProps } from "./components/ButtonGroup.spec";

// ─── Phase 7: ADR-030 Phase 3 Extended Controls ─────────────────────────────
export {
  ProgressCircleSpec,
  PROGRESSCIRCLE_FILL_COLORS,
  PROGRESSCIRCLE_DIMENSIONS,
} from "./components/ProgressCircle.spec";
export type { ProgressCircleProps } from "./components/ProgressCircle.spec";

export { ImageSpec, IMAGE_DIMENSIONS } from "./components/Image.spec";
export type { ImageProps } from "./components/Image.spec";

// ─── Phase 8: ADR-030 Phase 4 Advanced Components ────────────────────────────
export {
  IllustratedMessageSpec,
  ILLUSTRATION_DIMENSIONS,
} from "./components/IllustratedMessage.spec";
export type { IllustratedMessageProps } from "./components/IllustratedMessage.spec";

export { CardViewSpec, CARDVIEW_DENSITY_GAP } from "./components/CardView.spec";
export type { CardViewProps } from "./components/CardView.spec";

export {
  TableViewSpec,
  TABLEVIEW_ROW_HEIGHTS,
} from "./components/TableView.spec";
export type { TableViewProps } from "./components/TableView.spec";

// Properties-only Specs
export { AutocompleteSpec } from "./components/Autocomplete.spec";
export { FieldSpec } from "./components/Field.spec";
export { AccordionSpec } from "./components/Accordion.spec";
export { ModalSpec } from "./components/Modal.spec";
export { TailSwatchSpec } from "./components/TailSwatch.spec";

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
