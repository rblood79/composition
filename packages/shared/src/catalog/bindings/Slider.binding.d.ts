/**
 * ADR-142 family ③(selection) — Slider leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<Slider>` 가 Label/SliderOutput/
 * SliderTrack/SliderThumb slot 합성(D1). leaf binding.
 *
 * D3: track/fill/thumb 은 **자식 sub-part Element**(SliderTrack/SliderThumb, inventory §3 sub-part)
 *     가 그린다 — 부모 Slider 는 `_hasChildren` 빈 box shell(buildCatalogShapes 흡수). 따라서
 *     **skiaPrimitive 불필요**. SliderOutput/Label 도 자식 Element. theme/tokens 가 색 적용.
 */
import type { PrimitiveBinding } from "../types";
export declare const sliderBinding: PrimitiveBinding;
//# sourceMappingURL=Slider.binding.d.ts.map