import type { PrimitiveBinding } from "../types";

/**
 * CardView — Card 그리드/워터폴 컬렉션 레이아웃 컨테이너 (Card 자식 묶음). composition 자체 추상
 * + S2 참조(`react-spectrum.adobe.com/CardView`) — RAC/starter 에 `CardView` 없음(S2 전용).
 * origin template 이 자식 Card×3 을 둔다 (reusableOriginLibrary.ts).
 *
 * **ADR-912 R7 G1-b (container shell catalog cutover, 2026-06-15)**:
 *   DOM CSS · Skia 시각 모두 `COMPONENT_RULES_TABLE.CardView`(variant transparent + sizes sm/md/lg)가
 *   정본이다 (AvatarGroup R7 G1-a 동형).
 *
 * **시각 = generic shell(자식 Card 가 내용 렌더)**: container layout(`display:flex` / `flexWrap:wrap` /
 *   gap / width)은 origin template 의 layout · visual 값이다. rule.sizes 는 gap 을 갖지 않는다.
 *
 * **DOM 렌더 = `CATALOG_DELEGATED_DOM.cardview` (delegatedDom.tsx)**: 자식 Card 노드를
 *   `<div role="grid">` flex-wrap 안에 그린다. 고유 renderer id(`"cardview"`)가 그 항목의 key 다.
 *
 * D1: composition `<div role="grid">` (internal source — delegatedDom 이 role 을 부여).
 * D2: layout/variant/size/density(appearance) + selectionMode/selectionStyle(state) surface.
 *     columns 는 2026-09-10 제거 — S2 CardView 에도 columns 없음 (layout/density 축).
 * D3: 시각(variant transparent + radius 0)은 theme rule(COMPONENT_RULES_TABLE.CardView).
 *     Skia generic box shell ↔ DOM flex-wrap `div` (delegatedDom) 시각 대칭.
 */
export const cardViewBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    // 고유 renderer id — CATALOG_DELEGATED_DOM.cardview 가 자식 Card 노드를 flex-wrap grid 로 그린다.
    renderer: "cardview",
  },
  props: {
    accepts: {
      layout: {
        kind: "enum",
        label: "Layout",
        section: "appearance",
        default: "grid",
        options: [
          { value: "grid", label: "Grid" },
          { value: "waterfall", label: "Waterfall" },
        ],
      },
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        // S2 1.8.0 (2026-10-10): primary · secondary · tertiary · quiet — 안의 Card 들이 입는다
        //   (resolver `applyOwnerVariant`, 빈 자리만). 옛 default 는 로드 시 삭제 → primary.
        default: "primary",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      density: {
        kind: "enum",
        label: "Density",
        section: "appearance",
        default: "regular",
        options: [
          { value: "compact", label: "Compact" },
          { value: "regular", label: "Regular" },
          { value: "spacious", label: "Spacious" },
        ],
      },
      selectionMode: {
        kind: "enum",
        label: "Selection Mode",
        section: "state",
        default: "none",
        options: [
          { value: "none", label: "None" },
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
      selectionStyle: {
        kind: "enum",
        label: "Selection Style",
        section: "state",
        default: "checkbox",
        options: [
          { value: "checkbox", label: "Checkbox" },
          { value: "highlight", label: "Highlight" },
        ],
      },
    },
    toRacProps: "default",
  },
};
