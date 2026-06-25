/**
 * ADR-142 family ③(selection) — Radio leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<Radio>` 는 RadioGroup 안에서만 의미
 * (value 로 group 선택). leaf binding.
 *
 * D3: indicator(ring + dot)는 비-DOM-trivial → `skiaPrimitive: "radio"` draw module.
 *     label 은 자식 Label Element 담당.
 */
export const radioBinding = {
    source: {
        kind: "rac",
        package: "react-aria-components",
        importPath: "react-aria-components",
        component: "Radio",
    },
    rac: {
        primitive: "Radio",
        parts: ["radio", "indicator", "label"],
        slots: [],
        states: ["isSelected", "isDisabled"],
        renderProps: ["isSelected", "isDisabled"],
        dataAttributes: ["data-selected", "data-disabled"],
    },
    props: {
        accepts: {
            children: { kind: "string", label: "Label", section: "content" },
            // RAC Radio 는 group 안에서 value 로 식별
            value: { kind: "string", label: "Value", section: "content" },
            variant: {
                kind: "variant",
                label: "Variant",
                section: "appearance",
                default: "default",
            },
            size: {
                kind: "size",
                label: "Size",
                section: "appearance",
                default: "md",
            },
            isSelected: { kind: "boolean", label: "Selected", section: "state" },
            isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
        },
        toRacProps: "default",
    },
    // ring + dot indicator — box+text 가 아님.
    skiaPrimitive: "radio",
};
//# sourceMappingURL=Radio.binding.js.map