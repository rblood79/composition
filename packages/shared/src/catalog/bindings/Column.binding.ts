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
