/**
 * ADR-142/912 — ColorSlider leaf RAC primitive 의 `PrimitiveBinding` (box-only cutover).
 *
 * 사용자 방침(2026-06-11): Color 계열은 빌더 완성 후 제일 나중에 진짜 구현. 지금은 spec 제거 +
 * catalog cutover 등록(6 registry collapse)을 위해 box 영역만 등록한다.
 *
 * D1: RAC `<ColorSlider>` + Label + SliderOutput + `<SliderTrack>` + `<ColorThumb>` (grid 레이아웃).
 * D3: box-only — track gradient / thumb / output 텍스트는 generic buildCatalogShapes(box)로 재현
 *     안 함(의도적 손실).
 */
export const colorSliderBinding = {
    source: {
        kind: "rac",
        package: "react-aria-components",
        importPath: "react-aria-components",
        component: "ColorSlider",
    },
    rac: {
        primitive: "ColorSlider",
        parts: ["sliderTrack", "sliderOutput", "colorThumb"],
        slots: [],
        states: ["isDisabled"],
        renderProps: ["isDisabled"],
        dataAttributes: ["data-disabled"],
    },
    props: {
        accepts: {
            label: { kind: "string", label: "Label", section: "content" },
            isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
        },
        toRacProps: "default",
    },
};
//# sourceMappingURL=ColorSlider.binding.js.map