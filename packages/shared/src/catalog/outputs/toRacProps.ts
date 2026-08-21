/**
 * ADR-142 — canonical props → RAC component props 투영 (유일한 변환기).
 *
 * 선택 노드의 canonical `props` 를 binding 이 선언한 `accepts` 계약으로 필터링하여
 * `react-aria-components` primitive 에 스프레드할 props 로 만든다.
 *
 * 규칙:
 * - `accepts` 에 선언된 prop 만 투영 — 미선언 prop(event handler 등)은 drop.
 * - visual-enum kind(`variant` | `size` | `fillStyle`) → RAC props 가 아니라
 *   `data-{kebab(key)}` 속성으로 라우팅 (RAC primitive 는 unstyled — 변형/사이즈/
 *   fillStyle 은 theme 규칙이 `data-*` 로 적용, D3). 예: `fillStyle` → `data-fill-style`.
 * - 노드가 prop 을 생략하고 계약에 `default` 가 있으면 default 적용
 *   (특히 variant/size 는 theme 의 `[data-variant=...]` 매칭을 위해 항상 emit 필요).
 *
 * 설계: docs/adr/design/142-starter-spec-component-system-cutover-breakdown.md §3
 */

import type { ResolvedNode } from "../../types/canonical-resolver.types";
import type { CanonicalNode } from "../../types/composition-document.types";
import type { PrimitiveBinding } from "../types";

/** `data-{kebab(key)}` 속성으로 라우팅되는 visual-enum prop kind (RAC props 아님). */
const DATA_ATTR_KINDS: ReadonlySet<string> = new Set([
  "variant",
  "size",
  "fillStyle",
]);

/**
 * kind 가 아니라 **키 이름**으로 `data-*` 라우팅하는 prop 집합 — RSP field label-layout hint.
 *
 * `labelPosition` / `labelAlign` / `necessityIndicator` 는 Inspector 편집을 위해 `kind:"enum"`
 * (드롭다운)이지만, **RAC/DOM prop 이 아니다** — RAC field·Form primitive 에 이런 prop 은 없다.
 * theme·`Form.css` 의 `[data-label-position]` / `[data-label-align]` selector 와 자식 field 상속
 * hint(`data-necessity-indicator`)가 이 data-* 를 소비한다(shared `Form.tsx` wrapper 와 동일).
 *
 * **Why (2026-07-22 fix)**: 미분류 시 `else` 분기에서 raw React prop(`labelPosition="top"`)으로
 * 통과 → 캐노니컬 렌더 경로가 raw RAC primitive 에 스프레드 → `<form>`/`<div>` DOM 에 누출되어
 * React `"does not recognize the labelAlign prop"` 경고 + data-* 미emit 로 label 레이아웃 CSS
 * 미적용(이중 결함). 18개 field/collection binding 이 동일 hint 를 선언하므로 단일 choke point
 * (본 projector)에서 일괄 교정한다. delegating renderer(Slider/ProgressBar/Meter/field 렌더러)는
 * toRacProps 를 경유하지 않아 영향 없음 — raw PrimitiveComponent 경로만 교정된다.
 */
const DATA_ATTR_ENUM_KEYS: ReadonlySet<string> = new Set([
  "labelPosition",
  "labelAlign",
  "necessityIndicator",
  // RSP S2 staticColor (Button/Link, 2026-08-20) — RAC prop 아님. theme CSS 가
  // [data-static-color] 로 소비 (Button.css/Link.css). raw prop 누출 시 React
  // unknown-prop 경고 + CSS 미적용 (labelPosition 과 동일 결함 축).
  "staticColor",
]);

/**
 * boolean 시각 prop → `data-*` 라우팅 (2026-08-21). 값이 아니라 **키 → 속성명** 명시 매핑이다.
 *
 * `isQuiet` 을 기계 변환하면 `data-is-quiet` 이 되는데 theme CSS 는 `[data-quiet]` 를 본다
 * (전용 컴포넌트 13종이 `data-quiet` 를 emit 하는 house 규약). 그래서 접두 제거를 규칙으로
 * 두지 않고 매핑으로 고정한다 — 규칙화하면 `isRequired`(RAC 실제 prop) 같은 키까지 휩쓴다.
 *
 * **false/undefined 는 아무것도 emit 하지 않는다** — CSS 가 존재 셀렉터(`[data-quiet]`)로
 * 매칭하므로 `data-quiet="false"` 를 붙이면 꺼진 상태에서도 규칙이 걸린다. 전용 컴포넌트의
 * `isQuiet ? "true" : undefined` 규약과 같은 형태.
 *
 * **Why (2026-08-21)**: `isQuiet` 은 kind 가 `boolean` 이라 else 분기로 빠져 raw React prop 으로
 * 통과했다 — RAC primitive 는 이 prop 을 모르므로 DOM 에 누출되거나 무시되고, `data-quiet` 이
 * 없어 CSS 도 미적용이었다(`labelPosition`/`staticColor` 와 같은 결함 축). 실질 피해는
 * **TextArea 하나** — isQuiet 을 선언한 15 binding 중 13개는 전용 컴포넌트(delegating renderer)가
 * 직접 emit 하고 그 경로는 본 projector 를 타지 않으며, TableView 는 `variant:"quiet"` 로 흡수했다.
 */
const DATA_ATTR_BOOLEAN_KEYS: ReadonlyMap<string, string> = new Map([
  ["isQuiet", "data-quiet"],
]);

/** camelCase → kebab-case. data-* 속성명 변환용. 예: `fillStyle` → `fill-style`. */
function toDataAttrName(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

export function toRacProps(
  node: CanonicalNode | ResolvedNode,
  binding: PrimitiveBinding,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const props = node.props;
  const passthrough = binding.props.propPassthrough;

  for (const [key, contract] of Object.entries(binding.props.accepts)) {
    const hasValue =
      props != null && Object.prototype.hasOwnProperty.call(props, key);
    const value = hasValue ? props[key] : contract.default;
    if (value === undefined) continue;

    const booleanDataAttr = DATA_ATTR_BOOLEAN_KEYS.get(key);
    if (booleanDataAttr) {
      // true 일 때만 emit — false 를 실으면 존재 셀렉터가 꺼진 상태에도 걸린다.
      if (value === true) out[booleanDataAttr] = "true";
    } else if (
      DATA_ATTR_KINDS.has(contract.kind) &&
      passthrough?.includes(key)
    ) {
      // propPassthrough 키: visual-enum 이라도 React prop 으로 통과 + data-* 도 함께 emit
      // (CSS/debug marker 보존). internal source leaf 의 semantic prop 전용.
      // (ADR-912 StatusLight slice — variant 가 dot 색 계산 input 인 outlier)
      out[key] = value;
      out[`data-${toDataAttrName(key)}`] = String(value);
    } else if (
      DATA_ATTR_KINDS.has(contract.kind) ||
      DATA_ATTR_ENUM_KEYS.has(key)
    ) {
      // visual-enum kind 또는 label-layout hint 키 → data-* 만 emit (raw prop 누출 차단)
      out[`data-${toDataAttrName(key)}`] = String(value);
    } else {
      out[key] = value;
    }
  }

  return out;
}
