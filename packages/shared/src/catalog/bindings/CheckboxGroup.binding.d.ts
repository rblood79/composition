/**
 * ADR-142 family ③(selection) — CheckboxGroup leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<CheckboxGroup>` 가 자식 Checkbox +
 * Label slot 을 담는 **컨테이너**(SHELL_ONLY). leaf binding.
 *
 * D3: container(배경/레이아웃)는 theme/tokens. 자식 Checkbox/Label 은 canonical children 트리 →
 *     Skia `_hasChildren` 빈 box shell. skiaPrimitive 불필요.
 */
import type { PrimitiveBinding } from "../types";
export declare const checkboxGroupBinding: PrimitiveBinding;
//# sourceMappingURL=CheckboxGroup.binding.d.ts.map