import type { PrimitiveBinding } from "../types";

/**
 * Cell — TableView 데이터 셀 leaf (셀 텍스트 1개).
 *
 * **ADR-912 catalog cutover (TableView 자식 트리 Skia 대칭, 2026-06-25)**: Cell 은 TableView origin
 *   template 의 Row 아래 자식 노드다 (props.children = 셀값). Canvas 는 `COMPONENT_RULES_TABLE.Cell`
 *   (containerStyles flex:1+padding 8px) 의 box + `props.children` text 로 셀 텍스트를 그린다. Column
 *   동형(Cell 은 fontWeight 미지정 = 400 base).
 *
 * **DOM**: Table · TableView 안에서 `INTERNAL_RENDERERS.cell` (RAC `Cell`) (ADR-257 Phase 5 — S2 TableView 처럼 RAC Table).
 *
 * D1: RAC `Cell`.
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
      // S2 Table `density` 내부 운반 값 (2026-10-10): Table 에서 전파된다 (resolver) — 패널
      //   미노출. densities 채널 (paddingY 4 · 8 · 12) 이 propVisualRules 로 적용된다.
      density: {
        kind: "enum",
        label: "Density",
        section: "appearance",
        editorHidden: true,
        options: [
          { value: "compact", label: "Compact" },
          { value: "regular", label: "Regular" },
          { value: "spacious", label: "Spacious" },
        ],
      },
      children: { kind: "string", label: "Text", section: "content" },
      // ADR-257 Phase 3 — S2 `align` (start · center · end, S2 default start): this cell's own
      //   text alignment (rule `containerVariants.align`). S2 does not pass a Column's to its
      //   Cells (사용자 결정 7).
      align: {
        kind: "enum",
        label: "Align",
        section: "appearance",
        default: "start",
        options: [
          { value: "start", label: "Start" },
          { value: "center", label: "Center" },
          { value: "end", label: "End" },
        ],
      },
      // ADR-257 Phase 3 — S2 Cell `showDivider` (default false): a 1px line at the cell's end
      //   (rule `containerVariants["show-divider"]`).
      showDivider: {
        kind: "boolean",
        label: "Show Divider",
        section: "appearance",
      },
      // ADR-257 Phase 3 — the Table's S2 `overflowMode`, carried here by the resolver
      //   (`CATALOG_TABLE_OVERFLOW_OWNERS`) — not edited on the part.
      overflowMode: {
        kind: "enum",
        label: "Overflow",
        section: "appearance",
        editorHidden: true,
        options: [
          { value: "truncate", label: "Truncate" },
          { value: "wrap", label: "Wrap" },
        ],
      },
      // ADR-257 Phase 2 — S2 1.8.0 / RAC `Cell colSpan`: the cell takes that many columns of its
      //   row's grid tracks (`grid-column: span k` — Canvas `styleOf` · DOM; RAC gives
      //   `aria-colspan`). A change keeps the row aligned (`setTableCellSpan` — the cells to its
      //   right are taken / new empty ones left).
      colSpan: {
        kind: "number",
        label: "Column span",
        section: "appearance",
        // (No default: an unset span is RAC's own 1 — no `aria-colspan` on every cell.)
        min: 1,
        step: 1,
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
    },
    toRacProps: "default",
  },
};
