/**
 * ADR-142 family ②(fields) — NumberField leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<NumberField>` 가 Label/Group/Input/
 * stepper Button slot 합성(D1). leaf binding — TextField 와 동형 + number 고유 props.
 *
 * D2: label/description + size/labelPosition/isQuiet + min/max/step(formatOptions 는 미노출,
 *     locale-dependent 라 후속) + state.
 * D3: 자식 Input 이 배경, 부모는 빈 box shell(`_hasChildren`). skiaPrimitive 불필요.
 */
import type { PrimitiveBinding } from "../types";
export declare const numberFieldBinding: PrimitiveBinding;
//# sourceMappingURL=NumberField.binding.d.ts.map