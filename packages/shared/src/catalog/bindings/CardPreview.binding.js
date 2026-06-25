/**
 * CardPreview — Card 미디어/preview 슬롯 컨테이너 (image/media 영역, composition 자체 추상,
 * RAC/starter 전용 컴포넌트 없음). Card factory(`LayoutComponents.ts`)가 Card 생성 시 CardHeader/
 * CardContent/CardFooter 와 함께 자동 생성한다. palette 미노출 sub-part(FormField/DialogFooter 동형).
 *
 * **ADR-912 childSpec→catalog cutover (2026-06-15)**:
 *   CardPreview 는 `CardPreview.spec.ts`(render.shapes:()=>[], skipCSSGeneration:true) 가 부모
 *   `Card.spec.childSpecs`(ADR-094 expandChildSpecs) 경로로 TAG_SPEC_MAP/Taffy 에 자동 등록되고,
 *   generated CSS 는 Card.css 내부 embed 됐다. catalog 등록으로 시각 source 를 rule
 *   (`COMPONENT_RULES_TABLE.CardPreview`, freeze 정본에 존재) + buildCatalogShapes generic box(shell)로
 *   이전하여 spec 의존(childSpecs 경로)을 끊는다. CardHeader/CardContent/CardFooter 동형 일괄.
 *
 * **시각 = factory props.style SSOT (ADR-907 Layer B)**: preview slot layout(`display:flex` /
 *   `flexDirection:column` / `width:"100%"`)은 catalog cutover 로 factory `props.style`
 *   (LayoutComponents.ts)에 명시한다 — Skia/Taffy 가 직접 read(CardPreview.spec 은 containerStyles
 *   미정의였으나 다른 Card 자식과 동일 컨테이너 패턴 유지). buildCatalogShapes 는 shell-only(미디어 시각은
 *   자식 image/media Element 가 그림).
 *
 * **DOM parity = 변화 0**: INTERNAL_RENDERERS 미등록 → generic fallback 유지. isSpecOrCatalogBacked
 *   가 catalog 등록 후에도 true → `react-aria-CardPreview` className + data-size 보존.
 *
 * D1: composition `<div>` (internal source). D2: size 만. D3: 시각 shell(투명). layout=factory props.style.
 */
export const cardPreviewBinding = {
    source: {
        kind: "internal",
        // 2026-06-24: "div"→"cardpreview" 고유 id. renderCardPreview 가 childrenByParent 로 자식
        //   (Image)을 렌더하는 self-compose → DELEGATING_INTERNAL 보강 필수(Card 본체 동형).
        renderer: "cardpreview",
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
//# sourceMappingURL=CardPreview.binding.js.map