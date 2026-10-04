import type { PrimitiveBinding } from "../types";

/**
 * CheckboxIndicator — Checkbox 의 indicator 상자를 Layers 에 보이는 문서 노드로 둔다 (2026-10-04 사용자
 * 지시 「1안」, RadioItems · CheckboxItems 선례 — ADR-251). DOM 대응: `div.checkbox` (shared `Checkbox` — 체크 · 가로선 아이콘).
 *
 * D1: RAC `Checkbox` 의 DOM · ARIA 변경 0 — indicator record 는 부모 DOM 에 흡수된다 (자기 DOM 없음).
 * D2: 사용자가 편집하는 prop 없음. 상태 (선택 · 비활성 …) 는 부모 Checkbox 의 prop 이다.
 * D3: 크기 · 색 · 모양은 부모 Checkbox rule 이 정본 — 크기는 `size.indicator` 를 partRule 로
 *     (`rulePartRules` toggleIndicatorPartRules), 칠은 부모 rule 의 box `checkbox` primitive 를 이 노드의
 *     상자에서 실행한다 (Canvas `canvasBinding`). 자기 rule 없음 — 생성 CSS 블록 0.
 */
export const checkboxIndicatorBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "checkboxindicator",
  },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
