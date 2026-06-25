/**
 * ADR-142/912 — TailSwatch leaf 의 `PrimitiveBinding` (box-only cutover).
 *
 * 사용자 방침(2026-06-11): Color 계열은 빌더 완성 후 제일 나중에 진짜 구현. 지금은 spec 제거 +
 * catalog cutover 등록(6 registry collapse)을 위해 box 영역만 등록한다.
 *
 * TailSwatch = ColorPicker 계열 alias placeholder(legacy spec render.shapes `() => []`, Skia 0).
 * RAC primitive 아님 → internal source. 시각은 generic buildCatalogShapes(box 영역)만.
 */
export const tailSwatchBinding = {
    source: {
        kind: "internal",
        renderer: "tailswatch",
    },
    props: {
        accepts: {
            color: { kind: "string", label: "Color Value", section: "content" },
        },
        toRacProps: "default",
    },
};
//# sourceMappingURL=TailSwatch.binding.js.map