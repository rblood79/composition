/**
 * ADR-142 family ②(fields) — Form leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<Form>` 은 자식 field(TextField 등)를
 * 담는 **컨테이너**(SHELL_ONLY) — `<form>` element + validation 흐름(D1). leaf binding.
 *
 * D2: variant(default·outlined)/size + labelPosition/labelAlign/necessityIndicator(자식 field
 *     상속 hint, data-* 라우팅) + validationBehavior.
 * D3: container 배경(variant)은 theme/tokens data-* rules. Skia 는 `_hasChildren` shell —
 *     자식 field 가 canonical children 트리. skiaPrimitive 불필요(보편 box frame).
 */
import type { PrimitiveBinding } from "../types";
export declare const formBinding: PrimitiveBinding;
//# sourceMappingURL=Form.binding.d.ts.map