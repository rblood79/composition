import type { PrimitiveBinding } from "../types";

/**
 * Label — field/form 라벨 leaf (`<label>`).
 *
 * **Canvas**: rule (`COMPONENT_RULES_TABLE.Label`, fontSize + lineHeight + textWeight 완비) — text
 *   시각 (Text/Heading 동형, transparent bg + text).
 *
 * **글자**: field 의 Label 은 Label 원본의 instance 이고 글자는 template 바인딩 (`{label}`) 이
 *   정본이다 — 부모 field 의 `label` prop (ADR-254 Decision 5). 필수 표시는 field 가 Label 노드에
 *   덧붙인다 (`catalogFieldNecessityIndicator`, ADR-253).
 *
 * **DOM (`domBinding.tsx`)**: RAC `Label`. toggle (Checkbox · Radio · Switch) 의 버튼 안 글자는
 *   RAC `Label` 이 아니라 `span` (`toggleTextBinding` — 그룹의 label context 를 받지 않는다).
 *
 * **source = internal**: RAC standalone `Label` controller 없음(field 자식 slot) → internal.
 *
 * D1: RAC `Label` (`<label>`).
 * D2: children/size 편집 surface (부모 field 에 묶인 글자는 부모 prop 이 정본).
 * D3: 시각(텍스트 색/크기/lineHeight/weight 500 — ADR-253)은 theme rule(COMPONENT_RULES_TABLE.Label).
 */
export const labelBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "label",
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Text", section: "content" },
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
