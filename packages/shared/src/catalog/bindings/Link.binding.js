/**
 * ADR-142 family ①(primitives/actions) — Link leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * Link 는 text-only leaf(배경 없음, fill.alpha:0) + underline(D3 시각, theme/composition 데이터).
 * de-risk 그룹(box+text): Separator(divider) 다음으로 단순. icon/children 합성 없음.
 *
 * D1: RAC `Link` 가 `<a>` 를 emit. href/target/rel/isDisabled 는 RAC props 통과.
 * D2: variant(primary·secondary)/size/staticColor/isQuiet/isExternal 등 편집 surface.
 * D3: 시각(text 색/underline)은 theme/tokens data-* rules. underline 은 Skia 가
 *     buildCatalogShapes 의 spec.composition.rootSelectors text-decoration 데이터로 재현.
 */
export const linkBinding = {
    source: {
        kind: "rac",
        package: "react-aria-components",
        importPath: "react-aria-components",
        component: "Link",
    },
    rac: {
        primitive: "Link",
        parts: ["link"],
        slots: [],
        states: [
            "isHovered",
            "isPressed",
            "isFocused",
            "isFocusVisible",
            "isDisabled",
        ],
        renderProps: [
            "isHovered",
            "isPressed",
            "isFocused",
            "isFocusVisible",
            "isDisabled",
            "isCurrent",
        ],
        dataAttributes: [
            "data-hovered",
            "data-pressed",
            "data-focused",
            "data-focus-visible",
            "data-disabled",
            "data-current",
        ],
    },
    props: {
        accepts: {
            children: { kind: "string", label: "Label", section: "content" },
            // 시각 차원 → data-variant / data-size (theme 가 값 집합 + text 색 제공)
            variant: {
                kind: "variant",
                label: "Variant",
                section: "appearance",
                default: "primary",
            },
            size: {
                kind: "size",
                label: "Size",
                section: "appearance",
                default: "md",
            },
            staticColor: {
                kind: "enum",
                label: "Static Color",
                section: "appearance",
                default: "auto",
                options: [
                    { value: "auto", label: "Auto" },
                    { value: "white", label: "White" },
                    { value: "black", label: "Black" },
                ],
            },
            isQuiet: { kind: "boolean", label: "Quiet", section: "appearance" },
            // RAC Link / anchor props
            href: { kind: "string", label: "URL", section: "state" },
            target: {
                kind: "enum",
                label: "Target",
                section: "state",
                options: [
                    { value: "_self", label: "Same Window" },
                    { value: "_blank", label: "New Window" },
                    { value: "_parent", label: "Parent Frame" },
                    { value: "_top", label: "Top Frame" },
                ],
            },
            rel: { kind: "string", label: "Rel", section: "state" },
            isExternal: { kind: "boolean", label: "External Link", section: "state" },
            isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
        },
        toRacProps: "default",
    },
};
//# sourceMappingURL=Link.binding.js.map