import type { PrimitiveBinding } from "../types";

/**
 * GridListItem — GridList 카드 항목 (box bg+border + label + description).
 *
 * **노드**: GridListItem origin template (`reusableOriginLibrary.ts`
 *   `component-gridlist-item-default`) 이 label · description Text 를 자식 노드로 둔다.
 *
 * **Canvas**: rule `COMPONENT_RULES_TABLE.GridListItem` (variants.default.fill base {color.layer-1} +
 *   colors.border {color.border} + textWeight 600 + sizes.{fontSize/paddingX/paddingY/gap/
 *   borderRadius/borderWidth}) + `gridlist_card` skiaPrimitive (replace 모드 — 카드는 2-line
 *   top-aligned 라 box-center/single-text 가정과 맞지 않는다). 자식 노드가 있으면 (`_hasChildren`)
 *   escape 는 카드 shell(bg+border)만 그리고 글자는 자식 노드가 그린다.
 *
 * **DOM**: `INTERNAL_RENDERERS.gridlistitem` (`GridListItem` — `components/GridList.tsx`) 가 RAC
 *   `<GridListItem>` 을 감싸 render props 를 넘긴다 (`RENDER_PROPS_INTERNAL_RENDERERS`). 부모
 *   GridList 의 RAC collection 안에서 항목이 된다.
 *
 * D1: composition — DOM 은 RAC `<GridList>`/`<GridListItem>` + ARIA(role=row/gridcell).
 *     RAC D1/ARIA 권위 보존.
 * D2: children(label) + size + isDisabled 편집 surface.
 * D3: 시각(카드 box + label + description 색/크기)은 theme rule(COMPONENT_RULES_TABLE.GridListItem) —
 *     fill.default.base + colors.border + textWeight + sizes{paddingX/paddingY/gap}. Canvas
 *     escape(gridlist_card) ↔ DOM RAC 항목 시각 대칭.
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
      // ADR-237 Phase 2 — RAC/RSP 항목 `isDisabled`. Canvas 는 이미 읽는데 (상태 층 disabled) accepts 미선언이라
      //   DOM 에만 닿지 않았다 (두 leg 발산) — Tag 와 같은 선언.
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
  skiaPrimitive: "gridlist_card",
};
