import type { PrimitiveBinding } from "../types";

/**
 * CardFooter — Card 푸터 슬롯 컨테이너 (action button 영역, composition 자체 추상, RAC/starter
 * 전용 컴포넌트 없음). Card factory(`LayoutComponents.ts`)가 Card 생성 시 CardHeader/CardContent/
 * CardPreview 와 함께 자동 생성한다. palette 미노출 sub-part(FormField/DialogFooter 동형).
 *
 * **ADR-912 childSpec→catalog cutover (2026-06-15)**:
 *   CardFooter 는 `CardFooter.spec.ts`(render.shapes:()=>[], skipCSSGeneration:true) 가 부모
 *   `Card.spec.childSpecs`(ADR-094 expandChildSpecs) 경로로 TAG_SPEC_MAP/Taffy 에 자동 등록되고,
 *   generated CSS 는 Card.css 내부 embed 됐다. catalog 등록으로 시각 source 를 rule
 *   (`COMPONENT_RULES_TABLE.CardFooter`, freeze 정본에 존재) + buildCatalogShapes generic box(shell)로
 *   이전하여 spec 의존(childSpecs 경로)을 끊는다. CardHeader/CardContent/CardPreview 동형 일괄.
 *
 * **시각 = factory props.style SSOT (ADR-907 Layer B)**: 푸터 layout(`display:flex` /
 *   `flexDirection:row` / `alignItems:center` / `justifyContent:flex-end` / `width:"100%"`)은 ADR-092
 *   Phase 4 가 factory inline 에서 spec containerStyles 로 이관했던 것을 catalog cutover 로 factory
 *   `props.style`(LayoutComponents.ts)에 되돌린다 — Skia/Taffy 가 직접 read. buildCatalogShapes 는
 *   shell-only(푸터 시각은 자식 action button Element 가 그림). DialogFooter(justifyContent:flex-end)와
 *   동일 정렬 패턴.
 *
 * **DOM parity = 변화 0**: INTERNAL_RENDERERS 미등록 → generic fallback 유지. isSpecOrCatalogBacked
 *   가 catalog 등록 후에도 true → `react-aria-CardFooter` className + data-size 보존.
 *
 * D1: composition `<div>` (internal source). D2: size 만. D3: 시각 shell(투명). layout=factory props.style.
 */
export const cardFooterBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "div",
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
