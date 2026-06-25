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
export declare function toRacProps(node: CanonicalNode | ResolvedNode, binding: PrimitiveBinding): Record<string, unknown>;
//# sourceMappingURL=toRacProps.d.ts.map