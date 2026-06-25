/**
 * ADR-142 family ③(selection) — Checkbox leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<Checkbox>` 가 indicator + label slot
 * 합성(D1). leaf binding.
 *
 * D3: indicator(box + checkmark)는 box+text 로 표현 불가한 비-DOM-trivial primitive →
 *     `skiaPrimitive: "checkbox"` draw module(renderers/skiaPrimitives.ts)이 그린다.
 *     label 은 자식 Label Element(canonical children)가 담당. theme/tokens 가 색 적용(D3).
 */
export const checkboxBinding = {
    source: {
        kind: "rac",
        package: "react-aria-components",
        importPath: "react-aria-components",
        component: "Checkbox",
    },
    rac: {
        primitive: "Checkbox",
        parts: ["checkbox", "indicator", "label"],
        slots: [],
        states: ["isSelected", "isIndeterminate", "isDisabled", "isInvalid"],
        renderProps: ["isSelected", "isIndeterminate", "isDisabled", "isInvalid"],
        dataAttributes: [
            "data-selected",
            "data-indeterminate",
            "data-disabled",
            "data-invalid",
        ],
    },
    props: {
        accepts: {
            children: { kind: "string", label: "Label", section: "content" },
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
            isIndeterminate: {
                kind: "boolean",
                label: "Indeterminate",
                section: "state",
            },
            isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
            isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
        },
        toRacProps: "default",
    },
    // box + checkmark indicator — box+text 가 아님.
    skiaPrimitive: "checkbox",
};
//# sourceMappingURL=Checkbox.binding.js.map