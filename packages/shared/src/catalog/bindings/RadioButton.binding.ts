import type { PrimitiveBinding } from "../types";

/**
 * RadioButton — Radio 의 누르는 자리 (ADR-256 Phase 3 — 레퍼런스 `RadioField > RadioButton (indicator +
 * 글자) + Description`). DOM 은 RAC `RadioButton` (`label` — 숨은 radio input 과 자식을 순서대로).
 *
 * D1: RAC 의 `RadioButton` 그대로 — 상태 (선택 · 눌림 · focus) 는 부모 `RadioField` 와 RadioGroup 이 준다.
 * D2: 사용자가 편집하는 prop 없음. 값 · 상태는 부모 Radio 의 prop 이다.
 * D3: 행 배치 (inline-flex · 가운데 정렬 · size 별 gap) 는 부모 Radio rule 의 `composition.staticSelectors`
 *     `.react-aria-RadioButton` 블록이 정본 (`rulePartRules` 가 partRule 로 컴파일). 자기 rule 없음.
 *
 * `size` 는 내부 운반 값 (`editorHidden`): Radio size 가 글자까지 내려가는 길
 * (`CATALOG_SIZE_PROPAGATION` Radio → RadioButton → Label) — owner 값이 항상 덮는다.
 */
export const radioButtonBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "radiobutton",
  },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
        editorHidden: true,
      },
    },
    toRacProps: "default",
  },
};
