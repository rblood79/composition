import type { PrimitiveBinding } from "../types";

/**
 * CheckboxItems — CheckboxGroup 의 항목 묶음 상자 (ADR-251, TagGroup > TagList 동형). DOM 은 부모 CheckboxGroup
 * 이 self-compose 하는 `div.checkbox-items` 하나 (shared `CheckboxGroup` — RAC 구조 밖, role 없음).
 *
 * D1: RAC `CheckboxGroup` 의 DOM · ARIA 변경 0 — 묶음 record 는 그룹 DOM 에 흡수된다 (`absorbsChild`).
 * D2: 사용자가 편집하는 prop 없음. `orientation` 은 그룹의 prop 이다.
 * D3: 방향 · 정렬 · gap 은 그룹 rule 의 `containerVariants.orientation` `.checkbox-items` 블록이 정본
 *     (`rulePartRules` 가 묶음 partRule 로 컴파일). 자기 rule 없음 — 생성 CSS 블록 0.
 *
 * `size` 는 내부 운반 값 (`editorHidden`): 그룹 size 가 항목까지 내려가는 길
 * (`CATALOG_SIZE_PROPAGATION` CheckboxGroup → CheckboxItems → Checkbox) — owner 값이 항상 덮는다.
 */
export const checkboxItemsBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "checkboxitems",
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
