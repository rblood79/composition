import type { PrimitiveBinding } from "../types";
/**
 * Label — field/form 라벨 leaf (`<label>`).
 *
 * **ADR-912 위험군 해소 (선행-6 field/form deletion-risk → catalog 등록, 2026-06-04)**:
 *   Label 은 catalog 미등록 상태에서 spec.render.shapes 가 Skia 시각 + 텍스트 측정 height 의
 *   이중 유일 source 였다(deletion-risk). catalog 등록으로 시각·측정을 rule
 *   (`COMPONENT_RULES_TABLE.Label`, fontSize+lineHeight+textWeight:600 완비) + buildCatalogShapes
 *   generic 으로 이전하여 spec 의존을 끊는다. TEXT_LEAF(Text/Heading) 와 시각 source 동형.
 *
 * **부모 의존 4단계 변형은 catalog 전환과 직교 (실측 2026-06-04, buildSpecNodeData)**:
 *   Label 은 render dispatch 이전(L954 `specProps` 선언 ~ L1030)에 4단계 부모 의존 변형을 받는다 —
 *   (1) `resolveParentLabelText`(부모 field label prop → children) (2) `resolveLabelNecessity`
 *   (필수 표시 `*` → children 접미 + `_necessityIndicator`) (3) `resolveLabelAlignment`
 *   (Form 조상 labelAlign → style.textAlign) (4) `isLabelInNowrapParent`(nowrap). 이 변형들은
 *   dispatch 분기(L1195 `usesGeneric ? buildCatalogShapesOrPrimitive(type, specProps) :
 *   spec.render.shapes(specProps)`) **이전**에 동일 `specProps` 에 누적되고 두 경로가 그 specProps
 *   를 공유하므로, catalog 전환(usesGeneric=true) 후에도 변형이 그대로 buildCatalogShapes 입력으로
 *   전달된다 (children=부모 label+`*`, style.textAlign=labelAlign). → catalog 등록과 직교, 보존.
 *
 * **drift 0 확증 (rule 보강 2026-06-04)**: spec render.shapes 기본값 fontWeight 600 +
 *   lineHeight=getLabelLineHeight(fontSize)(typography FONT_SIZE_TO_LINE_HEIGHT 룩업). rule 의
 *   variants.default.textWeight=600 + sizes[*].lineHeight={typography.*--line-height} 가 동일
 *   typography 토큰이라 buildCatalogShapes generic 과 drift 0. baseline="middle" vs catalog
 *   isInlineText "top" 은 height=0(및 auto-height 단일줄)에서 paddingTop 동일 산출(specShapeConverter
 *   L727/L735) → 렌더 무영향. measure 경로는 baseline 미사용(lineHeight 기반).
 *
 * **source = internal**: RAC standalone `Label` controller 없음(field 자식 slot) → internal.
 *   DOM tag 는 `resolveGenericHtmlTag` → `<label>`(toLowerCase fallback, KNOWN_HTML 불요).
 *   Skia = box+text generic(buildCatalogShapes, transparent bg + text).
 *
 * D1: composition `<label>` (internal source, generic DOM).
 * D2: children/size 편집 surface (부모 field 가 label prop 주입 시 dispatch 변형으로 덮어씀).
 * D3: 시각(텍스트 색/크기/lineHeight/weight 600)은 theme rule(COMPONENT_RULES_TABLE.Label).
 */
export declare const labelBinding: PrimitiveBinding;
//# sourceMappingURL=Label.binding.d.ts.map