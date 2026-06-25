/**
 * IllustratedMessage — 빈 상태(empty state) 표시 leaf (일러스트 placeholder + Heading + Description).
 *
 * **ADR-912 진로 1번 IllustratedMessage proof slice (internal leaf catalog 발효, 2026-06-06)**:
 *   IllustratedMessage 은 catalog 미등록 상태에서 spec.render.shapes(IllustratedMessage.spec.ts:104-187)
 *   가 Skia 시각 source 였다. recon(2026-06-06): heading/description 은 factory `children: []`(자식
 *   Element 아님) → props 직접 소비. render.shapes 는 placeholder roundRect + heading text + description
 *   text 3 shape 를 직접 그린다 → buildCatalogShapes box+text(단일 box+단일 text)로 표현 불가.
 *
 *   **Skia**: `skiaPrimitive: "illustrated_message"` escape(skiaPrimitives.ts, append 모드)가 placeholder+
 *   heading+description 자체 생성. rule fill transparent base box 위에 합성.
 *
 *   **DOM**: source.renderer="illustrated" → INTERNAL_RENDERERS["illustrated"](IllustratedMessage.tsx
 *   React 컴포넌트). heading/description 이 props 라 generic fallback 으로는 안 그려진다(자식 children 0)
 *   → INTERNAL_RENDERERS 어댑터 필수. InlineAlert(heading/description 이 자식 Element → generic fallback)
 *   과 다른 점.
 *
 * D1: composition `<div role="status">` (internal source, INTERNAL_RENDERERS 어댑터).
 * D2: heading + description + variant(default) + size(sm/md/lg) 편집.
 * D3: 시각(placeholder dim + text 색)은 Skia escape + DOM 인라인 style 시각 대칭.
 *     theme rule(COMPONENT_RULES_TABLE.IllustratedMessage)이 fontSize/text 색 base.
 */
export const illustratedMessageBinding = {
    source: {
        kind: "internal",
        renderer: "illustrated",
    },
    staticAttrs: {
        role: "status",
    },
    props: {
        accepts: {
            heading: {
                kind: "string",
                label: "Heading",
                section: "content",
            },
            description: {
                kind: "string",
                label: "Description",
                section: "content",
            },
            // kind:"variant"/"size" 는 options 미보유 — 값 집합은 theme rule 동적 제공.
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
        },
        toRacProps: "default",
    },
    skiaPrimitive: "illustrated_message",
};
//# sourceMappingURL=IllustratedMessage.binding.js.map