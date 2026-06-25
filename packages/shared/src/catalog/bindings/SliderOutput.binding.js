/**
 * SliderOutput — Slider compound 의 현재 값 텍스트 leaf ([[MeterValue]] 동형, variant 없음).
 *
 * **DOM 부모 흡수 (ADR-912 value-label, 2026-06-11)**: DOM 에서 Slider 는 RAC `<Slider>` 가
 *   `<SliderOutput>` 을 self-compose 한다(rac compound self-render, 자식 element 는 generic
 *   재귀 skip — CanonicalNodeRenderer DELEGATING_RAC). source.kind="internal" +
 *   renderer="slideroutput" 는 INTERNAL_RENDERERS 미등록 → cutover generic skip.
 *
 * **Skia = buildCatalogShapes text**: children(factory 명시 자식, Slider.spec child 위임) 을
 *   rule.sizes(fontSize/lineHeight) 로 그림. variant 없음 — neutral text 단색. 순수 text leaf.
 */
export const sliderOutputBinding = {
    source: { kind: "internal", renderer: "slideroutput" },
    props: {
        accepts: {
            size: {
                kind: "size",
                label: "Size",
                section: "appearance",
                default: "md",
            },
            children: {
                kind: "string",
                label: "Value",
                section: "content",
                default: "",
            },
        },
        toRacProps: "default",
    },
};
//# sourceMappingURL=SliderOutput.binding.js.map