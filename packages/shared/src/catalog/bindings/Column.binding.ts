import type { PrimitiveBinding } from "../types";

/**
 * Column — TableView 헤더 셀 leaf (헤더 텍스트 1개).
 *
 * **ADR-912 catalog cutover (TableView 자식 트리 Skia 대칭, 2026-06-25)**: Column 은 TableView origin
 *   template 의 TableHeader 아래 자식 노드다 (props.children = 컬럼명). Canvas 는
 *   `COMPONENT_RULES_TABLE.Column`(containerStyles flex:1+padding 8px / sizes.M.fontWeight 600) 의
 *   box + `props.children` text 로 헤더 텍스트를 그린다.
 *
 * **DOM (TableView)**: `CATALOG_DELEGATED_DOM.tableview` 가 Column 을 role=columnheader div 로 직접
 *   그린다(`TABLEVIEW_CHILD_STYLE`). PALETTE_ORDER 미포함(단독 배치 불가).
 *
 * D1: TableView — role=columnheader div / Table — RAC `Column`.
 * D2: children(컬럼 헤더 텍스트) + isRowHeader + size.
 * D3: 시각(헤더 텍스트 색/크기/굵기)은 theme rule(COMPONENT_RULES_TABLE.Column) — fontWeight 600
 *     (react-aria-starter `.column-header{font-weight:600}` 정본) + padding 8px(`{spacing.sm}`).
 *     Skia generic(box+text) ↔ DOM div 시각 대칭.
 *
 * **ADR-256 Phase 5i**: RAC Table (catalog `Table`) 안에서는 DOM 이 RAC `Column` 이다 (`domRegistry`
 *   `column` — 노드 트리 그리기). `isRowHeader` (RAC · RSP TableView 의 prop) — 그 열의 칸이 행의 이름이다.
 *   RAC 는 row header 열이 하나도 없으면 throw 하므로, 지정이 없으면 첫 열이 row header 다 (`ruleDom`).
 */
export const columnBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "column",
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
      isRowHeader: { kind: "boolean", label: "Row header", section: "content" },
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
      // ADR-257 — S2 1.8.0 Column widths: the column's track in every row of its Table (the
      // header row and each Row are grids with one shared track list — `tableTracks.ts`).
      //   `width` · `defaultWidth` = `ColumnSize` (px number · "Nfr" · "N%"), `minWidth` ·
      //   `maxWidth` = `ColumnStaticSize` (px number · "N%"). RAC defaults: 1fr over a 75px floor.
      //   composition 제한: numbers only, no numeric strings (RAC's static width parse throws).
      width: { kind: "column-size", label: "Width", section: "appearance" },
      defaultWidth: {
        kind: "column-size",
        label: "Default width",
        section: "appearance",
        editorHidden: true,
      },
      minWidth: {
        kind: "column-static-size",
        label: "Min width",
        section: "appearance",
      },
      maxWidth: {
        kind: "column-static-size",
        label: "Max width",
        section: "appearance",
      },
      // ADR-257 Phase 4 — S2 Column `allowsSorting` · `allowsResizing`: Preview operations. The
      //   sort and the widths a drag leaves are the Preview's runtime state, never the document
      //   (사용자 결정 4 · 5 — `tableSort.ts`); the Canvas keeps the document's order and widths.
      allowsSorting: {
        kind: "boolean",
        label: "Allow Sorting",
        section: "state",
      },
      allowsResizing: {
        kind: "boolean",
        label: "Allow Resizing",
        section: "state",
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
