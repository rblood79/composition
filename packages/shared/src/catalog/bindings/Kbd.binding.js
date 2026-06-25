/**
 * Kbd — 키보드 키 표시 leaf (`<kbd>`, monospace + 배경/테두리 box).
 *
 * **ADR-912 위험군 해소 (선행-4 deletion-risk → catalog 등록, 2026-06-04)**: [[Code]] 동형.
 *   height>0 box형 + fontFamily mono. catalog 등록으로 rule(`COMPONENT_RULES_TABLE.Kbd`,
 *   fontSize+lineHeight+textWeight:500(키 표시 약간 굵게)+**fontFamily mono**+border) +
 *   buildCatalogShapes generic 으로 이전. fontFamily generic 보강(visual.fontFamily) 으로 mono 정확 재현.
 *
 * **source = internal**: RAC `Keyboard` 는 slot 컴포넌트 → standalone leaf 부적합, internal.
 *   DOM generic fallthrough(`react-aria-Kbd` + getElementForTag→`<kbd>`). Skia = box+text generic(mono).
 *
 * D1: composition `<kbd>` (internal source, generic DOM).
 * D2: children/size 편집 surface.
 * D3: 시각(배경/테두리/텍스트/mono/weight 400)은 theme rule(COMPONENT_RULES_TABLE.Kbd).
 */
export const kbdBinding = {
    source: {
        kind: "internal",
        renderer: "kbd",
    },
    props: {
        accepts: {
            children: { kind: "string", label: "Text", section: "content" },
            size: {
                kind: "size",
                label: "Size",
                section: "appearance",
                default: "sm",
            },
        },
        toRacProps: "default",
    },
};
//# sourceMappingURL=Kbd.binding.js.map