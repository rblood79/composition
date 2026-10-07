import type { PrimitiveBinding } from "../types";

/**
 * SwitchButton — Switch 의 누르는 자리 (ADR-256 Phase 3 — 레퍼런스 `SwitchField > SwitchButton (indicator +
 * 글자) + Description + FieldError`). DOM 은 RAC `SwitchButton` (`label` — 숨은 switch input 과 자식을 순서대로).
 *
 * D1: RAC 의 `SwitchButton` 그대로 — 상태 (선택 · 눌림 · focus) 는 부모 `SwitchField` context 가 준다.
 * D2: 사용자가 편집하는 prop 없음. 상태 · 이름은 부모 Switch 의 prop 이다.
 * D3: 행 배치 (inline-flex · 가운데 정렬 · size 별 gap) 는 부모 Switch rule 의 `composition.staticSelectors`
 *     `.react-aria-SwitchButton` 블록이 정본 (`rulePartRules` 가 partRule 로 컴파일). 자기 rule 없음.
 */
export const switchButtonBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "switchbutton",
  },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
