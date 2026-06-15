import type { ComponentSpec } from "@composition/specs";
import {
  AvatarSpec,
  // ADR-912 R7 G1-a (2026-06-15): AvatarGroupSpec import 제거 — catalog cutover, binding.accepts D2.
  // ADR-912 box+text leaf 군 (2026-06-11): Badge/Button/ToggleButton/Separator/StatusLight/Icon
  //   Spec import 제거 — catalog binding.accepts 가 D2 properties 대체(Link 선례, spec.properties dead).
  BreadcrumbsSpec,
  BreadcrumbSpec,
  ButtonGroupSpec,
  CalendarSpec,
  // ADR-912 R7 G1-b (2026-06-15): CardViewSpec import 제거 — catalog cutover, binding.accepts D2.
  CheckboxSpec,
  CheckboxGroupSpec,
  // ADR-912 6 registry collapse — Color leaf 5종 box-only cutover (2026-06-11): ColorArea/ColorWheel/
  //   ColorSlider/ColorSwatch/TailSwatch Spec import 제거 — catalog binding.accepts 가 D2 properties
  //   대체(Link/Disclosure 선례). ColorField/ColorPicker/ColorSwatchPicker(field/container)는 보존.
  ColorFieldSpec,
  ColorPickerSpec,
  ColorSwatchPickerSpec,
  ComboBoxSpec,
  DateFieldSpec,
  DatePickerSpec,
  DateRangePickerSpec,
  DialogSpec,
  DropZoneSpec,
  FieldSpec,
  FileTriggerSpec,
  FormSpec,
  GridListSpec,
  GroupSpec,
  IllustratedMessageSpec,
  ImageSpec,
  InlineAlertSpec,
  ListBoxSpec,
  MenuSpec,
  MeterSpec,
  ModalSpec,
  NumberFieldSpec,
  PopoverSpec,
  ProgressBarSpec,
  // ADR-912 단계5: ProgressCircleSpec 삭제 (catalog binding.accepts 가 D2 properties 대체)
  RadioSpec,
  RadioGroupSpec,
  SearchFieldSpec,
  SelectSpec,
  SliderSpec,
  SlotSpec,
  SwitchSpec,
  // ADR-912 R7 G1-b (2026-06-15): TableViewSpec import 제거 — catalog cutover, binding.accepts D2.
  TagGroupSpec,
  TabsSpec,
  TabListSpec,
  TextAreaSpec,
  TextFieldSpec,
  TimeFieldSpec,
  ToastSpec,
  ToggleButtonGroupSpec,
  ToolbarSpec,
  TooltipSpec,
  TreeSpec,
  // TreeItemSpec — ADR-912 R1 후속 (2026-06-12): catalog cutover, spec 삭제.
  //   binding.accepts(children/size)가 D2 properties 대체(Select/DisclosureHeader 선례).
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
  Avatar: AvatarSpec as ComponentSpec<Record<string, unknown>>,
  // ADR-912 R7 G1-a (2026-06-15): AvatarGroup catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(AvatarGroup.binding.ts)로 properties 생성.
  Breadcrumbs: BreadcrumbsSpec as ComponentSpec<Record<string, unknown>>,
  Breadcrumb: BreadcrumbSpec as ComponentSpec<Record<string, unknown>>,
  ButtonGroup: ButtonGroupSpec as ComponentSpec<Record<string, unknown>>,
  Calendar: CalendarSpec as ComponentSpec<Record<string, unknown>>,
  // ADR-912 R6/R7 G1-b (2026-06-15): Card 본체 + CardView catalog cutover → CardSpec/CardViewSpec
  //   import + entry 제거. GenericPropertyEditor 가 catalog binding.accepts 로 properties 생성
  //   (Select/Disclosure 선례, spec.properties dead).
  Checkbox: CheckboxSpec as ComponentSpec<Record<string, unknown>>,
  CheckboxGroup: CheckboxGroupSpec as ComponentSpec<Record<string, unknown>>,
  // ADR-912 6 registry collapse — ColorArea/ColorWheel/ColorSlider/ColorSwatch box-only cutover
  //   (2026-06-11): GenericPropertyEditor 가 catalog binding.accepts 로 properties 생성(spec.properties
  //   dead). ColorField/ColorPicker/ColorSwatchPicker(field/container)는 보존.
  ColorField: ColorFieldSpec as ComponentSpec<Record<string, unknown>>,
  ColorPicker: ColorPickerSpec as ComponentSpec<Record<string, unknown>>,
  ColorSwatchPicker: ColorSwatchPickerSpec as ComponentSpec<
    Record<string, unknown>
  >,
  ComboBox: ComboBoxSpec as ComponentSpec<Record<string, unknown>>,
  DateField: DateFieldSpec as ComponentSpec<Record<string, unknown>>,
  DatePicker: DatePickerSpec as ComponentSpec<Record<string, unknown>>,
  DateRangePicker: DateRangePickerSpec as ComponentSpec<
    Record<string, unknown>
  >,
  Dialog: DialogSpec as ComponentSpec<Record<string, unknown>>,
  // ADR-912 Disclosure 군 일괄 cutover (2026-06-10) — Disclosure/DisclosureGroup/DisclosureHeader/
  //   DisclosureContent spec 삭제. 시각 SSOT = componentRulesTable 의 4 catalog rule.
  //   Skia=buildCatalogShapes generic, DOM=rendererMap 위임. spec 의존 끊김 (Description 동형).
  DropZone: DropZoneSpec as ComponentSpec<Record<string, unknown>>,
  Field: FieldSpec as ComponentSpec<Record<string, unknown>>,
  FileTrigger: FileTriggerSpec as ComponentSpec<Record<string, unknown>>,
  Form: FormSpec as ComponentSpec<Record<string, unknown>>,
  GridList: GridListSpec as ComponentSpec<Record<string, unknown>>,
  Group: GroupSpec as ComponentSpec<Record<string, unknown>>,
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
  // Nav — ADR-912 container shell catalog 완결: catalog cutover → GenericPropertyEditor 가
  //   binding.accepts (Nav.binding.ts: aria-label/variant/size) 로 properties 생성. spec 삭제로 등록 제거.
  NumberField: NumberFieldSpec as ComponentSpec<Record<string, unknown>>,
  Popover: PopoverSpec as ComponentSpec<Record<string, unknown>>,
  ProgressBar: ProgressBarSpec as ComponentSpec<Record<string, unknown>>,
  // ADR-912 단계5: ProgressCircle 제거 — cutover type 은 GenericPropertyEditor 가
  //   binding.accepts(PropContract) 로 D2 properties 생성 (spec.properties dead)
  Radio: RadioSpec as ComponentSpec<Record<string, unknown>>,
  RadioGroup: RadioGroupSpec as ComponentSpec<Record<string, unknown>>,
  SearchField: SearchFieldSpec as ComponentSpec<Record<string, unknown>>,
  Select: SelectSpec as ComponentSpec<Record<string, unknown>>,
  Slider: SliderSpec as ComponentSpec<Record<string, unknown>>,
  Slot: SlotSpec as ComponentSpec<Record<string, unknown>>,
  Switch: SwitchSpec as ComponentSpec<Record<string, unknown>>,
  // ADR-912 6 registry collapse — TailSwatch box-only cutover (2026-06-11): catalog binding.accepts
  //   가 D2 properties 대체. ColorPicker alias placeholder 는 catalog rule box 시각 유지.
  // ADR-912 R7 G1-b (2026-06-15): TableView catalog cutover → entry 제거 (binding.accepts D2).
  TagGroup: TagGroupSpec as ComponentSpec<Record<string, unknown>>,
  Tabs: TabsSpec as ComponentSpec<Record<string, unknown>>,
  TabList: TabListSpec as ComponentSpec<Record<string, unknown>>,
  TextArea: TextAreaSpec as ComponentSpec<Record<string, unknown>>,
  TextField: TextFieldSpec as ComponentSpec<Record<string, unknown>>,
  TimeField: TimeFieldSpec as ComponentSpec<Record<string, unknown>>,
  Toast: ToastSpec as ComponentSpec<Record<string, unknown>>,
  ToggleButtonGroup: ToggleButtonGroupSpec as ComponentSpec<
    Record<string, unknown>
  >,
  Toolbar: ToolbarSpec as ComponentSpec<Record<string, unknown>>,
  Tooltip: TooltipSpec as ComponentSpec<Record<string, unknown>>,
  Tree: TreeSpec as ComponentSpec<Record<string, unknown>>,
  // TreeItem — ADR-912 R1 후속 (2026-06-12): catalog cutover, specRegistry 제거 (binding.accepts 대체)
  RangeCalendar: RangeCalendarSpec as ComponentSpec<Record<string, unknown>>,
};

export function getPropertyEditorSpec(
  type: string,
): ComponentSpec<Record<string, unknown>> | null {
  return PROPERTY_EDITOR_SPEC_MAP[type] ?? null;
}
