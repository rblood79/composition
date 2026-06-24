import type { PrimitiveBinding } from "../types";

/**
 * Column — TableView 헤더 셀 leaf (헤더 텍스트 1개).
 *
 * **ADR-912 catalog cutover (TableView 자식 트리 Skia 대칭, 2026-06-25)**: Column 은 canonical
 *   element 가 실재한다(`createTableViewDefinition` 이 TableHeader 아래 Column×N 생성, props.children
 *   = 컬럼명). catalog 미등록 상태에서는 `buildSpecNodeData:994`(`!spec && !isCatalogCutover` →
 *   `return null`)에서 Skia scene node 가 통째로 버려져 **Skia 에 헤더 텍스트가 안 그려졌다**(Preview
 *   는 renderTableView 가 직접 div 로 그림 → CSS↔Skia 비대칭). catalog 등록으로
 *   `isCatalogCutover("Column")` → `buildCatalogShapesOrPrimitive`(box+text) 진입,
 *   `COMPONENT_RULES_TABLE.Column`(containerStyles flex:1+padding 8px / sizes.md.fontWeight 600)
 *   + `buildCatalogShapes` 의 text 분기(`props.children` → text shape)로 헤더 텍스트 렌더.
 *
 * **DOM = 부모 renderTableView self-compose (CanonicalNodeRenderer 위임 경유 안 함)**: TableView
 *   Preview 는 `renderTableView`(LayoutRenderers.tsx)가 자식 트리를 `renderTableViewSubtree` 로
 *   직접 generic div 렌더한다(renderTabs 패턴). canonical Column element 는 존재하지만 DOM 재귀는
 *   부모가 직접 그리므로 Column 독립 cutover 렌더 경로는 타지 않는다 → DOM 변화 0, Skia 대칭만 추가.
 *   PALETTE_ORDER 미포함(단독 배치 불가 — TableView factory 전용 자식, TableCell/TableRow 동형).
 *
 * D1: composition — DOM 은 부모 renderTableView 가 role=columnheader div 로 self-compose.
 * D2: children(컬럼 헤더 텍스트) + size. 편집 surface 최소(TableView factory 생성 자식).
 * D3: 시각(헤더 텍스트 색/크기/굵기)은 theme rule(COMPONENT_RULES_TABLE.Column) — fontWeight 600
 *     (react-aria-starter `.column-header{font-weight:600}` 정본) + padding 8px(`{spacing.sm}`).
 *     Skia generic(box+text) ↔ DOM renderTableView div 시각 대칭.
 *
 * source.renderer "column" 은 DOM 에서 호출되지 않는다(부모 renderTableView self-compose) —
 * primitiveEntry 의 getPrimitiveBinding 타입 계약 충족용. DELEGATING 등록 불요.
 */
export const columnBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "column",
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
