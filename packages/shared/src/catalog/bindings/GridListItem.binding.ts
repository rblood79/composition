import type { PrimitiveBinding } from "../types";

/**
 * GridListItem — GridList 카드 항목 (box bg+border + label + description).
 *
 * **ADR-912 collection sub-part cutover (2026-06-14, Avatar/TreeItem escape 선례 동형)**:
 *   GridListItem 은 catalog 미등록 상태에서 `GridListItem.spec.render.shapes`(카드 roundRect
 *   {color.layer-1} + border {color.border} + label fw600 + description {color.neutral-subdued})가
 *   Skia 시각 유일 source 였다. catalog 등록으로 rule(`COMPONENT_RULES_TABLE.GridListItem`:
 *   variants.default.fill base {color.layer-1} + colors.border {color.border} + textWeight 600 +
 *   sizes.{fontSize/paddingX/paddingY/gap/borderRadius/borderWidth}) + `gridlist_card` skiaPrimitive
 *   (replace 모드 — 카드 box+label+description 전체 자체 생성)로 이전.
 *
 * **replace 모드인 이유**: 카드는 label(top-left) + description(2번째 줄) **2-line top-aligned**
 *   레이아웃이라 buildCatalogShapes 의 box-center/single-text 가정과 충돌(height>0 box 로 오판 →
 *   label center drift). Avatar/SliderTrack 처럼 escape 가 box+text 전체 생성. label/description =
 *   projection(appendGridListRowProjection)이 주입한 props.children/description 보편 데이터
 *   (ADR-142 §3 — 컴포넌트 식별 분기 0).
 *
 * **DOM = 부모 GridList self-compose (독립 노드 0)**: renderGridList(RAC `<GridListItem>`)이 합성.
 *   canonical 문서에 GridListItem element 가 없다(projection 전용 런타임 SceneNode) → DOM 변화 0.
 *   발효 가치는 Skia 대칭(spec 의존 끊기 = step 4 삭제 안전) 한정.
 *
 * D1: composition — DOM 은 RAC `<GridList>`/`<GridListItem>` 이 self-compose + ARIA(role=row/gridcell).
 *     RAC D1/ARIA 권위 보존.
 * D2: children(label) + description + size 편집 surface.
 * D3: 시각(카드 box + label + description 색/크기)은 theme rule(COMPONENT_RULES_TABLE.GridListItem) —
 *     fill.default.base + colors.border + textWeight + sizes{paddingX/paddingY/gap}. Skia generic
 *     escape(gridlist_card) ↔ DOM RAC self-compose 시각 대칭.
 *
 * source.renderer "gridlistitem" 은 DOM 에서 호출되지 않는다(부모 GridList self-compose) —
 * primitiveEntry 의 getPrimitiveBinding 타입 계약 충족용. canonical GridListItem element 가 없어
 * DELEGATING 등록 불요.
 */
export const gridListItemBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "gridlistitem",
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Label", section: "content" },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
    },
    toRacProps: "default",
  },
  skiaPrimitive: "gridlist_card",
};
