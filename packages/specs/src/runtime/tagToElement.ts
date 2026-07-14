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
// ADR-912 단계5 step4 Dialog 단건 (2026-06-16): DialogSpec import 제거 — catalog cutover, BASE_TAG_SPEC_MAP entry 제거.
// ADR-912 단계5 step4 Popover 단건 (2026-06-16): PopoverSpec import 제거 — catalog cutover, BASE_TAG_SPEC_MAP entry 제거.
// Checkbox/Radio/Switch — ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): catalog cutover →
//   spec 삭제. getSpecForTag → null, buildSpecNodeData 가 isCatalogSkiaCutover 게이트로 통과(generic).
// Select/ComboBox — ADR-912 단계5 step4 (2026-06-17): catalog cutover → spec 삭제.
//   getSpecForTag → null, buildSpecNodeData 가 isCatalogSkiaCutover 게이트로 통과(generic).
// ListBox — ADR-912 단계5 step4 (2026-06-17): catalog cutover → ListBox.spec 물리 삭제. BASE entry 제거.
//   getSpecForTag → null, buildSpecNodeData 가 isCatalogSkiaCutover("ListBox")=true 게이트로 통과(generic).
// Slider — ADR-912 단계5 step4 (2026-06-17): catalog cutover → Slider.spec 물리 삭제. BASE entry 제거.
//   getSpecForTag → null, buildSpecNodeData 가 isCatalogSkiaCutover("Slider")=true 게이트로 통과(generic).
//   자식 SliderTrack/SliderThumb/SliderOutput 은 이미 삭제됨(slider_fill_bar/slider_thumb escape).
// Meter/ProgressBar — ADR-912 단계5 step4 경량 이관 (2026-06-17): catalog cutover, BASE entry 제거.
//   isCatalogCutover('Meter'|'ProgressBar')=true → Skia 진입 게이트 spec 없이 통과 + DOM virtual CSS.
// ADR-912 단계5 step4 trivial 그룹 (2026-06-16): Table/Tree.spec import 제거 — catalog cutover,
//   BASE_TAG_SPEC_MAP entry 제거. skipCSSGeneration:true, box-only generic 대체.
// ADR-912 R1 후속 (2026-06-12): TreeItemSpec 삭제 — catalog cutover (rule leadingIcon +
//   indentPerLevel + buildCatalogShapes generic + leading_icon append + depth indent).
//   BASE_TAG_SPEC_MAP 등록 제거. 시각 SSOT = componentRulesTable.TreeItem.
// ADR-912 단계5 step4 (2026-06-17): TabsSpec import 제거 — catalog cutover, spec 삭제. BASE entry 제거.
// ADR-912 projection 3 cutover (2026-06-15): TabListSpec/TabSpec import 제거 — catalog cutover, BASE entry 제거.
// Menu — ADR-912 단계5 step4 경량 이관 (2026-06-17): catalog cutover, BASE entry 제거.
//   isCatalogCutover('Menu')=true → Skia 진입 게이트 spec 없이 통과 + DOM virtual CSS.
// ADR-912 단계5 step4 (2026-06-16): BreadcrumbsSpec import 제거 — catalog cutover, spec 삭제. BASE entry 제거.
// ADR-912 projection 3 cutover (2026-06-15): BreadcrumbSpec import 제거 — catalog cutover, BASE entry 제거.
// ADR-912 R7 G1-c (2026-06-15): PaginationSpec import 제거 — catalog cutover, BASE_TAG_SPEC_MAP entry 제거.
// ADR-912 단계5 step4 (2026-06-17): TagGroupSpec/TagSpec import 제거 — catalog cutover spec 삭제.
//   isCatalogSkiaCutover('TagGroup'|'Tag')=true → buildSpecNodeData 게이트가 spec 없이 통과.
//   chip 시각은 appendTagRowProjection → Tag SceneNode(catalog rule), 컨테이너 layout 은
//   resolveContainerStylesFallback/resolveActiveContainerVariants catalog fallback(메커니즘 8aa773bcc).
// GridList — ADR-912 단계5 step4 경량 이관 (2026-06-17): catalog cutover, BASE entry 제거.
//   isCatalogCutover('GridList')=true → Skia 진입 게이트 spec 없이 통과(skipCSSGeneration:true 동형).
// ADR-912 단계5 step4 small-B (2026-06-16): ModalSpec import 제거 — catalog cutover, BASE entry 제거.
// ADR-912 단계5 step4 trivial 그룹 (2026-06-16): FieldSpec import 제거 — catalog cutover,
//   BASE entry 제거. skipCSSGeneration:true + render.shapes=()=>[] (Skia 0 shape).
// ADR-912 R7 G1-c (2026-06-15): ToastSpec import 제거 — 순수 box-shell catalog cutover, BASE_TAG_SPEC_MAP entry 제거.
import { GroupSpec } from "../components/Group.spec";
import { FrameSpec } from "../components/Frame.spec";
import { SlotSpec } from "../components/Slot.spec";
// ADR-912 단계5 step4 Phase 1 batch 2 (2026-06-16): DropZoneSpec import 제거 — catalog cutover.
// ADR-912 단계5 step4 date-color (2026-06-17): DatePicker/DateRangePickerSpec import 제거 — spec 물리 삭제
//   (catalog cutover, isCatalogCutover('DatePicker'/'DateRangePicker')=true). Skia = datefield_trigger primitive.
// ADR-912 단계5 step4 (2026-06-17): DateFieldSpec import 제거 — DateField.spec 물리 삭제
//   (catalog cutover, isCatalogCutover('DateField')=true). Skia = 투명 컨테이너(빈 shapes).
//   layout intrinsicHeight = utils.ts resolveSkiaRule("DateField") 인라인 미러. TimeField 동형 형제.
// ADR-912 단계5 step4 (2026-06-17): DateInputSpec import 제거 — catalog cutover spec 물리 삭제
//   (isCatalogSkiaCutover("DateInput")=true, datefield_segments replace primitive escape).
// ADR-912 단계5 step4 date-color (2026-06-16): Calendar/RangeCalendarSpec import 제거 —
//   catalog cutover spec 삭제, BASE_TAG_SPEC_MAP entry 제거. STRUCTURE_META virtual override + skia
//   calendar_grid escape. CalendarHeader/CalendarGrid 는 별도(small 그룹, replace primitive 대체).
// ADR-912 단계5 step4 (2026-06-17): InputSpec import 제거 — catalog cutover spec 물리 삭제.
//   BASE_TAG_SPEC_MAP.Input entry 제거. STRUCTURE_META virtual override(generate-css) + Skia 는
//   isCatalogSkiaCutover("input")=true generic box+text. 측정은 resolveSkiaRule("Input").sizes.
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
// ADR-912 단계5 step4 (2026-06-17): InlineAlertSpec import 제거 — catalog cutover, BASE_TAG_SPEC_MAP entry 제거.
// ADR-912 R7 G1-c (2026-06-15): ButtonGroupSpec import 제거 — catalog cutover, BASE_TAG_SPEC_MAP entry 제거.
// ADR-912 단계5 step4 type-augment 그룹 (2026-06-16): ToggleButtonGroupSpec import 제거 — catalog cutover, BASE_TAG_SPEC_MAP entry 제거.
// ADR-912 단계5 step4 Tooltip 단건 (2026-06-16): TooltipSpec import 제거 — catalog cutover, BASE_TAG_SPEC_MAP entry 제거.
// ADR-912 단계5: ProgressCircleSpec 삭제 — catalog cutover(value_fill_arc escape) + generate-css virtual
// ADR-912 단계5 step4 (2026-06-17): BodySpec import 제거 — catalog cutover spec 물리 삭제
//   (isCatalogSkiaCutover("body")=true, generated CSS = STRUCTURE_META virtual).
// ADR-912 단계5 step4 type-augment 그룹 (2026-06-16): IllustratedMessageSpec import 제거 — catalog cutover, BASE_TAG_SPEC_MAP entry 제거.
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
  // Dialog — ADR-912 단계5 step4 Dialog 단건 (2026-06-16): catalog cutover spec 삭제로 제거.
  // Popover — ADR-912 단계5 step4 Popover 단건 (2026-06-16): catalog cutover spec 삭제로 제거.
  // Body — ADR-912 단계5 step4 (2026-06-17): catalog cutover spec 삭제로 제거 (generic box + catalog rule.body).
  // ToggleButtonGroup — ADR-912 단계5 step4 type-augment 그룹 (2026-06-16): catalog cutover spec 삭제로 제거.
  // Tooltip — ADR-912 단계5 step4 Tooltip 단건 (2026-06-16): catalog cutover spec 삭제로 제거.
  // Checkbox/Radio/Switch — ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): catalog cutover spec 삭제로 제거.
  // Select/ComboBox — ADR-912 단계5 step4 (2026-06-17): catalog cutover spec 삭제로 BASE entry 제거.
  // ListBox — ADR-912 단계5 step4 (2026-06-17): ListBox.spec 물리 삭제 → BASE entry 제거(catalog cutover).
  // Slider — ADR-912 단계5 step4 (2026-06-17): Slider.spec 물리 삭제 → BASE entry 제거(catalog cutover).
  // Meter/ProgressBar — ADR-912 단계5 step4 경량 이관 (2026-06-17): catalog cutover, BASE entry 제거.
  // ProgressBarTrack/MeterTrack — ADR-912 단계5: catalog cutover type, BASE_TAG_SPEC_MAP 등록 제거
  // ProgressBarValue/MeterValue — ADR-912 value-label (2026-06-11): catalog cutover, 등록 제거
  // SliderTrack — ADR-912 단계5: catalog cutover type, BASE_TAG_SPEC_MAP 등록 제거
  // SliderThumb — ADR-912 catalog cutover (2026-06-16): slider_thumb escape, BASE_TAG_SPEC_MAP 등록 제거
  // SliderOutput — ADR-912 value-label (2026-06-11): catalog cutover, 등록 제거
  // Table/Tree — ADR-912 단계5 step4 trivial 그룹 (2026-06-16): catalog cutover, BASE entry 제거.
  //   isCatalogCutover('Table'/'Tree')=true → Skia 진입 게이트 spec 없이 통과. binding.accepts D2.
  // TreeItem — ADR-912 R1 후속 (2026-06-12): catalog cutover type, BASE_TAG_SPEC_MAP 등록 제거
  // ADR-912 단계5 step4 (2026-06-17): Tabs catalog cutover → BASE_TAG_SPEC_MAP entry 제거.
  //   isCatalogCutover('Tabs')=true → Skia 진입 게이트 spec 없이 통과. binding.accepts D2.
  // ADR-912 projection 3 cutover (2026-06-15): TabList/Tab catalog cutover → BASE_TAG_SPEC_MAP entry
  //   제거. isCatalogCutover('TabList'/'Tab')=true → Skia 진입 게이트 spec 없이 통과. binding.accepts D2.
  // Menu — ADR-912 단계5 step4 경량 이관 (2026-06-17): catalog cutover, BASE entry 제거.
  // ADR-912 단계5 step4 (2026-06-16): Breadcrumbs catalog cutover → BASE_TAG_SPEC_MAP entry 제거.
  //   isCatalogCutover('Breadcrumbs')=true → Skia 진입 게이트 spec 없이 통과. binding.accepts D2.
  // ADR-912 projection 3 cutover (2026-06-15): Breadcrumb catalog cutover → BASE_TAG_SPEC_MAP entry 제거.
  // ADR-912 R7 G1-c (2026-06-15): Pagination catalog cutover → BASE_TAG_SPEC_MAP entry 제거.
  //   isCatalogCutover('Pagination')=true → Skia 진입 게이트 spec 없이 통과. binding.accepts D2.
  // TagGroup/Tag — ADR-912 단계5 step4 (2026-06-17): catalog cutover spec 삭제, BASE entry 제거.
  //   isCatalogSkiaCutover('TagGroup'|'Tag')=true → 게이트 통과. chip=appendTagRowProjection(Tag rule),
  //   컨테이너 layout=catalog containerStyles/containerVariants fallback(8aa773bcc 메커니즘). DOM 은
  //   부모 TagGroup self-compose(renderTagGroup useCollectionData) → DOM 변화 0.
  // GridList — ADR-912 단계5 step4 경량 이관 (2026-06-17): catalog cutover, BASE entry 제거.
  // Modal — ADR-912 단계5 step4 small-B (2026-06-16): catalog cutover, BASE entry 제거.
  //   isCatalogCutover('Modal')=true → Skia 진입 게이트 spec 없이 통과(render.shapes=()=>[] 동형).
  // Field — ADR-912 단계5 step4 trivial 그룹 (2026-06-16): catalog cutover, BASE entry 제거.
  //   isCatalogCutover('Field')=true → Skia 진입 게이트 spec 없이 통과(render.shapes=()=>[] 동형).
  // ADR-912 Disclosure 군 일괄 cutover (2026-06-10) — Disclosure/DisclosureGroup/DisclosureHeader/
  //   DisclosureContent spec entry 삭제 (catalog cutover 완결). 시각 = catalog rule.
  // ADR-912 6 registry collapse (2026-06-11) — TailSwatch/ColorSlider/ColorArea/ColorWheel/ColorSwatch
  //   spec entry 삭제 (color leaf box-only cutover, 시각 = catalog rule).
  // ADR-912 Color container cutover (2026-06-17) — ColorPicker/ColorSwatchPicker spec entry 삭제
  //   (factory child UI + catalog generic shell). ColorField(field)는 보존하지 않음: 이미 catalog
  //   cutover 되어 BASE entry 없음.
  // ADR-912 R7 G1-c (2026-06-15): Toast 순수 box-shell catalog cutover → BASE_TAG_SPEC_MAP entry 제거.
  //   isCatalogCutover('Toast')=true → Skia 진입 게이트(buildSpecNodeData) spec 없이 통과. binding.accepts D2.
  Group: GroupSpec,
  // ADR-130: canonical layout container (lowercase pencil structural).
  // Group (PascalCase) = RAC ARIA semantic / frame (lowercase) = layout primitive.
  frame: FrameSpec,
  Slot: SlotSpec,
  // DropZone — ADR-912 단계5 step4 Phase 1 batch 2 (2026-06-16): catalog cutover, TAG_SPEC_MAP 제거.
  //   isCatalogCutover("DropZone")=true → buildSpecNodeData/generate-css 가 catalog rule 로 처리.
  // DatePicker/DateRangePicker — ADR-912 단계5 step4 date-color (2026-06-17): spec 물리 삭제,
  //   BASE_TAG_SPEC_MAP entry 제거. isCatalogCutover=true → catalog rule + STRUCTURE_META 로 처리.
  // DateField — ADR-912 단계5 step4 (2026-06-17): catalog cutover spec 물리 삭제, BASE_TAG_SPEC_MAP entry 제거.
  //   isCatalogCutover("DateField")=true → buildSpecNodeData 가 catalog rule + STRUCTURE_META 로 처리(투명 컨테이너).
  // DateInput — ADR-912 단계5 step4 (2026-06-17): catalog cutover spec 삭제로 제거.
  //   isCatalogSkiaCutover("DateInput")=true → datefield_segments replace primitive 으로 Skia 처리.
  // Calendar — ADR-912 단계5 step4 date-color (2026-06-16): catalog cutover spec 삭제로 제거.
  // CalendarHeader/CalendarGrid — ADR-912 단계5 step4 small 그룹 (2026-06-16): catalog cutover,
  //   BASE entry 제거. isCatalogCutover=true → Skia 진입 게이트 spec 없이 통과(replace primitive 대체).
  // RangeCalendar — ADR-912 단계5 step4 date-color (2026-06-16): catalog cutover spec 삭제로 제거.
  // ColorPicker/ColorSwatchPicker — ADR-912 Color container cutover (2026-06-17): BASE entry 제거.
  // ADR-912 단계5 step4 (2026-06-17): Input 제거 — catalog cutover spec-free (isCatalogCutover 게이트)
  // ADR-912 단계5 step4 Phase 1 batch 1: Avatar 제거 — catalog cutover spec-free (isCatalogCutover 게이트)
  // ADR-912 R7 G1-a: AvatarGroup 제거 — catalog cutover spec-free (isCatalogCutover 게이트)
  // ADR-912 단계5 step4 (2026-06-17): InlineAlert 제거 — catalog cutover spec-free (isCatalogCutover 게이트)
  // ADR-912 R7 G1-c (2026-06-15): ButtonGroup 제거 — catalog cutover spec-free (isCatalogCutover 게이트,
  //   factory 자식 Button×2 box-shell). isCatalogSkiaCutover('ButtonGroup')=true → Skia 진입 게이트 통과.
  // ADR-912 단계5: ProgressCircle 제거 — catalog cutover spec-free (buildSpecNodeData:908 isCatalogSkiaCutover 게이트)
  // IllustratedMessage — ADR-912 단계5 step4 type-augment 그룹 (2026-06-16): catalog cutover spec-free
  //   (buildSpecNodeData isCatalogSkiaCutover 게이트 + skiaPrimitive illustrated_message escape).
  // ADR-912 R7 G1-b: CardView/TableView 제거 — catalog cutover spec-free (isCatalogCutover 게이트)
};

/**
 * 정본 spec registry.
 *
 * ADR-094 는 각 spec 의 `childSpecs` 를 PascalCase 키로 자동 등록하는 `expandChildSpecs`
 * 를 두었으나, ADR-142/912 cutover 로 `childSpecs` 를 가진 spec 이 전수 삭제되어(잔존
 * spec = Frame/Group/Slot, 셋 다 childSpecs 없음) 항등 함수가 됐다 — 2026-07-15 제거.
 * 구 child spec 들(CardHeader/FormField/DialogFooter 등)은 catalog binding 이 담당한다.
 */
export const TAG_SPEC_MAP: Record<string, ComponentSpec> = BASE_TAG_SPEC_MAP;

/**
 * ADR-108 P0: lowercase type → ComponentSpec lookup map.
 *
 * `TAG_SPEC_MAP` (PascalCase 키) 을 build-time 1회 lowercase Map 으로 변환.
 * Canvas layout engine 의 `resolveContainerStylesFallback` + `specSizeField` 등
 * type 정규화 경로의 SSOT.
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
