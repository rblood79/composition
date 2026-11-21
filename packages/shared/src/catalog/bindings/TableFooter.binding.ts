import type { PrimitiveBinding } from "../types";

/**
 * TableFooter — 표 바닥글 컨테이너 (ADR-315 Phase 5 증분 5c — 합계 행).
 *
 * **노드 트리**: Table 의 「Totals row」 스위치가 Table 의 소유 자식으로 TableBody 뒤에 넣는다 —
 *   `TableFooter > Row > Cell…` (열마다 칸 하나, 선택 열이면 빈 선택 칸). 연결된 Table 은 그 Row 를
 *   합계 행으로 읽는다 — 칸의 `{열 key}` 가 그 열의 집계 (Column 「Aggregate」) 를 거르기 · 정렬 뒤
 *   모든 행 위에서 읽는다 (`CatalogBoundRows.totals`).
 *
 * **Canvas**: `COMPONENT_RULES_TABLE.TableFooter` (TableBody 와 같은 flex column, 투명) → shell box.
 *
 * **DOM**: Table 안에서 `INTERNAL_RENDERERS.tablefooter` (RAC TableFooter — 행은 선택 · 정렬 밖).
 *
 * D1: RAC `<TableFooter>`.
 * D2: 사용자 prop 없음 (켜고 끄는 것은 Table 의 스위치 — 노드의 있음 · 없음).
 * D3: 시각은 theme rule (COMPONENT_RULES_TABLE.TableFooter).
 */
export const tableFooterBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "tablefooter",
  },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
