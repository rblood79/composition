/**
 * ADR-142 family ③(selection) — Checkbox leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<Checkbox>` 가 indicator + label slot
 * 합성(D1). leaf binding.
 *
 * D3: indicator(box + checkmark)는 box+text 로 표현 불가한 비-DOM-trivial primitive →
 *     `skiaPrimitive: "checkbox"` draw module(renderers/skiaPrimitives.ts)이 그린다.
 *     label 은 자식 Label Element(canonical children)가 담당. theme/tokens 가 색 적용(D3).
 */
import type { PrimitiveBinding } from "../types";
export declare const checkboxBinding: PrimitiveBinding;
//# sourceMappingURL=Checkbox.binding.d.ts.map