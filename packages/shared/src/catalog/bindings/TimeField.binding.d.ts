/**
 * ADR-142 family ②(fields) — TimeField leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<TimeField>` 가 Label/DateInput/
 * DateSegment slot 합성(D1). leaf binding — DateField 와 동형 + hourCycle 고유.
 *
 * D3: 자식 DateInput 이 세그먼트, 부모는 빈 box shell(`_hasChildren`). skiaPrimitive 불필요.
 */
import type { PrimitiveBinding } from "../types";
export declare const timeFieldBinding: PrimitiveBinding;
//# sourceMappingURL=TimeField.binding.d.ts.map