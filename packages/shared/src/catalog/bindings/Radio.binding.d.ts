/**
 * ADR-142 family ③(selection) — Radio leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<Radio>` 는 RadioGroup 안에서만 의미
 * (value 로 group 선택). leaf binding.
 *
 * D3: indicator(ring + dot)는 비-DOM-trivial → `skiaPrimitive: "radio"` draw module.
 *     label 은 자식 Label Element 담당.
 */
import type { PrimitiveBinding } from "../types";
export declare const radioBinding: PrimitiveBinding;
//# sourceMappingURL=Radio.binding.d.ts.map