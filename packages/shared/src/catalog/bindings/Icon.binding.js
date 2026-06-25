export const iconBinding = {
    source: {
        kind: "internal",
        renderer: "icon",
    },
    props: {
        accepts: {
            iconName: { kind: "icon", label: "Icon", section: "content" },
            // 시각 차원 → data-variant / data-size (theme 가 값 집합 제공)
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
            strokeWidth: {
                kind: "number",
                label: "Stroke Width",
                section: "appearance",
                default: 2,
                min: 0.5,
                max: 4,
                step: 0.5,
            },
        },
        toRacProps: "default",
    },
    // Icon 은 Lucide glyph(icon_font) primitive — box+text 가 아님.
    skiaPrimitive: "icon_font",
};
//# sourceMappingURL=Icon.binding.js.map