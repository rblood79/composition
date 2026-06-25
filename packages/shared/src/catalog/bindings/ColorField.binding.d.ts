/**
 * ADR-142 family ②(fields) — ColorField leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<ColorField>` 가 Label/Input slot
 * 합성(D1). leaf binding — TextField 와 동형(색상 hex/rgb 입력).
 *
 * D2: label/description + size/labelPosition/labelAlign/isQuiet + state. channel/colorSpace 는
 *     RAC ColorField 가 직접 받지 않음(ColorArea/Slider 용) — 미노출.
 * D3: 자식 Input 이 배경, 부모는 빈 box shell(`_hasChildren`). swatch 시각은 자식 Element 가
 *     담당 — 부모 binding 은 skiaPrimitive 불필요(보편 box+text frame 흡수).
 */
import type { PrimitiveBinding } from "../types";
export declare const colorFieldBinding: PrimitiveBinding;
//# sourceMappingURL=ColorField.binding.d.ts.map