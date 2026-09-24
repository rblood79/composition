import type { PrimitiveBinding } from "../types";

/**
 * ADR-238 Phase 2 — ListBoxSection: ListBox collection 의 묶음 층 (RAC `ListBoxSection` — 자식 = Header + 항목).
 *
 * D1: RAC `ListBoxSection` 그대로 (`<section>`, Header 로 `aria-labelledby`). 중첩 없음 (한 단계).
 * D2: 새 prop 없음.
 * D3: 상자 시각 없음 (투명) — section 사이 간격 · Header 모양은 목록 CSS 규칙과 Canvas resolver 가 같은 값.
 */
export const listBoxSectionBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "ListBoxSection",
  },
  rac: {
    primitive: "ListBoxSection",
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
