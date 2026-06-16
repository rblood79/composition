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
import { DialogSpec } from "../components/Dialog.spec";
import { PopoverSpec } from "../components/Popover.spec";
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
// ADR-912 단계5 step4 trivial 그룹 (2026-06-16): Table/Tree.spec import 제거 — catalog cutover,
//   BASE_TAG_SPEC_MAP entry 제거. skipCSSGeneration:true, box-only generic 대체.
// ADR-912 R1 후속 (2026-06-12): TreeItemSpec 삭제 — catalog cutover (rule leadingIcon +
//   indentPerLevel + buildCatalogShapes generic + leading_icon append + depth indent).
//   BASE_TAG_SPEC_MAP 등록 제거. 시각 SSOT = componentRulesTable.TreeItem.
import { TabsSpec } from "../components/Tabs.spec";
// ADR-912 projection 3 cutover (2026-06-15): TabListSpec/TabSpec import 제거 — catalog cutover, BASE entry 제거.
import { MenuSpec } from "../components/Menu.spec";
import { BreadcrumbsSpec } from "../components/Breadcrumbs.spec";
// ADR-912 projection 3 cutover (2026-06-15): BreadcrumbSpec import 제거 — catalog cutover, BASE entry 제거.
// ADR-912 R7 G1-c (2026-06-15): PaginationSpec import 제거 — catalog cutover, BASE_TAG_SPEC_MAP entry 제거.
import { TagGroupSpec } from "../components/TagGroup.spec";
import { TagSpec } from "../components/Tag.spec";
import { GridListSpec } from "../components/GridList.spec";
import { ModalSpec } from "../components/Modal.spec";
// ADR-912 단계5 step4 trivial 그룹 (2026-06-16): FieldSpec import 제거 — catalog cutover,
//   BASE entry 제거. skipCSSGeneration:true + render.shapes=()=>[] (Skia 0 shape).
import { ToolbarSpec } from "../components/Toolbar.spec";
// ADR-912 R7 G1-c (2026-06-15): ToastSpec import 제거 — 순수 box-shell catalog cutover, BASE_TAG_SPEC_MAP entry 제거.
import { GroupSpec } from "../components/Group.spec";
import { FrameSpec } from "../components/Frame.spec";
import { SlotSpec } from "../components/Slot.spec";
// ADR-912 단계5 step4 Phase 1 batch 2 (2026-06-16): DropZoneSpec import 제거 — catalog cutover.
import { FileTriggerSpec } from "../components/FileTrigger.spec";
import { DatePickerSpec } from "../components/DatePicker.spec";
import { DateRangePickerSpec } from "../components/DateRangePicker.spec";
import { DateFieldSpec } from "../components/DateField.spec";
import { TimeFieldSpec } from "../components/TimeField.spec";
import { DateInputSpec } from "../components/DateInput.spec";
import { CalendarSpec } from "../components/Calendar.spec";
// ADR-912 단계5 step4 small 그룹 (2026-06-16): CalendarHeader/CalendarGrid.spec import 제거 —
//   catalog cutover, BASE entry 제거. skipCSSGeneration:true, replace primitive(spec-free) 대체.
import { RangeCalendarSpec } from "../components/RangeCalendar.spec";
import { ColorPickerSpec } from "../components/ColorPicker.spec";
import { ColorFieldSpec } from "../components/ColorField.spec";
import { ColorSwatchPickerSpec } from "../components/ColorSwatchPicker.spec";
import { InputSpec } from "../components/Input.spec";
// ADR-912 Switcher cleanup — SwitcherSpec import 제거 (RAC ToggleButtonGroup 으로 대체).
// ADR-912 box+text leaf 군 일괄 (2026-06-11) — Label/Icon/ToggleButton/StatusLight/Button/Badge/
//   Separator/Skeleton Spec 삭제. 시각 SSOT = componentRulesTable (generate-css virtual / Skia escape).
// ADR-912 Disclosure 군 일괄 cutover (2026-06-10) — DisclosureHeaderSpec 삭제. 시각 = catalog rule.
// ADR-912 단계5 — DisclosureContentSpec 삭제 (catalog cutover 완결). 시각 SSOT = componentRulesTable.DisclosureContent.
// ADR-912 value-label (2026-06-11): SliderOutputSpec/ProgressBarValueSpec/MeterValueSpec 삭제 —
//   catalog cutover(buildCatalogShapes text) + generate-css virtual. BASE_TAG_SPEC_MAP 등록 제거.
// ADR-912 R1 (2026-06-12): SelectTriggerSpec/SelectValueSpec/SelectIconSpec 삭제 —
//   catalog cutover (rule table + buildCatalogShapes generic + icon_font escape). 구 synthetic
//   alias 7종(ComboBox*/Search*)도 factory retype 으로 본 3 type 에 합류, BUILDER_ALIAS_MAP 해체.
// ADR-912 단계5 step4 Phase 1 batch 1 (2026-06-16): AvatarSpec import 제거 — catalog cutover
//   (BASE_TAG_SPEC_MAP 등록 제거, isCatalogCutover 게이트로 spec-free 통과)
// ADR-912 R7 G1-a: AvatarGroupSpec 삭제 — catalog cutover (BASE_TAG_SPEC_MAP 등록 제거)
import { InlineAlertSpec } from "../components/InlineAlert.spec";
// ADR-912 R7 G1-c (2026-06-15): ButtonGroupSpec import 제거 — catalog cutover, BASE_TAG_SPEC_MAP entry 제거.
import { ToggleButtonGroupSpec } from "../components/ToggleButtonGroup.spec";
import { TooltipSpec } from "../components/Tooltip.spec";
// ADR-912 단계5: ProgressCircleSpec 삭제 — catalog cutover(value_fill_arc escape) + generate-css virtual
import { SectionSpec } from "../components/Section.spec";
import { BodySpec } from "../components/Body.spec";
import { IllustratedMessageSpec } from "../components/IllustratedMessage.spec";
// ADR-912 R7 G1-b: CardViewSpec/TableViewSpec 삭제 — catalog cutover (BASE_TAG_SPEC_MAP 등록 제거)
// ADR-912 단계5 value-fill-track: SliderTrackSpec 삭제 — BASE_TAG_SPEC_MAP 등록 제거.
// ADR-912 catalog cutover (2026-06-16): SliderThumbSpec 삭제 — BASE_TAG_SPEC_MAP 등록 제거 (slider_thumb escape).
// ADR-912 단계5 value-fill-track: ProgressBarTrackSpec/MeterTrackSpec 삭제 — BASE_TAG_SPEC_MAP 등록 제거.

// ADR-094: `BASE_TAG_SPEC_MAP` 의 각 spec 의 `childSpecs` 를 PascalCase 키로 자동 추가.
//   `TAG_SPEC_MAP` 자체는 하단에서 `expandChildSpecs(BASE_TAG_SPEC_MAP)` 로 생성.
//   → `hasSpec(CardHeader/TagList/...)` true 반환 + `getElementForTag(CardHeader)` 가
//      spec.element === "div" 반환 → Preview DOM 이 `<div>` 로 렌더 (기존 `<cardheader>`
//      커스텀 태그 문제 해소) + `data-size/variant` 속성 주입 복구.
export const BASE_TAG_SPEC_MAP: Record<string, ComponentSpec> = {
  // ADR-912 box+text leaf 군 일괄 (2026-06-11): Button/Badge/Separator/ToggleButton/Skeleton/
  //   Label/Icon/StatusLight 제거 — catalog 발효(isCatalogSkiaCutover) → spec null 통과(buildSpecNodeData
  //   진입 게이트 2곳). DOM CSS = generated(virtual), Skia = generic/escape.
  // ADR-912 R6 (2026-06-15): Card 본체 catalog cutover → BASE entry 제거 (R5 에서 childSpecs 이미 제거됨).
  Dialog: DialogSpec,
  Popover: PopoverSpec,
  Section: SectionSpec,
  Body: BodySpec,
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
  // ProgressBarTrack/MeterTrack — ADR-912 단계5: catalog cutover type, BASE_TAG_SPEC_MAP 등록 제거
  // ProgressBarValue/MeterValue — ADR-912 value-label (2026-06-11): catalog cutover, 등록 제거
  // SliderTrack — ADR-912 단계5: catalog cutover type, BASE_TAG_SPEC_MAP 등록 제거
  // SliderThumb — ADR-912 catalog cutover (2026-06-16): slider_thumb escape, BASE_TAG_SPEC_MAP 등록 제거
  // SliderOutput — ADR-912 value-label (2026-06-11): catalog cutover, 등록 제거
  // Table/Tree — ADR-912 단계5 step4 trivial 그룹 (2026-06-16): catalog cutover, BASE entry 제거.
  //   isCatalogCutover('Table'/'Tree')=true → Skia 진입 게이트 spec 없이 통과. binding.accepts D2.
  // TreeItem — ADR-912 R1 후속 (2026-06-12): catalog cutover type, BASE_TAG_SPEC_MAP 등록 제거
  Tabs: TabsSpec,
  // ADR-912 projection 3 cutover (2026-06-15): TabList/Tab catalog cutover → BASE_TAG_SPEC_MAP entry
  //   제거. isCatalogCutover('TabList'/'Tab')=true → Skia 진입 게이트 spec 없이 통과. binding.accepts D2.
  Menu: MenuSpec,
  Breadcrumbs: BreadcrumbsSpec,
  // ADR-912 projection 3 cutover (2026-06-15): Breadcrumb catalog cutover → BASE_TAG_SPEC_MAP entry 제거.
  // ADR-912 R7 G1-c (2026-06-15): Pagination catalog cutover → BASE_TAG_SPEC_MAP entry 제거.
  //   isCatalogCutover('Pagination')=true → Skia 진입 게이트 spec 없이 통과. binding.accepts D2.
  TagGroup: TagGroupSpec,
  Tag: TagSpec,
  GridList: GridListSpec,
  Modal: ModalSpec,
  // Field — ADR-912 단계5 step4 trivial 그룹 (2026-06-16): catalog cutover, BASE entry 제거.
  //   isCatalogCutover('Field')=true → Skia 진입 게이트 spec 없이 통과(render.shapes=()=>[] 동형).
  // ADR-912 Disclosure 군 일괄 cutover (2026-06-10) — Disclosure/DisclosureGroup/DisclosureHeader/
  //   DisclosureContent spec entry 삭제 (catalog cutover 완결). 시각 = catalog rule.
  // ADR-912 6 registry collapse (2026-06-11) — TailSwatch/ColorSlider/ColorArea/ColorWheel/ColorSwatch
  //   spec entry 삭제 (color leaf box-only cutover, 시각 = catalog rule). ColorPicker/ColorField/
  //   ColorSwatchPicker(container/field) 보존.
  Toolbar: ToolbarSpec,
  // ADR-912 R7 G1-c (2026-06-15): Toast 순수 box-shell catalog cutover → BASE_TAG_SPEC_MAP entry 제거.
  //   isCatalogCutover('Toast')=true → Skia 진입 게이트(buildSpecNodeData) spec 없이 통과. binding.accepts D2.
  Group: GroupSpec,
  // ADR-130: canonical layout container (lowercase pencil structural).
  // Group (PascalCase) = RAC ARIA semantic / frame (lowercase) = layout primitive.
  frame: FrameSpec,
  Slot: SlotSpec,
  // DropZone — ADR-912 단계5 step4 Phase 1 batch 2 (2026-06-16): catalog cutover, TAG_SPEC_MAP 제거.
  //   isCatalogCutover("DropZone")=true → buildSpecNodeData/generate-css 가 catalog rule 로 처리.
  FileTrigger: FileTriggerSpec,
  DatePicker: DatePickerSpec,
  DateRangePicker: DateRangePickerSpec,
  DateField: DateFieldSpec,
  TimeField: TimeFieldSpec,
  DateInput: DateInputSpec,
  Calendar: CalendarSpec,
  // CalendarHeader/CalendarGrid — ADR-912 단계5 step4 small 그룹 (2026-06-16): catalog cutover,
  //   BASE entry 제거. isCatalogCutover=true → Skia 진입 게이트 spec 없이 통과(replace primitive 대체).
  RangeCalendar: RangeCalendarSpec,
  ColorPicker: ColorPickerSpec,
  ColorField: ColorFieldSpec,
  ColorSwatchPicker: ColorSwatchPickerSpec,
  Input: InputSpec,
  // ADR-912 단계5 step4 Phase 1 batch 1: Avatar 제거 — catalog cutover spec-free (isCatalogCutover 게이트)
  // ADR-912 R7 G1-a: AvatarGroup 제거 — catalog cutover spec-free (isCatalogCutover 게이트)
  InlineAlert: InlineAlertSpec,
  // ADR-912 R7 G1-c (2026-06-15): ButtonGroup 제거 — catalog cutover spec-free (isCatalogCutover 게이트,
  //   factory 자식 Button×2 box-shell). isCatalogSkiaCutover('ButtonGroup')=true → Skia 진입 게이트 통과.
  // ADR-912 단계5: ProgressCircle 제거 — catalog cutover spec-free (buildSpecNodeData:908 isCatalogSkiaCutover 게이트)
  IllustratedMessage: IllustratedMessageSpec,
  // ADR-912 R7 G1-b: CardView/TableView 제거 — catalog cutover spec-free (isCatalogCutover 게이트)
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
