import type { PrimitiveBinding } from "../types";

/**
 * ADR-238 Phase 2 — MenuSection: Menu collection 의 묶음 층 (RAC `MenuSection` — 자식 = Header + 항목 · Separator 는 Menu 자식).
 *
 * D1: RAC `MenuSection` 그대로 (`<section>`, Header 로 `aria-labelledby`). 중첩 없음 (한 단계).
 * D2: 새 prop 없음.
 * D3: 상자 시각 없음 (투명) — section 사이 간격 · Header 모양은 목록 CSS 규칙과 Canvas resolver 가 같은 값.
 */
export const menuSectionBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "MenuSection",
  },
  rac: {
    primitive: "MenuSection",
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
