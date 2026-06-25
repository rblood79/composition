/**
 * ADR-142 family ②(fields) — TextArea leaf RAC primitive 의 `PrimitiveBinding`.
 * (ADR-912 단계 5 선행-1: catalog 미등록 leaf 등록 — RAC source, generic box+text 커버.)
 *
 * inventory(§D)는 TextArea 를 RAC-controller-backed **primitive** 로 분류한다 — RAC
 * `<TextArea>`(field 계열)가 Label/textarea/description/FieldError 를 합성하는 것은 RAC
 * primitive 자체의 D1 동작이지 사용자 조합(reusable)이 아니다. TextField 와 동형 leaf binding.
 *
 * D1: RAC `TextArea` → multi-line `<textarea>` + Label/Text slot. RAC 가 ARIA/포커스 권위.
 * D2: label/description/placeholder/rows + size/labelPosition/isQuiet + state(disabled/readonly/invalid/required).
 * D3: 시각(배경/테두리/폰트)은 input box — TextArea 자체는 box+text generic(buildCatalogShapes)
 *     으로 커버(value-dependent 시각 없음 → skiaPrimitive 불필요). size/labelPosition/isQuiet 는
 *     data-* 라우팅(theme 가 시각 적용).
 */
export const textAreaBinding = {
    source: {
        kind: "rac",
        package: "react-aria-components",
        importPath: "react-aria-components",
        component: "TextField",
    },
    rac: {
        primitive: "TextField",
        parts: ["label", "textarea", "description", "fieldError"],
        slots: ["description", "errorMessage"],
        states: ["isDisabled", "isInvalid", "isReadOnly", "isRequired"],
        renderProps: ["isDisabled", "isInvalid", "isReadOnly", "isRequired"],
        dataAttributes: [
            "data-disabled",
            "data-invalid",
            "data-readonly",
            "data-required",
        ],
    },
    props: {
        accepts: {
            label: { kind: "string", label: "Label", section: "content" },
            description: {
                kind: "string",
                label: "Description",
                section: "content",
            },
            placeholder: {
                kind: "string",
                label: "Placeholder",
                section: "content",
            },
            rows: { kind: "number", label: "Rows", section: "appearance" },
            // 시각 차원 → data-size (theme 가 값 집합 제공)
            size: {
                kind: "size",
                label: "Size",
                section: "appearance",
                default: "md",
            },
            labelPosition: {
                kind: "enum",
                label: "Label Position",
                section: "appearance",
                default: "top",
                options: [
                    { value: "top", label: "Top" },
                    { value: "side", label: "Side" },
                ],
            },
            isQuiet: { kind: "boolean", label: "Quiet", section: "appearance" },
            isRequired: { kind: "boolean", label: "Required", section: "state" },
            isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
            isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
            isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
        },
        toRacProps: "default",
    },
};
//# sourceMappingURL=TextArea.binding.js.map