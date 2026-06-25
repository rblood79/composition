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
export const colorFieldBinding = {
    source: {
        kind: "rac",
        package: "react-aria-components",
        importPath: "react-aria-components",
        component: "ColorField",
    },
    rac: {
        primitive: "ColorField",
        parts: ["label", "input", "description", "fieldError"],
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
            labelAlign: {
                kind: "enum",
                label: "Label Align",
                section: "appearance",
                default: "start",
                options: [
                    { value: "start", label: "Start" },
                    { value: "center", label: "Center" },
                    { value: "end", label: "End" },
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
//# sourceMappingURL=ColorField.binding.js.map