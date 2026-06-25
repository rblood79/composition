/**
 * MeterValue — Meter compound 의 현재 값 텍스트 leaf (Skia-전용 sub-part 표시 노드).
 *
 * **DOM 부모 흡수 (ADR-912 value-label, 2026-06-11)**: DOM 에서 Meter 는 RAC `<Meter>` 가
 *   value label 을 self-compose 한다(renderMeter 가 children=formatted value 흡수, 자식
 *   MeterValue 노드는 DOM 독립 렌더 안 됨). source.kind="internal" + renderer="metervalue"
 *   는 INTERNAL_RENDERERS 미등록 → cutover generic skip (부모 흡수). [[MeterTrack]] 동형 비대칭.
 *
 * **Skia = buildCatalogShapes text**: value 비례 채움이 아니라 **값 텍스트** 자체.
 *   children(부모 resolveProgressProps 가 formatted value 주입) 을 rule.variants(text color)
 *   + sizes(fontSize/lineHeight) 로 그림. value_fill_* escape 없는 순수 text leaf.
 *
 * **binding 필수 이유**: catalog primitiveEntry 는 getPrimitiveBinding(type) 로 binding 을
 *   채운다. binding 누락 시 entry.binding=undefined → resolveEditContract 가 value 선택 시
 *   `entry.binding.props.accepts` 에서 크래시(2026-06-11 회귀). accepts 가 Inspector D2 properties.
 */
export const meterValueBinding = {
    source: { kind: "internal", renderer: "metervalue" },
    props: {
        accepts: {
            variant: {
                kind: "variant",
                label: "Variant",
                section: "appearance",
                default: "informative",
            },
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
//# sourceMappingURL=MeterValue.binding.js.map