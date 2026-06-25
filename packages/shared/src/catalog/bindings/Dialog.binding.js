/**
 * ADR-142 family ⑥(overlays) — Dialog primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. composition wrapper(`Dialog.tsx`)가 RAC
 * Dialog + Heading/dismiss 등을 합성(internal source). overlay 는 portal 렌더라 자식 Heading/
 * Description 은 canonical children 트리(SHELL_ONLY).
 *
 * **Skia generic 발효 (ADR-142 Inc3, 2026-06-01)**: bg 는 buildCatalogShapes(variant fill
 * `{color.layer-1}`), backdrop(반투명 전체화면 rect) + drop shadow 는 skiaPrimitive draw module
 * (`overlay_backdrop` / `dialog_shadow`, 둘 다 prepend=base 앞) 합성. render.shapes 와 parity.
 */
export const dialogBinding = {
    source: {
        kind: "internal",
        renderer: "dialog",
    },
    props: {
        accepts: {
            size: {
                kind: "size",
                label: "Size",
                section: "appearance",
                default: "md",
            },
            isDismissable: {
                kind: "boolean",
                label: "Dismissable",
                section: "state",
            },
        },
        toRacProps: "default",
    },
    // backdrop + shadow (둘 다 base 앞 prepend). box 는 buildCatalogShapes 가 담당.
    skiaPrimitive: ["overlay_backdrop", "dialog_shadow"],
};
//# sourceMappingURL=Dialog.binding.js.map