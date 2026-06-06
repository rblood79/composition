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

    if (DATA_ATTR_KINDS.has(contract.kind) && passthrough?.includes(key)) {
      // propPassthrough 키: visual-enum 이라도 React prop 으로 통과 + data-* 도 함께 emit
      // (CSS/debug marker 보존). internal source leaf 의 semantic prop 전용.
      // (ADR-912 StatusLight slice — variant 가 dot 색 계산 input 인 outlier)
      out[key] = value;
      out[`data-${toDataAttrName(key)}`] = String(value);
    } else if (DATA_ATTR_KINDS.has(contract.kind)) {
      out[`data-${toDataAttrName(key)}`] = String(value);
    } else {
      out[key] = value;
    }
  }

  return out;
}
