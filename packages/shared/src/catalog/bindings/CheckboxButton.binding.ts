import type { PrimitiveBinding } from "../types";

/**
 * CheckboxButton — Checkbox 의 누르는 자리 (ADR-256 Phase 3 — 레퍼런스 `CheckboxField > CheckboxButton
 * (indicator + 글자) + Description + FieldError`). DOM 은 RAC `CheckboxButton` (`label` — 숨은 input 과
 * 자식을 순서대로).
 *
 * D1: RAC 의 `CheckboxButton` 그대로 — 상태 (선택 · 눌림 · focus) 는 부모 `CheckboxField` context 가 준다.
 * D2: 사용자가 편집하는 prop 없음. 상태 · 이름 · 값은 부모 Checkbox 의 prop 이다.
 * D3: 행 배치 (inline-flex · 가운데 정렬 · size 별 gap) 는 부모 Checkbox rule 의
 *     `composition.staticSelectors` `.react-aria-CheckboxButton` 블록이 정본 (`rulePartRules` 가 partRule 로
 *     컴파일). 자기 rule 없음 — 생성 CSS 블록 0.
 *
 * `size` 는 내부 운반 값 (`editorHidden`): Checkbox size 가 indicator · 글자까지 내려가는 길
 * (`CATALOG_SIZE_PROPAGATION` Checkbox → CheckboxButton → Label) — owner 값이 항상 덮는다.
 */
export const checkboxButtonBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "checkboxbutton",
  },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
        editorHidden: true,
      },
    },
    toRacProps: "default",
  },
};
