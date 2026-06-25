/**
 * ADR-142 family ③(selection) — Switch leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<Switch>` 가 track+thumb indicator +
 * label slot 합성(D1). leaf binding.
 *
 * D3: indicator(track + thumb)는 비-DOM-trivial → `skiaPrimitive: "switch_toggle"` draw module.
 *     label 은 자식 Label Element 담당.
 */
import type { PrimitiveBinding } from "../types";
export declare const switchBinding: PrimitiveBinding;
//# sourceMappingURL=Switch.binding.d.ts.map