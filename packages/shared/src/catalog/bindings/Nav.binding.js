/**
 * Nav — HTML5 `<nav>` 네비게이션 컨테이너 leaf.
 *
 * **ADR-912 container shell 3 catalog 등록 (Body/Section/Nav, 2026-06-04)**:
 *   Nav 는 catalog 미등록 상태에서 spec.render.shapes(Nav.spec.ts:100-130) 가 Skia 시각 source
 *   였다. catalog 등록으로 시각을 rule(`COMPONENT_RULES_TABLE.Nav`, default/accent fill) +
 *   buildCatalogShapes generic box 로 이전. Nav 는 SHELL_ONLY_CONTAINER_TAGS **비멤버**라
 *   _hasChildren 은 자식 있을 때만 주입(buildSpecNodeData:1128-1132). 단 spec.render.shapes 도
 *   자식 무관 bg roundRect 1개만 그리고(Nav.spec.ts:117-127) 자식 placeholder 가 없으므로,
 *   buildCatalogShapes 가 box 만 그려도 시각 대칭(Nav 는 height>0 box → text 분기는 children/
 *   text/label 없으면 미진입). 빈 Nav 도 bg 만 — spec parity.
 *
 * **DOM = renderNav rendererMap 위임 (DELEGATING_INTERNAL_RENDERERS, 2026-06-10 sweep)**: renderNav
 *   (LayoutRenderers.tsx)은 `context.childrenByParent.get(id)` 로 자식을 받아 `<nav>` 안에 재귀
 *   렌더한다(fallback 없음). canonical 렌더 경로의 renderContext.childrenByParent 가 비어 있어,
 *   DELEGATING 미등록 시 자식 0개 빈 nav 로 렌더된다(disclosuregroup 동형). DELEGATING 등록으로
 *   flattenNodeChildrenByParent 보강 위임 → 자식 정상 렌더. isSpecOrCatalogBacked true →
 *   `react-aria-Nav` + data-size/data-variant + generated CSS(Nav.css) 매칭 보존. role="navigation"/
 *   aria-label 은 renderNav 가 직접 부여(rule/CSS 영역 외 D1).
 *
 * D1: composition `<nav>` (internal source, generic DOM via lowercase fallback → "nav").
 * D2: variant(default/accent) + size(sm/md/lg) + aria-label 편집 surface.
 * D3: 시각(variant 별 배경/패딩)은 theme rule(COMPONENT_RULES_TABLE.Nav).
 */
export const navBinding = {
    source: {
        kind: "internal",
        renderer: "nav",
    },
    props: {
        accepts: {
            "aria-label": {
                kind: "string",
                label: "aria-label",
                section: "content",
            },
            // kind:"variant"/"size" 는 options 미보유(types.ts:139-142) — theme rule 동적 제공.
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
};
//# sourceMappingURL=Nav.binding.js.map