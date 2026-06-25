/**
 * ADR-142 family ②(fields) — DateField leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<DateField>` 가 Label/DateInput/
 * DateSegment slot 합성(D1 — DateInput/DateSegment 는 sub-part, 독립 binding 없음). leaf binding.
 *
 * D2: label/description + size/labelPosition/isQuiet + state. min/max/placeholderValue 는
 *     DateValue 타입(문자열 직렬화)이라 미노출(후속 — RAC 고급 props).
 * D3: 자식 DateInput 이 배경/세그먼트, 부모는 빈 box shell(`_hasChildren`). skiaPrimitive 불필요.
 */
import type { PrimitiveBinding } from "../types";
export declare const dateFieldBinding: PrimitiveBinding;
//# sourceMappingURL=DateField.binding.d.ts.map