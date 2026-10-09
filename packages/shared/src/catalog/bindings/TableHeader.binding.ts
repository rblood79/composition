import type { PrimitiveBinding } from "../types";

/**
 * TableHeader — 표 헤더 행 컨테이너 (자식 Column×N flex row).
 *
 * **노드 트리**: Table · TableView origin template 의 `Columns` slot 이다
 *   (`reusableOriginLibrary.ts` — `TableHeader > Column…`).
 *
 * **Canvas**: `COMPONENT_RULES_TABLE.TableHeader`(containerStyles flex row, variant transparent) →
 *   shell box (자식 Column 이 헤더 텍스트 담당).
 *
 * **DOM**: Table 안에서는 `domRegistry.tsx` `INTERNAL_RENDERERS.tableheader` (RAC TableHeader),
 *   TableView 안에서는 `delegatedDom.tsx` `tableview` 가 role=rowgroup div 로 그린다
 *   (`tableViewChildStyle.ts` `TABLEVIEW_CHILD_STYLE`).
 *
 * D1: Table 안 = RAC `<TableHeader>`, TableView 안 = composition div (role=rowgroup).
 * D2: 편집 surface 최소(컨테이너 — 자식 Column 이 내용).
 * D3: 시각(flex row 배치 + transparent)은 theme rule(COMPONENT_RULES_TABLE.TableHeader).
 */
export const tableHeaderBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "tableheader",
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
