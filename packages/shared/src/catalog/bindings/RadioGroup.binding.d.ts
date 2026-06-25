/**
 * ADR-142 family ③(selection) — RadioGroup leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<RadioGroup>` 가 자식 Radio + Label
 * slot 을 담는 **컨테이너**(SHELL_ONLY). leaf binding.
 *
 * D3: container 는 theme/tokens. 자식 Radio/Label 은 canonical children → Skia `_hasChildren`
 *     빈 box shell. skiaPrimitive 불필요.
 */
import type { PrimitiveBinding } from "../types";
export declare const radioGroupBinding: PrimitiveBinding;
//# sourceMappingURL=RadioGroup.binding.d.ts.map