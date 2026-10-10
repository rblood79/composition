import type { PrimitiveBinding } from "../types";

/**
 * TableBody — 표 본문 컨테이너 (자식 Row×N flex column).
 *
 * **노드 트리**: Table · TableView origin template 의 `Rows` slot 이다 (`reusableOriginLibrary.ts`
 *   — TableView 는 `TableBody > Row > Cell…`). 바인딩된 Table 의 행은 resolver
 *   `projectTableRows` 가 데이터로 만든다.
 *
 * **Canvas**: `COMPONENT_RULES_TABLE.TableBody`(containerStyles flex column, variant transparent) →
 *   shell box (자식 Row 가 내용 담당).
 *
 * **DOM**: Table · TableView 안에서 `domRegistry.tsx` `INTERNAL_RENDERERS.tablebody` (RAC
 *   TableBody) (ADR-257 Phase 5 — S2 TableView 처럼 RAC Table).
 *
 * D1: Table 안 = RAC `<TableBody>`, TableView 안 = composition div (role=rowgroup).
 * D2: 편집 surface 최소(컨테이너 — 자식 Row 가 내용).
 * D3: 시각(flex column 배치 + transparent)은 theme rule(COMPONENT_RULES_TABLE.TableBody).
 */
export const tableBodyBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "tablebody",
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
