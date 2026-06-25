/**
 * ADR-142 family ②(fields) — SearchField leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<SearchField>` 가 Label/Input/clear
 * Button slot 합성(D1). leaf binding — TextField 와 동형(검색 clear 는 RAC 내장).
 *
 * D3: 자식 Input 이 배경, 부모는 빈 box shell(`_hasChildren`). skiaPrimitive 불필요.
 */
import type { PrimitiveBinding } from "../types";
export declare const searchFieldBinding: PrimitiveBinding;
//# sourceMappingURL=SearchField.binding.d.ts.map