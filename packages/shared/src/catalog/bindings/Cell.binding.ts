import type { PrimitiveBinding } from "../types";

/**
 * Cell — TableView 데이터 셀 leaf (셀 텍스트 1개).
 *
 * **ADR-912 catalog cutover (TableView 자식 트리 Skia 대칭, 2026-06-25)**: Cell 은 TableView origin
 *   template 의 Row 아래 자식 노드다 (props.children = 셀값). Canvas 는 `COMPONENT_RULES_TABLE.Cell`
 *   (containerStyles flex:1+padding 8px) 의 box + `props.children` text 로 셀 텍스트를 그린다. Column
 *   동형(Cell 은 fontWeight 미지정 = 400 base).
 *
 * **DOM**: TableView 안에서는 `CATALOG_DELEGATED_DOM.tableview` 가 Cell 을 role=gridcell div 로 직접
 *   그린다(`TABLEVIEW_CHILD_STYLE`). RAC Table (catalog `Table`) 안에서는 `INTERNAL_RENDERERS.cell`
 *   (RAC `Cell`) 이다.
 *
 * D1: TableView — role=gridcell div / Table — RAC `Cell`.
 * D2: children(셀 텍스트) + size.
 * D3: 시각(셀 텍스트 색/크기)은 theme rule(COMPONENT_RULES_TABLE.Cell) — padding 8px(`{spacing.sm}`,
 *     react-aria-starter `.react-aria-Cell{padding:var(--spacing-2)}`=8px 정본). Skia generic(box+text)
 *     ↔ DOM div 시각 대칭.
 */
export const cellBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "cell",
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
