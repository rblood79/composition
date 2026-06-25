import type { PrimitiveBinding } from "../types";
/**
 * SliderThumb — Slider compound 의 핸들 (circle + border, Skia-전용 sub-part).
 *
 * **DOM no-op (ADR-912 SliderThumb, SliderTrack 동형)**: DOM 에서 Slider 는 RAC `<Slider>`
 *   컴포넌트가 `<SliderTrack>{({state})=>...}` render-prop 안에서 `state.values.map` 으로
 *   `<SliderThumb>` 를 내부 self-compose 한다(Slider.tsx:140-142). 부모 Slider 가
 *   DELEGATING_RAC_RENDERERS 에 등록되어 canonical 자식(SliderTrack/SliderOutput/SliderThumb)을
 *   DOM 트리에서 순회하지 않으므로 SliderThumb element 노드는 DOM 에 렌더되지 않는다 →
 *   source.renderer 는 DOM 미도달(INTERNAL_RENDERERS 등록 불요). Skia 만 SliderThumb 노드를
 *   그린다(SliderTrack/ListBox row projection 동형 비대칭 — 시각 결과 동일).
 *
 * **Skia = slider_thumb escape (replace)**: circle 핸들(지름 = rule SliderThumb.sizes.height,
 *   Slider.spec.indicator.thumbSize SSOT 14/18/22/26 미러) + border 2px({color.base}). circle 이
 *   전체 외형이라 base box 무의미 → replace(avatar/radio 동형). thumb fill = style.backgroundColor →
 *   rule default variant fill.default.base({color.accent}). SliderTrack 의 slider_fill_bar 는 track +
 *   value 막대만 그리고 thumb 핸들은 본 escape 가 담당(렌더 소유권 2026-06-10 SliderTrack→SliderThumb
 *   이전 정합 유지).
 *
 * D1: composition RAC `<Slider>` 가 self-compose (SliderThumb 단독 DOM 노드 없음).
 * D2: size (부모 Slider.size 에서 implicitStyles slidertrack 분기로 상속 주입 — left:percent% +
 *     width/height:thumbSize 배치).
 * D3: circle fill/border 색 = rule(slider_thumb) — DOM RAC self-thumb 와 시각 대칭.
 */
export declare const sliderThumbBinding: PrimitiveBinding;
//# sourceMappingURL=SliderThumb.binding.d.ts.map