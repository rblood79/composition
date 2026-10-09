import type { PrimitiveBinding } from "../types";

/**
 * Description — compound 컴포넌트의 보조 설명 텍스트 leaf (RAC `Text slot="description"`).
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
 *   - standalone palette 없음 + origin template 자식 전용 은 catalog 등록의 차단 사유 아님 — Label 이
 *     동일 전제(standalone 없음)에서 catalog 등록 성공한 선례. "standalone 불가" 는 부모 흡수/projector 의 trigger 가 아님 (render.shapes 부모 데이터
 *     의존이 trigger 인데 Description 은 미해당).
 *
 * **drift 0 확증 (rule 보강 2026-06-04)**: 옛 spec 시각의 기본 fontWeight=400 + lineHeight=
 *   getLabelLineHeight(fontSize)(typography FONT_SIZE_TO_LINE_HEIGHT 룩업: 12→16, 14→20). rule 의
 *   variants.default.textWeight=400 + sizes[*].lineHeight={typography.*--line-height} 가 동일
 *   typography 토큰이라 buildCatalogShapes generic 과 drift 0. baseline="top"(spec) = catalog isInlineText "top"(height=0) 동일.
 *
 * **source = internal**: RAC standalone `Description` controller 없음(field/compound 자식 slot,
 *   `<Text slot="description">` 기반) → internal. DOM = domBinding.tsx `description` binding — RAC
 *   `Text` 를 `slot="description"` 으로 그린다(`RacSlotScope`). Skia = box+text generic
 *   (transparent bg + text).
 *
 * D1: RAC `<Text slot="description">` (internal source).
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
