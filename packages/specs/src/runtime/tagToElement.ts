/**
 * tagToElement — ADR-058 Pre-Phase 0
 *
 * 컴포넌트 type → HTML 요소 이름 매핑 헬퍼.
 * Preview App의 `resolveHtmlTag` fallback 경로가 이 함수를 호출하여
 * spec registry 기반으로 element를 결정한다.
 *
 * Phase 2부터 **정적 문자열 + 함수형** 양쪽 지원.
 * - 정적: 기존 대다수 spec — 고정 HTML 태그
 * - 함수형: Heading 등 props에 따라 동적으로 태그 결정 (예: level → `h1~h6`)
 *
 * 등록되지 않은 태그는 `type.toLowerCase()` fallback (기존 `resolveHtmlTag` default 동작과 동일).
 */

import type { ComponentSpec } from "../types/spec.types";

// 모든 spec을 import하여 태그 → spec registry 구축.
// apps/builder의 TAG_SPEC_MAP과 유사하나, packages/specs의 내부 concern이며
// Preview DOM element resolution 용도로 한정된다.
import { ButtonSpec } from "../components/Button.spec";
import { BadgeSpec } from "../components/Badge.spec";
import { CardSpec } from "../components/Card.spec";
import { DialogSpec } from "../components/Dialog.spec";
import { PopoverSpec } from "../components/Popover.spec";
import { SeparatorSpec } from "../components/Separator.spec";
import { TextFieldSpec } from "../components/TextField.spec";
import { TextAreaSpec } from "../components/TextArea.spec";
import { NumberFieldSpec } from "../components/NumberField.spec";
import { SearchFieldSpec } from "../components/SearchField.spec";
import { CheckboxSpec } from "../components/Checkbox.spec";
import { CheckboxGroupSpec } from "../components/CheckboxGroup.spec";
import { RadioSpec } from "../components/Radio.spec";
import { RadioGroupSpec } from "../components/RadioGroup.spec";
import { SwitchSpec } from "../components/Switch.spec";
import { FormSpec } from "../components/Form.spec";
import { SelectSpec } from "../components/Select.spec";
import { ComboBoxSpec } from "../components/ComboBox.spec";
import { ListBoxSpec } from "../components/ListBox.spec";
import { SliderSpec } from "../components/Slider.spec";
import { MeterSpec } from "../components/Meter.spec";
import { ProgressBarSpec } from "../components/ProgressBar.spec";
import { TableSpec } from "../components/Table.spec";
import { TreeSpec } from "../components/Tree.spec";
import { TreeItemSpec } from "../components/TreeItem.spec";
import { TabsSpec } from "../components/Tabs.spec";
import { TabListSpec } from "../components/TabList.spec";
import { TabPanelsSpec } from "../components/TabPanels.spec";
import { TabPanelSpec } from "../components/TabPanel.spec";
import { TabSpec } from "../components/Tab.spec";
import { MenuSpec } from "../components/Menu.spec";
import { BreadcrumbsSpec } from "../components/Breadcrumbs.spec";
import { BreadcrumbSpec } from "../components/Breadcrumb.spec";
import { PaginationSpec } from "../components/Pagination.spec";
import { TagGroupSpec } from "../components/TagGroup.spec";
import { TagSpec } from "../components/Tag.spec";
import { GridListSpec } from "../components/GridList.spec";
import { DisclosureSpec } from "../components/Disclosure.spec";
import { DisclosureGroupSpec } from "../components/DisclosureGroup.spec";
import { AccordionSpec } from "../components/Accordion.spec";
import { ModalSpec } from "../components/Modal.spec";
import { FieldSpec } from "../components/Field.spec";
import { TailSwatchSpec } from "../components/TailSwatch.spec";
import { ToolbarSpec } from "../components/Toolbar.spec";
import { ToastSpec } from "../components/Toast.spec";
import { GroupSpec } from "../components/Group.spec";
import { FrameSpec } from "../components/Frame.spec";
import { SlotSpec } from "../components/Slot.spec";
import { SkeletonSpec } from "../components/Skeleton.spec";
import { DropZoneSpec } from "../components/DropZone.spec";
import { FileTriggerSpec } from "../components/FileTrigger.spec";
import { MaskedFrameSpec } from "../components/MaskedFrame.spec";
import { DatePickerSpec } from "../components/DatePicker.spec";
import { DateRangePickerSpec } from "../components/DateRangePicker.spec";
import { DateFieldSpec } from "../components/DateField.spec";
import { TimeFieldSpec } from "../components/TimeField.spec";
import { DateInputSpec } from "../components/DateInput.spec";
import { CalendarSpec } from "../components/Calendar.spec";
import { CalendarHeaderSpec } from "../components/CalendarHeader.spec";
import { CalendarGridSpec } from "../components/CalendarGrid.spec";
import { RangeCalendarSpec } from "../components/RangeCalendar.spec";
import { ColorPickerSpec } from "../components/ColorPicker.spec";
import { ColorFieldSpec } from "../components/ColorField.spec";
import { ColorSliderSpec } from "../components/ColorSlider.spec";
import { ColorAreaSpec } from "../components/ColorArea.spec";
import { ColorWheelSpec } from "../components/ColorWheel.spec";
import { ColorSwatchSpec } from "../components/ColorSwatch.spec";
import { ColorSwatchPickerSpec } from "../components/ColorSwatchPicker.spec";
import { ListSpec } from "../components/List.spec";
import { InputSpec } from "../components/Input.spec";
import { SwitcherSpec } from "../components/Switcher.spec";
import { NavSpec } from "../components/Nav.spec";
import { LabelSpec } from "../components/Label.spec";
import { DisclosureHeaderSpec } from "../components/DisclosureHeader.spec";
import { DisclosureContentSpec } from "../components/DisclosureContent.spec";
import { SliderOutputSpec } from "../components/SliderOutput.spec";
import { IconSpec } from "../components/Icon.spec";
import { SelectTriggerSpec } from "../components/SelectTrigger.spec";
import { SelectValueSpec } from "../components/SelectValue.spec";
import { SelectIconSpec } from "../components/SelectIcon.spec";
import { AvatarSpec } from "../components/Avatar.spec";
import { AvatarGroupSpec } from "../components/AvatarGroup.spec";
import { InlineAlertSpec } from "../components/InlineAlert.spec";
import { ButtonGroupSpec } from "../components/ButtonGroup.spec";
import { ToggleButtonSpec } from "../components/ToggleButton.spec";
import { ToggleButtonGroupSpec } from "../components/ToggleButtonGroup.spec";
import { TooltipSpec } from "../components/Tooltip.spec";
import { StatusLightSpec } from "../components/StatusLight.spec";
// ADR-912 단계5: ProgressCircleSpec 삭제 — catalog cutover(value_fill_arc escape) + generate-css virtual
import { SectionSpec } from "../components/Section.spec";
import { BodySpec } from "../components/Body.spec";
import { IllustratedMessageSpec } from "../components/IllustratedMessage.spec";
import { CardViewSpec } from "../components/CardView.spec";
import { TableViewSpec } from "../components/TableView.spec";
import { SliderTrackSpec } from "../components/SliderTrack.spec";
import { SliderThumbSpec } from "../components/SliderThumb.spec";
import { ProgressBarTrackSpec } from "../components/ProgressBarTrack.spec";
import { ProgressBarValueSpec } from "../components/ProgressBarValue.spec";
import { MeterTrackSpec } from "../components/MeterTrack.spec";
import { MeterValueSpec } from "../components/MeterValue.spec";

// ADR-094: `BASE_TAG_SPEC_MAP` 의 각 spec 의 `childSpecs` 를 PascalCase 키로 자동 추가.
//   `TAG_SPEC_MAP` 자체는 하단에서 `expandChildSpecs(BASE_TAG_SPEC_MAP)` 로 생성.
//   → `hasSpec(CardHeader/TagList/...)` true 반환 + `getElementForTag(CardHeader)` 가
//      spec.element === "div" 반환 → Preview DOM 이 `<div>` 로 렌더 (기존 `<cardheader>`
//      커스텀 태그 문제 해소) + `data-size/variant` 속성 주입 복구.
export const BASE_TAG_SPEC_MAP: Record<string, ComponentSpec> = {
  Button: ButtonSpec,
  Badge: BadgeSpec,
  Card: CardSpec,
  Dialog: DialogSpec,
  Popover: PopoverSpec,
  Section: SectionSpec,
  Body: BodySpec,
  Separator: SeparatorSpec,
  ToggleButton: ToggleButtonSpec,
  ToggleButtonGroup: ToggleButtonGroupSpec,
  Tooltip: TooltipSpec,
  TextField: TextFieldSpec,
  TextArea: TextAreaSpec,
  NumberField: NumberFieldSpec,
  SearchField: SearchFieldSpec,
  Checkbox: CheckboxSpec,
  CheckboxGroup: CheckboxGroupSpec,
  Radio: RadioSpec,
  RadioGroup: RadioGroupSpec,
  Switch: SwitchSpec,
  Form: FormSpec,
  Select: SelectSpec,
  ComboBox: ComboBoxSpec,
  ListBox: ListBoxSpec,
  Slider: SliderSpec,
  Meter: MeterSpec,
  ProgressBar: ProgressBarSpec,
  ProgressBarTrack: ProgressBarTrackSpec,
  ProgressBarValue: ProgressBarValueSpec,
  MeterTrack: MeterTrackSpec,
  MeterValue: MeterValueSpec,
  SliderTrack: SliderTrackSpec,
  SliderThumb: SliderThumbSpec,
  SliderOutput: SliderOutputSpec,
  Table: TableSpec,
  Tree: TreeSpec,
  TreeItem: TreeItemSpec,
  Tabs: TabsSpec,
  TabList: TabListSpec,
  TabPanels: TabPanelsSpec,
  TabPanel: TabPanelSpec,
  Tab: TabSpec,
  Menu: MenuSpec,
  Breadcrumbs: BreadcrumbsSpec,
  Breadcrumb: BreadcrumbSpec,
  Pagination: PaginationSpec,
  TagGroup: TagGroupSpec,
  Tag: TagSpec,
  GridList: GridListSpec,
  Accordion: AccordionSpec,
  Modal: ModalSpec,
  Field: FieldSpec,
  TailSwatch: TailSwatchSpec,
  Disclosure: DisclosureSpec,
  DisclosureGroup: DisclosureGroupSpec,
  DisclosureHeader: DisclosureHeaderSpec,
  DisclosureContent: DisclosureContentSpec,
  Toolbar: ToolbarSpec,
  Toast: ToastSpec,
  Group: GroupSpec,
  // ADR-130: canonical layout container (lowercase pencil structural).
  // Group (PascalCase) = RAC ARIA semantic / frame (lowercase) = layout primitive.
  frame: FrameSpec,
  Slot: SlotSpec,
  Skeleton: SkeletonSpec,
  DropZone: DropZoneSpec,
  FileTrigger: FileTriggerSpec,
  MaskedFrame: MaskedFrameSpec,
  DatePicker: DatePickerSpec,
  DateRangePicker: DateRangePickerSpec,
  DateField: DateFieldSpec,
  TimeField: TimeFieldSpec,
  DateInput: DateInputSpec,
  Calendar: CalendarSpec,
  CalendarHeader: CalendarHeaderSpec,
  CalendarGrid: CalendarGridSpec,
  RangeCalendar: RangeCalendarSpec,
  ColorPicker: ColorPickerSpec,
  ColorField: ColorFieldSpec,
  ColorSlider: ColorSliderSpec,
  ColorArea: ColorAreaSpec,
  ColorWheel: ColorWheelSpec,
  ColorSwatch: ColorSwatchSpec,
  ColorSwatchPicker: ColorSwatchPickerSpec,
  List: ListSpec,
  Input: InputSpec,
  Switcher: SwitcherSpec,
  Nav: NavSpec,
  Label: LabelSpec,
  Icon: IconSpec,
  SelectTrigger: SelectTriggerSpec,
  SelectValue: SelectValueSpec,
  SelectIcon: SelectIconSpec,
  Avatar: AvatarSpec,
  AvatarGroup: AvatarGroupSpec,
  InlineAlert: InlineAlertSpec,
  ButtonGroup: ButtonGroupSpec,
  StatusLight: StatusLightSpec,
  // ADR-912 단계5: ProgressCircle 제거 — catalog cutover spec-free (buildSpecNodeData:908 isCatalogSkiaCutover 게이트)
  IllustratedMessage: IllustratedMessageSpec,
  CardView: CardViewSpec,
  TableView: TableViewSpec,
};

/**
 * ADR-094: `BASE_TAG_SPEC_MAP` 각 spec 의 `childSpecs` 를 PascalCase 키로 자동 추가.
 *
 * - 수동 등록 entry 가 우선 (덮어쓰지 않음).
 * - child spec 의 `element` 가 정적 문자열이면 `getElementForTag` 가 그대로 반환.
 * - child spec 의 `element` 가 함수면 Heading 류 동적 분기 규칙 그대로 적용.
 */
export function expandChildSpecs(
  base: Record<string, ComponentSpec>,
): Record<string, ComponentSpec> {
  const out: Record<string, ComponentSpec> = { ...base };
  for (const spec of Object.values(base)) {
    const children = spec.childSpecs;
    if (!children || children.length === 0) continue;
    for (const child of children) {
      if (out[child.name] === undefined) {
        out[child.name] = child;
      }
    }
  }
  return out;
}

export const TAG_SPEC_MAP: Record<string, ComponentSpec> =
  expandChildSpecs(BASE_TAG_SPEC_MAP);

/**
 * ADR-108 P0: lowercase type → ComponentSpec lookup map.
 *
 * `TAG_SPEC_MAP` (PascalCase 키) 을 build-time 1회 lowercase Map 으로 변환.
 * Canvas layout engine 의 `resolveContainerStylesFallback` + `specSizeField` 등
 * type 정규화 경로의 SSOT. apps/builder 는 BUILDER_ALIAS_MAP 과 병합하여
 * 자체 LOWERCASE map 을 파생한다 (sprites/builderAliasMap.ts 참조).
 */
export const LOWERCASE_TAG_SPEC_MAP: ReadonlyMap<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ComponentSpec<any>
> = new Map(
  Object.entries(TAG_SPEC_MAP).map(([k, v]) => [
    k.toLowerCase(),
    v as ComponentSpec<unknown>,
  ]),
);

/**
 * 컴포넌트 type에 대응하는 HTML element 이름을 반환한다.
 *
 * - spec 미등록: `type.toLowerCase()` fallback
 * - `spec.element`가 정적 문자열: 그대로 반환
 * - `spec.element`가 함수: `spec.element(props ?? {})` 호출 결과 반환
 *   (예: Heading은 `level` prop에 따라 `h1~h6` 동적 반환)
 *
 * 함수형 결과가 비어있거나 유효하지 않으면 `type.toLowerCase()` fallback.
 */
export function getElementForTag(
  type: string,
  props?: Record<string, unknown>,
): string {
  const spec = TAG_SPEC_MAP[type];
  if (!spec) return type.toLowerCase();

  const el = spec.element;
  if (typeof el === "string") return el;
  if (typeof el === "function") {
    const resolved = el(props ?? {});
    return typeof resolved === "string" && resolved.length > 0
      ? resolved
      : type.toLowerCase();
  }
  return type.toLowerCase();
}

/**
 * 해당 type가 spec registry에 등록되어 있는지 반환한다.
 * ADR-058 Phase 1: Preview fallback 렌더링이 `react-aria-*` className과
 * `data-size` 등 spec 기반 attribute를 자동 주입할지 판정하는 데 사용.
 */
export function hasSpec(type: string): boolean {
  return type in TAG_SPEC_MAP;
}

/**
 * spec registry에서 해당 type의 defaultSize를 반환한다. 미등록 태그는 undefined.
 */
export function getDefaultSizeForTag(type: string): string | undefined {
  const spec = TAG_SPEC_MAP[type];
  return spec?.defaultSize as string | undefined;
}
