/**
 * CardHeader — Card 헤더 슬롯 컨테이너 (Heading + action button 묶음, composition 자체 추상,
 * RAC/starter 전용 컴포넌트 없음). Card factory(`LayoutComponents.ts`)가 Card 생성 시 CardContent/
 * CardFooter/CardPreview 와 함께 자동 생성한다. palette 미노출 sub-part(FormField/DialogFooter 동형).
 *
 * **ADR-912 childSpec→catalog cutover (2026-06-15)**:
 *   CardHeader 는 `CardHeader.spec.ts`(render.shapes:()=>[], skipCSSGeneration:true) 가 부모
 *   `Card.spec.childSpecs`(ADR-094 expandChildSpecs) 경로로 TAG_SPEC_MAP/Taffy 에 자동 등록되고,
 *   generated CSS 는 Card.css 내부 embed(CSSGenerator embedMode 가 skipCSSGeneration 우회) 됐다.
 *   catalog 등록으로 시각 source 를 rule(`COMPONENT_RULES_TABLE.CardHeader`, 이미 freeze 정본에 존재)
 *   + buildCatalogShapes generic box(shell)로 이전하여 spec 의존(childSpecs 경로)을 끊는다.
 *   FormField/DialogFooter cutover(2026-06-15) 동형 — Card 4 자식 일괄 제거 사례.
 *
 * **시각 = factory props.style SSOT (ADR-907 Layer B)**: 헤더 layout(`display:flex` /
 *   `flexDirection:row` / `alignItems:center` / `width:"100%"`)은 ADR-092 Phase 4/5 가 spec
 *   containerStyles 로 이관했던 것을 catalog cutover 로 factory `props.style`(LayoutComponents.ts)에
 *   되돌린다 — Skia/Taffy 가 직접 read(spec 삭제 후 containerStyles 출처 소멸 대비). buildCatalogShapes
 *   는 shell-only(render.shapes []와 시각 동일 — 헤더 시각은 자식 Heading Element 가 그림).
 *
 * **DOM parity = 변화 0 (FormField/DialogFooter 동형)**: INTERNAL_RENDERERS 미등록 →
 *   CanonicalNodeRenderer generic fallback 유지. isSpecOrCatalogBacked(spec || isCatalogCutover) 가
 *   catalog 등록 후에도 true → `react-aria-CardHeader` className + data-size 보존.
 *
 * D1: composition `<div>` (internal source, generic DOM).
 * D2: size 만 — slot 컨테이너 최소 surface.
 * D3: 시각 shell(투명, fill 없음). layout 은 factory props.style.
 */
export const cardHeaderBinding = {
    source: {
        kind: "internal",
        // 2026-06-24: "div"→"cardheader" 고유 id. renderCardHeader self-compose → DELEGATING 보강 필수.
        renderer: "cardheader",
    },
    props: {
        accepts: {
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
//# sourceMappingURL=CardHeader.binding.js.map