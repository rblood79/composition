import type { PrimitiveBinding } from "../types";

/**
 * Description — compound 컴포넌트의 보조 설명 텍스트 leaf (`<p>`).
 *
 * **ADR-912 위험군 해소 (선행-6 field/form deletion-risk → catalog 등록, 2026-06-04)**:
 *   Description 은 catalog 미등록 상태에서 spec.render.shapes 가 Skia 시각 source 였다(deletion-risk).
 *   catalog 등록으로 시각을 rule (`COMPONENT_RULES_TABLE.Description`, fontSize+lineHeight+textWeight:400
 *   완비) + buildCatalogShapes generic 으로 이전하여 spec 의존을 끊는다. TEXT_LEAF(Text/Heading/Label)
 *   와 시각 source 동형 (text archetype, height:0 inline, transparent fill).
 *
 * **kill criteria 통과 — catalog 등록이 정답 (실측 2026-06-04)**:
 *   - spec render.shapes 가 props.children/style 만 읽음 (부모 의존 변형 0) → Label 의 4단계 변형보다
 *     단순. catalog 전환 직교성 자명.
 *   - standalone palette 없음(ComponentList.tsx:62 주석) + factory 자식 전용(Form/Layout/Display/Overlay)
 *     은 catalog 등록의 차단 사유 아님 — Label 이 동일 전제(standalone 없음)에서 catalog 등록 성공한
 *     선례. "standalone 불가" 는 부모 흡수/projector 의 trigger 가 아님 (render.shapes 부모 데이터
 *     의존이 trigger 인데 Description 은 미해당).
 *   - 부모 흡수는 과잉: implicitStyles 5곳(310/387/1942 등) + ADR-147 itemHeightWithDescription 결합은
 *     **측정·배치 layer**(부모가 자식 Description 에 fontSize/width 주입)이지 **시각 source layer**
 *     (render.shapes)가 아님. Label DFS injection 과 동질 — catalog 등록 후에도 유지, 단계 5(spec 삭제)
 *     시 별도 처리할 측정 layer 영역. 흡수로 끌어오면 N++ 복제(no-classification 위반).
 *
 * **drift 0 확증 (rule 보강 2026-06-04)**: spec render.shapes 기본 fontWeight=400
 *   (Description.spec.ts:111-116) + lineHeight=getLabelLineHeight(fontSize)(typography
 *   FONT_SIZE_TO_LINE_HEIGHT 룩업: 12→16, 14→20). rule 의 variants.default.textWeight=400 +
 *   sizes[*].lineHeight={typography.*--line-height} 가 동일 typography 토큰이라 buildCatalogShapes
 *   generic 과 drift 0. baseline="top"(spec) = catalog isInlineText "top"(height=0) 동일.
 *
 * **source = internal**: RAC standalone `Description` controller 없음(field/compound 자식 slot,
 *   `<Text slot="description">` 기반) → internal. DOM tag 는 `resolveGenericHtmlTag` KNOWN_HTML
 *   Description→`<p>`(CanonicalNodeRenderer.tsx:310). Skia = box+text generic(buildCatalogShapes,
 *   transparent bg + text).
 *
 * D1: composition `<p>` (internal source, generic DOM via KNOWN_HTML).
 * D2: children/size 편집 surface.
 * D3: 시각(텍스트 색 neutral-subdued/크기/lineHeight/weight 400)은 theme rule
 *     (COMPONENT_RULES_TABLE.Description).
 */
export const descriptionBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "description",
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Text", section: "content" },
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
