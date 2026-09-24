import type { PrimitiveBinding } from "../types";

/**
 * ADR-238 Phase 2 — GridListSection: GridList collection 의 묶음 층 (RAC `GridListSection` — 자식 = Header (`GridListHeader` 로 렌더) + 항목).
 *
 * D1: RAC `GridListSection` 그대로 (`<section>`, Header 로 `aria-labelledby`). 중첩 없음 (한 단계).
 * D2: 새 prop 없음.
 * D3: 상자 시각 없음 (투명) — section 사이 간격 · Header 모양은 목록 CSS 규칙과 Canvas resolver 가 같은 값.
 */
export const gridListSectionBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "GridListSection",
  },
  rac: {
    primitive: "GridListSection",
    parts: ["section"],
    slots: [],
    states: [],
    renderProps: [],
    dataAttributes: [],
  },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
