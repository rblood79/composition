/**
 * SelectValue — field-trigger 계열의 값/placeholder 텍스트 leaf sub-part.
 *
 * **ADR-912 R1 (Select family rebuild, 2026-06-12)**: 기존 ComboBoxInput/SearchInput
 *   synthetic alias 를 factory retype 으로 본 type 에 합류. 텍스트 시각(색/fontSize/height)은
 *   rule(COMPONENT_RULES_TABLE.SelectValue) + buildCatalogShapes generic text 가 단일 source.
 *   측정도 specTextStyle catalogType="SelectValue" 로 동일 source (측정·그리기 SSOT 일치).
 *
 * **DOM 부모 흡수**: 부모 renderer 가 RAC `<SelectValue>`/`<Input>` self-compose — 자식은
 *   placeholder data 로만 소비. renderer="selectvalue" 는 INTERNAL_RENDERERS 미등록 →
 *   cutover generic skip (MeterValue 동형).
 *
 * D1: composition — DOM 은 부모 RAC self-compose.
 * D2: children(값)/placeholder + size 편집 surface.
 * D3: 시각은 rule variants(text neutral) + sizes(fontSize/height).
 */
export const selectValueBinding = {
    source: { kind: "internal", renderer: "selectvalue" },
    props: {
        accepts: {
            children: {
                kind: "string",
                label: "Value",
                section: "content",
                default: "",
            },
            placeholder: {
                kind: "string",
                label: "Placeholder",
                section: "content",
                default: "",
            },
            size: {
                kind: "size",
                label: "Size",
                section: "appearance",
                default: "md",
            },
        },
        toRacProps: "default",
    },
};
//# sourceMappingURL=SelectValue.binding.js.map