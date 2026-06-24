import type { PrimitiveBinding } from "../types";

/**
 * Cell — TableView 데이터 셀 leaf (셀 텍스트 1개).
 *
 * **ADR-912 catalog cutover (TableView 자식 트리 Skia 대칭, 2026-06-25)**: Cell 은 canonical
 *   element 가 실재한다(`createTableViewDefinition` 이 Row 아래 Cell×N 생성, props.children = 셀값).
 *   catalog 미등록 시 `buildSpecNodeData:994` 에서 Skia scene node 가 null 로 버려져 **Skia 에 셀
 *   텍스트가 안 그려졌다**(Preview 는 renderTableView 직접 렌더 → CSS↔Skia 비대칭). catalog 등록으로
 *   `isCatalogCutover("Cell")` → `buildCatalogShapesOrPrimitive`(box+text),
 *   `COMPONENT_RULES_TABLE.Cell`(containerStyles flex:1+padding 8px) + `buildCatalogShapes` text
 *   분기(`props.children` → text)로 셀 텍스트 렌더. Column 동형(Cell 은 fontWeight 미지정 = 400 base).
 *
 * **DOM = 부모 renderTableView self-compose (위임 경유 안 함)**: renderTableView 가
 *   renderTableViewSubtree 로 자식 트리를 직접 div 렌더. canonical Cell element 존재하나 DOM 재귀는
 *   부모가 담당 → Cell 독립 cutover 렌더 경로 미진입 → DOM 변화 0, Skia 대칭만 추가.
 *   PALETTE_ORDER 미포함(TableView factory 전용 자식, TableCell/TableRow 동형).
 *
 * D1: composition — DOM 은 부모 renderTableView 가 role=gridcell div 로 self-compose.
 * D2: children(셀 텍스트) + size.
 * D3: 시각(셀 텍스트 색/크기)은 theme rule(COMPONENT_RULES_TABLE.Cell) — padding 8px(`{spacing.sm}`,
 *     react-aria-starter `.react-aria-Cell{padding:var(--spacing-2)}`=8px 정본). Skia generic(box+text)
 *     ↔ DOM renderTableView div 시각 대칭.
 *
 * source.renderer "cell" 은 DOM 에서 호출되지 않는다(부모 self-compose) — getPrimitiveBinding 타입
 * 계약 충족용. DELEGATING 등록 불요.
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
