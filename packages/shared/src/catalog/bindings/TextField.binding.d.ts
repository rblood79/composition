/**
 * ADR-142 family ②(fields) — TextField leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1)는 TextField 를 RAC-controller-backed **primitive** 로 분류한다 — RAC
 * `<TextField>` 가 `<Label>/<Input>/<Text slot="description">/<FieldError>` 를 합성하는 것은
 * RAC primitive 자체의 D1 동작이지 사용자 조합(reusable)이 아니다. 따라서 leaf binding.
 *
 * D1: RAC `TextField` → `<div role="group">` + Label/Input slot. RAC 가 ARIA/포커스 권위.
 * D2: label/description/placeholder/type + size/labelPosition/isQuiet + state(disabled/readonly/invalid).
 * D3: 시각(배경/테두리/폰트)은 자식 Input 이 담당 — TextField 자체는 빈 box(`_hasChildren`).
 *     size/labelPosition/isQuiet 는 data-* 라우팅(theme 가 시각 적용). skiaPrimitive 불필요
 *     (자식 Input 이 배경 box, 부모는 보편 box+text frame 의 빈 shell 로 흡수).
 */
import type { PrimitiveBinding } from "../types";
export declare const textFieldBinding: PrimitiveBinding;
//# sourceMappingURL=TextField.binding.d.ts.map