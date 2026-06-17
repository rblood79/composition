import type { ComponentSpec } from "@composition/specs";
import {
  // ADR-912 단계5 step4 Phase 1 batch 1 (2026-06-16): AvatarSpec import 제거 — catalog cutover,
  //   binding.accepts D2 (GenericPropertyEditor 가 properties 생성).
  // ADR-912 R7 G1-a (2026-06-15): AvatarGroupSpec import 제거 — catalog cutover, binding.accepts D2.
  // ADR-912 box+text leaf 군 (2026-06-11): Badge/Button/ToggleButton/Separator/StatusLight/Icon
  //   Spec import 제거 — catalog binding.accepts 가 D2 properties 대체(Link 선례, spec.properties dead).
  // ADR-912 단계5 step4 (2026-06-16): BreadcrumbsSpec import 제거 — catalog cutover, spec 삭제. binding.accepts D2.
  // ADR-912 projection 3 cutover (2026-06-15): BreadcrumbSpec import 제거 — catalog cutover, binding.accepts D2.
  // ADR-912 R7 G1-c (2026-06-15): ButtonGroupSpec import 제거 — catalog cutover, binding.accepts D2.
  // ADR-912 단계5 step4 date-color (2026-06-16): CalendarSpec import 제거 — catalog cutover, binding.accepts D2.
  // ADR-912 R7 G1-b (2026-06-15): CardViewSpec import 제거 — catalog cutover, binding.accepts D2.
  // ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): CheckboxSpec import 제거 — catalog cutover, binding.accepts D2.
  // ADR-912 6 registry collapse — Color leaf 5종 box-only cutover (2026-06-11): ColorArea/ColorWheel/
  //   ColorSlider/ColorSwatch/TailSwatch Spec import 제거 — catalog binding.accepts 가 D2 properties
  //   대체(Link/Disclosure 선례). ColorField/ColorPicker/ColorSwatchPicker(field/container)는 보존.
  ColorPickerSpec,
  ColorSwatchPickerSpec,
  ComboBoxSpec,
  DateFieldSpec,
  // ADR-912 단계5 step4 date-color (2026-06-17): DatePicker/DateRangePickerSpec import 제거 — spec 물리 삭제.
  //   Property Panel 은 binding.accepts(DatePicker.binding.ts) 구동(DEAD getEditor 경로, entry 동시 제거).
  // ADR-912 단계5 step4 Dialog 단건 (2026-06-16): DialogSpec import 제거 — catalog cutover, binding.accepts D2.
  // ADR-912 단계5 step4 Phase 1 batch 2 (2026-06-16): DropZoneSpec import 제거 — catalog cutover,
  //   GenericPropertyEditor 가 binding.accepts(DropZone.binding.ts)로 properties 생성.
  // ADR-912 단계5 step4 trivial 그룹 (2026-06-16): FieldSpec import 제거 — catalog cutover, binding.accepts D2.
  // ADR-912 단계5 step4 경량 이관 (2026-06-17): GridListSpec import 제거 — catalog cutover, binding.accepts D2 (dead getEditor 경로).
  GroupSpec,
  // ADR-912 단계5 step4 type-augment 그룹 (2026-06-16): IllustratedMessageSpec import 제거 — catalog cutover, binding.accepts D2.
  ImageSpec,
  InlineAlertSpec,
  ListBoxSpec,
  // ADR-912 단계5 step4 경량 이관 (2026-06-17): MenuSpec import 제거 — catalog cutover, binding.accepts D2 (dead getEditor 경로).
  // ADR-912 단계5 step4 경량 이관 (2026-06-17): MeterSpec import 제거 — catalog cutover, binding.accepts D2 (dead getEditor 경로).
  // ADR-912 단계5 step4 small-B (2026-06-16): ModalSpec import 제거 — catalog cutover, binding.accepts D2.
  // ADR-912 단계5 step4 Popover 단건 (2026-06-16): PopoverSpec import 제거 — catalog cutover, binding.accepts D2.
  // ADR-912 단계5 step4 경량 이관 (2026-06-17): ProgressBarSpec import 제거 — catalog cutover, binding.accepts D2 (dead getEditor 경로).
  // ADR-912 단계5: ProgressCircleSpec 삭제 (catalog binding.accepts 가 D2 properties 대체)
  // ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): RadioSpec/SwitchSpec import 제거 — catalog cutover, binding.accepts D2.
  SelectSpec,
  SliderSpec,
  SlotSpec,
  // ADR-912 R7 G1-b (2026-06-15): TableViewSpec import 제거 — catalog cutover, binding.accepts D2.
  TagGroupSpec,
  // ADR-912 단계5 step4 (2026-06-17): TabsSpec import 제거 — catalog cutover, spec 삭제. binding.accepts D2.
  // ADR-912 projection 3 cutover (2026-06-15): TabListSpec import 제거 — catalog cutover, binding.accepts D2.
  // ADR-912 R7 G1-c (2026-06-15): ToastSpec import 제거 — 순수 box-shell catalog cutover, binding.accepts D2.
  // ADR-912 단계5 step4 type-augment 그룹 (2026-06-16): ToggleButtonGroupSpec import 제거 — catalog cutover, binding.accepts D2.
  // ADR-912 단계5 step4 Tooltip 단건 (2026-06-16): TooltipSpec import 제거 — catalog cutover, binding.accepts D2.
  // ADR-912 단계5 step4 trivial 그룹 (2026-06-16): TreeSpec import 제거 — catalog cutover, binding.accepts D2.
  // TreeItemSpec — ADR-912 R1 후속 (2026-06-12): catalog cutover, spec 삭제.
  //   binding.accepts(children/size)가 D2 properties 대체(Select/DisclosureHeader 선례).
  // ADR-912 단계5 step4 date-color (2026-06-16): RangeCalendarSpec import 제거 — catalog cutover, binding.accepts D2.
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
  // ADR-912 단계5 step4 Phase 1 batch 1 (2026-06-16): Avatar catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(Avatar.binding.ts)로 properties 생성.
  // ADR-912 R7 G1-a (2026-06-15): AvatarGroup catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(AvatarGroup.binding.ts)로 properties 생성.
  // ADR-912 단계5 step4 (2026-06-16): Breadcrumbs catalog cutover → entry 제거. spec 삭제.
  //   Property Panel = binding.accepts(Breadcrumbs.binding.ts) via resolveEditContract (CatalogEditContractEditor).
  // ADR-912 projection 3 cutover (2026-06-15): Breadcrumb catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(Breadcrumb.binding.ts)로 properties 생성.
  // ADR-912 R7 G1-c (2026-06-15): ButtonGroup catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(ButtonGroup.binding.ts)로 properties 생성.
  // Calendar — ADR-912 단계5 step4 date-color (2026-06-16): catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(Calendar.binding.ts)로 D2 properties 생성.
  // ADR-912 R6/R7 G1-b (2026-06-15): Card 본체 + CardView catalog cutover → CardSpec/CardViewSpec
  //   import + entry 제거. GenericPropertyEditor 가 catalog binding.accepts 로 properties 생성
  //   (Select/Disclosure 선례, spec.properties dead).
  // Checkbox — ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(Checkbox.binding.ts)로 properties 생성.
  // ADR-912 6 registry collapse — ColorArea/ColorWheel/ColorSlider/ColorSwatch box-only cutover
  //   (2026-06-11): GenericPropertyEditor 가 catalog binding.accepts 로 properties 생성(spec.properties
  //   dead). ColorField/ColorPicker/ColorSwatchPicker(field/container)는 보존.
  ColorPicker: ColorPickerSpec as ComponentSpec<Record<string, unknown>>,
  ColorSwatchPicker: ColorSwatchPickerSpec as ComponentSpec<
    Record<string, unknown>
  >,
  ComboBox: ComboBoxSpec as ComponentSpec<Record<string, unknown>>,
  DateField: DateFieldSpec as ComponentSpec<Record<string, unknown>>,
  // DatePicker/DateRangePicker — ADR-912 단계5 step4 date-color (2026-06-17): spec 물리 삭제 → entry 제거.
  //   Property Panel 은 binding.accepts(DatePicker.binding.ts) 구동(DEAD getEditor 경로).
  // Dialog — ADR-912 단계5 step4 Dialog 단건 (2026-06-16): catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(Dialog.binding.ts)로 properties 생성.
  // ADR-912 Disclosure 군 일괄 cutover (2026-06-10) — Disclosure/DisclosureGroup/DisclosureHeader/
  //   DisclosureContent spec 삭제. 시각 SSOT = componentRulesTable 의 4 catalog rule.
  //   Skia=buildCatalogShapes generic, DOM=rendererMap 위임. spec 의존 끊김 (Description 동형).
  // DropZone — ADR-912 단계5 step4 Phase 1 batch 2 (2026-06-16): catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(DropZone.binding.ts)로 properties 생성.
  // Field — ADR-912 단계5 step4 trivial 그룹 (2026-06-16): catalog cutover → entry 제거 (binding.accepts D2).
  // GridList — ADR-912 단계5 step4 경량 이관 (2026-06-17): catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(GridList.binding.ts)로 properties 생성 (dead getEditor 경로).
  Group: GroupSpec as ComponentSpec<Record<string, unknown>>,
  // IllustratedMessage — ADR-912 단계5 step4 type-augment 그룹 (2026-06-16): catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(IllustratedMessage.binding.ts)로 properties 생성.
  Image: ImageSpec as ComponentSpec<Record<string, unknown>>,
  InlineAlert: InlineAlertSpec as ComponentSpec<Record<string, unknown>>,
  // Link — ADR-912 단계5 step5: catalog cutover → GenericPropertyEditor 가 binding.accepts
  //   (Link.binding.ts) 로 properties 생성(spec.properties dead). spec 삭제로 등록 제거.
  ListBox: ListBoxSpec as ComponentSpec<Record<string, unknown>>,
  // Menu — ADR-912 단계5 step4 경량 이관 (2026-06-17): catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(Menu.binding.ts)로 properties 생성 (dead getEditor 경로).
  // Meter — ADR-912 단계5 step4 경량 이관 (2026-06-17): catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(Meter.binding.ts)로 properties 생성 (dead getEditor 경로).
  // Modal — ADR-912 단계5 step4 small-B (2026-06-16): catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(Modal.binding.ts)로 properties 생성.
  // Nav — ADR-912 container shell catalog 완결: catalog cutover → GenericPropertyEditor 가
  //   binding.accepts (Nav.binding.ts: aria-label/variant/size) 로 properties 생성. spec 삭제로 등록 제거.
  // Popover — ADR-912 단계5 step4 Popover 단건 (2026-06-16): catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(Popover.binding.ts: variant/size/placement/offset/
  //   crossOffset/containerPadding/shouldFlip)로 D2 properties 생성. spec.properties dead.
  // ProgressBar — ADR-912 단계5 step4 경량 이관 (2026-06-17): catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(ProgressBar.binding.ts)로 properties 생성 (dead getEditor 경로).
  // ADR-912 단계5: ProgressCircle 제거 — cutover type 은 GenericPropertyEditor 가
  //   binding.accepts(PropContract) 로 D2 properties 생성 (spec.properties dead)
  // Radio/Switch — ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(Radio/Switch.binding.ts)로 properties 생성.
  Select: SelectSpec as ComponentSpec<Record<string, unknown>>,
  Slider: SliderSpec as ComponentSpec<Record<string, unknown>>,
  Slot: SlotSpec as ComponentSpec<Record<string, unknown>>,
  // ADR-912 6 registry collapse — TailSwatch box-only cutover (2026-06-11): catalog binding.accepts
  //   가 D2 properties 대체. ColorPicker alias placeholder 는 catalog rule box 시각 유지.
  // ADR-912 R7 G1-b (2026-06-15): TableView catalog cutover → entry 제거 (binding.accepts D2).
  TagGroup: TagGroupSpec as ComponentSpec<Record<string, unknown>>,
  // ADR-912 단계5 step4 (2026-06-17): Tabs catalog cutover → entry 제거 (binding.accepts D2). spec 삭제.
  // ADR-912 projection 3 cutover (2026-06-15): TabList catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(TabList.binding.ts)로 properties 생성.
  // ADR-912 R7 G1-c (2026-06-15): Toast 순수 box-shell catalog cutover → entry 제거 (binding.accepts D2).
  // ToggleButtonGroup — ADR-912 단계5 step4 type-augment 그룹 (2026-06-16): catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(ToggleButtonGroup.binding.ts)로 properties 생성.
  // Tooltip — ADR-912 단계5 step4 Tooltip 단건 (2026-06-16): catalog cutover → entry 제거.
  //   GenericPropertyEditor 가 binding.accepts(Tooltip.binding.ts)로 properties 생성.
  // Tree — ADR-912 단계5 step4 trivial 그룹 (2026-06-16): catalog cutover → entry 제거 (binding.accepts D2).
  // TreeItem — ADR-912 R1 후속 (2026-06-12): catalog cutover, specRegistry 제거 (binding.accepts 대체)
  // RangeCalendar — ADR-912 단계5 step4 date-color (2026-06-16): catalog cutover → entry 제거 (binding.accepts D2).
};

export function getPropertyEditorSpec(
  type: string,
): ComponentSpec<Record<string, unknown>> | null {
  return PROPERTY_EDITOR_SPEC_MAP[type] ?? null;
}
