/**
 * "그룹 자체 축을 prop 으로 derive 하는 컨테이너" 단일 소스
 *
 * 일부 컨테이너는 그룹 root 의 flexDirection SSOT 가 `props.style.flexDirection`
 * 이 아니라 별도 layout prop 이다. 렌더 derive 경로(fullTreeLayout / implicitStyles
 * / CSS generated)가 그 prop → flexDirection 을 단방향 도출하고 inline
 * style.flexDirection 을 무시한다. 따라서 Style 패널 Direction 토글은:
 *  1) 편집 입력을 style 이 아닌 해당 prop 으로 번역해야 양방향 동기화 + 화면 반영이
 *     된다(이중 저장 아님 — 단일 SSOT 유지).
 *  2) `block` 은 이 모델들에 없는 상태이므로 토글에서 disable.
 *
 * 그룹 축을 결정하는 prop 이 두 종류다 (2026-06-30 전수조사):
 *  - **orientation 축** (ToggleButtonGroup, Toolbar):
 *    `props.orientation` (commit d9ef79bcb). vertical→column / horizontal→row.
 *  - **labelPosition 축** (RadioGroup, CheckboxGroup, field 8종, TagGroup):
 *    `props.labelPosition`. top→column(label 위) / side→row(label 옆).
 *
 * labelPosition 축의 렌더 derive SSOT 는 **모두 동일하게 catalog
 * `containerVariants["label-position"].side.styles`(flex-row)** 다
 * (implicitStyles `resolveActiveContainerVariants` → `hasResolvedSideLabelVariant`
 * → sideMode → flexDirection row/column). RadioGroup/CheckboxGroup 도 prop 직접이
 * 아니라 이 catalog 데이터 경유 (implicitStyles:1109-1208). 따라서 Direction 토글을
 * `props.labelPosition` 으로 번역하면 → catalog variant 매칭이 바뀌고 → 렌더가
 * 따라온다 (이중 저장 아님 — 단일 catalog SSOT 유지).
 *
 * 적용 대상 = catalog label-position variant + binding accepts **양쪽 모두** 보유:
 *  - RadioGroup, CheckboxGroup (orientation 직교 — items-wrapper 축)
 *  - field 8종: TextField, TextArea, NumberField, SearchField, ColorField,
 *    DateField, TimeField, DatePicker (단일 컨트롤 — orientation 축 없음,
 *    side→row 는 Label↔Input 옆배치)
 *  - TagGroup (orientation=chip 배치 축으로 직교, binding 주석 명시)
 *
 * ⚠️ 제외:
 *  - ButtonGroup: SSOT 가 정반대(style.flexDirection 이 Skia/Taffy 직접 read,
 *    orientation 은 CSS/preview 전용 채널)라 포함 시 새 drift.
 *    [[feedback-orientation-ssot-not-uniform-buttongroup-inverse]]
 *  - ComboBox, DateRangePicker: catalog label-position variant 는 있으나 binding
 *    accepts 미선언 → Properties dropdown 편집 UI 부재. Direction 토글만 prop 을
 *    쓰면 편집 진입점 비대칭. binding accepts 추가는 별도 작업.
 *  - Select: catalog variant 자체 없음.
 *
 * element.type 은 PascalCase 저장 → derive 경로(`.toLowerCase()` 비교)와 동일하게
 * 정규화한 소문자 집합으로 둔다.
 */

/** Direction 토글이 `props.orientation` 으로 번역되는 컨테이너. */
export const ORIENTATION_DRIVEN_TAGS: ReadonlySet<string> = new Set([
  "togglebuttongroup",
  "toolbar",
]);

/** Direction 토글이 `props.labelPosition` 으로 번역되는 컨테이너. */
export const LABEL_POSITION_DRIVEN_TAGS: ReadonlySet<string> = new Set([
  "radiogroup",
  "checkboxgroup",
  // field 8종 (catalog label-position variant + binding accepts 양쪽 보유)
  "textfield",
  "textarea",
  "numberfield",
  "searchfield",
  "colorfield",
  "datefield",
  "timefield",
  "datepicker",
  // chip 계열 (orientation=chip 배치 축으로 직교)
  "taggroup",
]);

/** Direction 토글이 그룹 축 prop 으로 derive 되는 prop key (없으면 일반 style 경로). */
export type DirectionDrivenProp = "orientation" | "labelPosition";

/**
 * 선택 요소의 그룹 축 prop key 를 반환 (PascalCase type 입력 허용).
 * orientation/labelPosition 어느 것도 아니면 undefined → 일반 style.flexDirection 경로.
 */
export function resolveDirectionDrivenProp(
  type: string | undefined,
): DirectionDrivenProp | undefined {
  const normalized = (type ?? "").toLowerCase();
  if (ORIENTATION_DRIVEN_TAGS.has(normalized)) return "orientation";
  if (LABEL_POSITION_DRIVEN_TAGS.has(normalized)) return "labelPosition";
  return undefined;
}

/** 선택 요소가 그룹 축 prop derive 컨테이너인지 (block disable 대상). */
export function isDirectionDrivenTag(type: string | undefined): boolean {
  return resolveDirectionDrivenProp(type) !== undefined;
}

/**
 * Direction 토글 값 → 그룹 축 prop 값.
 *  - orientation: column→vertical / row→horizontal
 *  - labelPosition: column→top / row→side
 * block 은 모델에 없어 row 쪽(horizontal / side)으로 흡수.
 */
export function flexDirectionToDrivenValue(
  prop: DirectionDrivenProp,
  value: string,
): string {
  const isColumn = value === "column";
  if (prop === "orientation") return isColumn ? "vertical" : "horizontal";
  // labelPosition
  return isColumn ? "top" : "side";
}

/**
 * 그룹 축 prop 값 → flexDirection (패널 Direction 표시 / SSOT 우선 read).
 * derive 의 역방향. 그룹 축 prop derive 컨테이너의 패널 표시는 stale inline
 * style.flexDirection 보다 이 값을 우선해야 SSOT 와 일치한다(양방향 표시 정합).
 *  - orientation: vertical→column / 그 외→row
 *  - labelPosition: top→column / side→row (top default)
 */
export function drivenValueToFlexDirection(
  prop: DirectionDrivenProp,
  rawValue: unknown,
): "row" | "column" {
  const value = typeof rawValue === "string" ? rawValue : undefined;
  if (prop === "orientation") return value === "vertical" ? "column" : "row";
  // labelPosition: side→row, top(또는 미설정 default)→column
  return value === "side" ? "row" : "column";
}

/**
 * 선택 요소가 그룹 축 prop derive 컨테이너이면 그 prop 값으로 derive 한
 * flexDirection 을, 아니면 undefined 반환(일반 inline/specPreset 경로 fallback).
 * 패널 표시(useResolvedLayoutFields)에서 inline 보다 우선 적용.
 */
export function resolveDrivenFlexDirection(
  type: string | undefined,
  props: Readonly<Record<string, unknown>> | undefined,
): "row" | "column" | undefined {
  const prop = resolveDirectionDrivenProp(type);
  if (!prop) return undefined;
  return drivenValueToFlexDirection(prop, props?.[prop]);
}
