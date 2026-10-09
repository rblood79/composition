import type { PrimitiveBinding } from "../types";

/**
 * Row — Table/TableView 데이터 행 컨테이너 (자식 Cell×N flex row).
 *
 * **노드**: TableView origin template (`reusableOriginLibrary.ts`) 은 TableBody 아래 Row(자식
 *   Cell×N)를 노드로 두고, Table 의 행은 Row 원본 (`component-table-row`) 의 instance 다.
 *   PALETTE_ORDER 미포함(Table 가족 전용 자식).
 *
 * **Canvas**: `COMPONENT_RULES_TABLE.Row`(containerStyles flex row, variant transparent) → shell
 *   box(자식 Cell 이 내용 담당). children/text 미보유 → shell-only.
 *
 * **DOM**: RAC Table 안에서는 `INTERNAL_RENDERERS.row` (RAC `Row`, ADR-256 Phase 5i). TableView 안에서는
 *   delegatedDom `tableview` 가 `role=row` div 로 그린다 (`TABLEVIEW_CHILD_STYLE.Row`).
 *
 * D1: RAC Table 안 RAC `Row` / TableView 안 composition `role=row` div.
 * D2: 편집 surface 최소(컨테이너 — 자식 Cell 이 내용).
 * D3: 시각(행 배경 transparent + flex row 배치)은 theme rule(COMPONENT_RULES_TABLE.Row).
 */
export const rowBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "row",
  },
  props: {
    accepts: {
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
