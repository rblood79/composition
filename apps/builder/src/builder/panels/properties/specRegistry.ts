import type { ComponentSpec } from "@composition/specs";
import {
  AccordionSpec,
  AvatarSpec,
  CardSpec,
  AvatarGroupSpec,
  BadgeSpec,
  BreadcrumbsSpec,
  BreadcrumbSpec,
  ButtonSpec,
  ButtonGroupSpec,
  CalendarSpec,
  CardViewSpec,
  CheckboxSpec,
  CheckboxGroupSpec,
  ColorAreaSpec,
  ColorFieldSpec,
  ColorPickerSpec,
  ColorSliderSpec,
  ColorSwatchSpec,
  ColorSwatchPickerSpec,
  ColorWheelSpec,
  ComboBoxSpec,
  DateFieldSpec,
  DatePickerSpec,
  DateRangePickerSpec,
  DialogSpec,
  DisclosureSpec,
  DisclosureGroupSpec,
  DisclosureHeaderSpec,
  DropZoneSpec,
  FieldSpec,
  FileTriggerSpec,
  FormSpec,
  GridListSpec,
  GroupSpec,
  IconSpec,
  IllustratedMessageSpec,
  ImageSpec,
  InlineAlertSpec,
  ListBoxSpec,
  MenuSpec,
  MeterSpec,
  ModalSpec,
  NavSpec,
  NumberFieldSpec,
  PopoverSpec,
  ProgressBarSpec,
  // ADR-912 단계5: ProgressCircleSpec 삭제 (catalog binding.accepts 가 D2 properties 대체)
  RadioSpec,
  RadioGroupSpec,
  SearchFieldSpec,
  SelectSpec,
  SeparatorSpec,
  SliderSpec,
  SlotSpec,
  StatusLightSpec,
  SwitchSpec,
  TailSwatchSpec,
  TableViewSpec,
  TagGroupSpec,
  TabsSpec,
  TabListSpec,
  TabPanelsSpec,
  TabPanelSpec,
  TextAreaSpec,
  TextFieldSpec,
  TimeFieldSpec,
  ToastSpec,
  ToggleButtonSpec,
  ToggleButtonGroupSpec,
  ToolbarSpec,
  TooltipSpec,
  TreeSpec,
  TreeItemSpec,
  RangeCalendarSpec,
} from "@composition/specs";

/**
 * ADR-041 Property Editor spec registry.
 *
 * 전체 TAG → Spec 매핑. GenericPropertyEditor가 이 레지스트리를 참조하여
 * Spec의 properties 정의에 따라 속성 에디터를 자동 생성한다.
 */
export const PROPERTY_EDITOR_SPEC_MAP: Record<
  string,
  ComponentSpec<Record<string, unknown>>
> = {
  Accordion: AccordionSpec as ComponentSpec<Record<string, unknown>>,
  Avatar: AvatarSpec as ComponentSpec<Record<string, unknown>>,
  AvatarGroup: AvatarGroupSpec as ComponentSpec<Record<string, unknown>>,
  Badge: BadgeSpec as ComponentSpec<Record<string, unknown>>,
  Breadcrumbs: BreadcrumbsSpec as ComponentSpec<Record<string, unknown>>,
  Breadcrumb: BreadcrumbSpec as ComponentSpec<Record<string, unknown>>,
  Button: ButtonSpec as ComponentSpec<Record<string, unknown>>,
  ButtonGroup: ButtonGroupSpec as ComponentSpec<Record<string, unknown>>,
  Calendar: CalendarSpec as ComponentSpec<Record<string, unknown>>,
  Card: CardSpec as ComponentSpec<Record<string, unknown>>,
  CardView: CardViewSpec as ComponentSpec<Record<string, unknown>>,
  Checkbox: CheckboxSpec as ComponentSpec<Record<string, unknown>>,
  CheckboxGroup: CheckboxGroupSpec as ComponentSpec<Record<string, unknown>>,
  ColorArea: ColorAreaSpec as ComponentSpec<Record<string, unknown>>,
  ColorField: ColorFieldSpec as ComponentSpec<Record<string, unknown>>,
  ColorPicker: ColorPickerSpec as ComponentSpec<Record<string, unknown>>,
  ColorSlider: ColorSliderSpec as ComponentSpec<Record<string, unknown>>,
  ColorSwatch: ColorSwatchSpec as ComponentSpec<Record<string, unknown>>,
  ColorSwatchPicker: ColorSwatchPickerSpec as ComponentSpec<
    Record<string, unknown>
  >,
  ColorWheel: ColorWheelSpec as ComponentSpec<Record<string, unknown>>,
  ComboBox: ComboBoxSpec as ComponentSpec<Record<string, unknown>>,
  DateField: DateFieldSpec as ComponentSpec<Record<string, unknown>>,
  DatePicker: DatePickerSpec as ComponentSpec<Record<string, unknown>>,
  DateRangePicker: DateRangePickerSpec as ComponentSpec<
    Record<string, unknown>
  >,
  Dialog: DialogSpec as ComponentSpec<Record<string, unknown>>,
  Disclosure: DisclosureSpec as ComponentSpec<Record<string, unknown>>,
  DisclosureGroup: DisclosureGroupSpec as ComponentSpec<
    Record<string, unknown>
  >,
  DisclosureHeader: DisclosureHeaderSpec as ComponentSpec<
    Record<string, unknown>
  >,
  // ADR-912 단계5 — DisclosureContentSpec 삭제: 시각 SSOT 는 componentRulesTable.DisclosureContent
  //   (catalog rule). Skia=buildCatalogShapes(box+text generic), DOM=renderDisclosureContent
  //   (rendererMap 위임). spec 의존 끊김 (Description 동형).
  DropZone: DropZoneSpec as ComponentSpec<Record<string, unknown>>,
  Field: FieldSpec as ComponentSpec<Record<string, unknown>>,
  FileTrigger: FileTriggerSpec as ComponentSpec<Record<string, unknown>>,
  Form: FormSpec as ComponentSpec<Record<string, unknown>>,
  GridList: GridListSpec as ComponentSpec<Record<string, unknown>>,
  Group: GroupSpec as ComponentSpec<Record<string, unknown>>,
  Icon: IconSpec as ComponentSpec<Record<string, unknown>>,
  IllustratedMessage: IllustratedMessageSpec as ComponentSpec<
    Record<string, unknown>
  >,
  Image: ImageSpec as ComponentSpec<Record<string, unknown>>,
  InlineAlert: InlineAlertSpec as ComponentSpec<Record<string, unknown>>,
  // Link — ADR-912 단계5 step5: catalog cutover → GenericPropertyEditor 가 binding.accepts
  //   (Link.binding.ts) 로 properties 생성(spec.properties dead). spec 삭제로 등록 제거.
  ListBox: ListBoxSpec as ComponentSpec<Record<string, unknown>>,
  Menu: MenuSpec as ComponentSpec<Record<string, unknown>>,
  Meter: MeterSpec as ComponentSpec<Record<string, unknown>>,
  Modal: ModalSpec as ComponentSpec<Record<string, unknown>>,
  Nav: NavSpec as ComponentSpec<Record<string, unknown>>,
  NumberField: NumberFieldSpec as ComponentSpec<Record<string, unknown>>,
  Popover: PopoverSpec as ComponentSpec<Record<string, unknown>>,
  ProgressBar: ProgressBarSpec as ComponentSpec<Record<string, unknown>>,
  // ADR-912 단계5: ProgressCircle 제거 — cutover type 은 GenericPropertyEditor 가
  //   binding.accepts(PropContract) 로 D2 properties 생성 (spec.properties dead)
  Radio: RadioSpec as ComponentSpec<Record<string, unknown>>,
  RadioGroup: RadioGroupSpec as ComponentSpec<Record<string, unknown>>,
  SearchField: SearchFieldSpec as ComponentSpec<Record<string, unknown>>,
  Select: SelectSpec as ComponentSpec<Record<string, unknown>>,
  Separator: SeparatorSpec as ComponentSpec<Record<string, unknown>>,
  Slider: SliderSpec as ComponentSpec<Record<string, unknown>>,
  Slot: SlotSpec as ComponentSpec<Record<string, unknown>>,
  StatusLight: StatusLightSpec as ComponentSpec<Record<string, unknown>>,
  Switch: SwitchSpec as ComponentSpec<Record<string, unknown>>,
  TailSwatch: TailSwatchSpec as ComponentSpec<Record<string, unknown>>,
  TableView: TableViewSpec as ComponentSpec<Record<string, unknown>>,
  TagGroup: TagGroupSpec as ComponentSpec<Record<string, unknown>>,
  Tabs: TabsSpec as ComponentSpec<Record<string, unknown>>,
  TabList: TabListSpec as ComponentSpec<Record<string, unknown>>,
  TabPanels: TabPanelsSpec as ComponentSpec<Record<string, unknown>>,
  TabPanel: TabPanelSpec as ComponentSpec<Record<string, unknown>>,
  TextArea: TextAreaSpec as ComponentSpec<Record<string, unknown>>,
  TextField: TextFieldSpec as ComponentSpec<Record<string, unknown>>,
  TimeField: TimeFieldSpec as ComponentSpec<Record<string, unknown>>,
  Toast: ToastSpec as ComponentSpec<Record<string, unknown>>,
  ToggleButton: ToggleButtonSpec as ComponentSpec<Record<string, unknown>>,
  ToggleButtonGroup: ToggleButtonGroupSpec as ComponentSpec<
    Record<string, unknown>
  >,
  Toolbar: ToolbarSpec as ComponentSpec<Record<string, unknown>>,
  Tooltip: TooltipSpec as ComponentSpec<Record<string, unknown>>,
  Tree: TreeSpec as ComponentSpec<Record<string, unknown>>,
  TreeItem: TreeItemSpec as ComponentSpec<Record<string, unknown>>,
  RangeCalendar: RangeCalendarSpec as ComponentSpec<Record<string, unknown>>,
};

export function getPropertyEditorSpec(
  type: string,
): ComponentSpec<Record<string, unknown>> | null {
  return PROPERTY_EDITOR_SPEC_MAP[type] ?? null;
}
