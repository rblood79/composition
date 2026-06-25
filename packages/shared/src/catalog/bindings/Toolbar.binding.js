/**
 * ADR-142 family ①(primitives/actions) — Toolbar leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * Toolbar 는 자식(Button/ToggleButton/Separator 등)을 담는 **컨테이너**(SHELL_ONLY). Skia 는
 * buildCatalogShapes 의 `_hasChildren` 분기로 shell 만 그리고 자식은 canonical children 트리.
 *
 * D1: RAC `Toolbar` 가 `<div role="toolbar" aria-orientation>`. orientation RAC props.
 * D2: variant(default·accent)/size/orientation 편집 surface.
 * D3: 시각(container 배경)은 theme/tokens data-* rules.
 */
export const toolbarBinding = {
    source: {
        kind: "rac",
        package: "react-aria-components",
        importPath: "react-aria-components",
        component: "Toolbar",
    },
    rac: {
        primitive: "Toolbar",
        parts: ["toolbar"],
        slots: [],
        states: [],
        renderProps: ["orientation"],
        dataAttributes: ["data-orientation"],
    },
    props: {
        accepts: {
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
            orientation: {
                kind: "enum",
                label: "Orientation",
                section: "appearance",
                default: "horizontal",
                options: [
                    { value: "horizontal", label: "Horizontal" },
                    { value: "vertical", label: "Vertical" },
                ],
            },
        },
        toRacProps: "default",
    },
};
//# sourceMappingURL=Toolbar.binding.js.map