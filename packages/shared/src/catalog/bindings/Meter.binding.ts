import type { PrimitiveBinding } from "../types";

/**
 * Meter — 측정값 표시 (ADR-256 Phase 7b: 노드 트리).
 *
 * DOM 은 RAC `Meter` 가 자식 노드를 순서대로 그린다 (`delegatedDom` `meter`) — 원본
 * `Meter > Label + MeterValue {valueText} + MeterTrack > MeterFill (width {percentage}%)` 와 작성자가
 * 넣은 자유 내용. 값 글자 · 채움 폭은 RAC render props 값 바인딩 (Decision 12 — `valueBindings.ts`).
 * Canvas: 부모는 빈 상자, track · fill 노드가 각자 rule 로 칠한다 (fill 은 variant 4색).
 *
 * D1: RAC `<Meter role="meter progressbar">` 그대로.
 * D2: value · minValue · maxValue · label · variant (informative · positive · warning · critical) ·
 *     size · showValueLabel · valueLabel · labelPosition. isIndeterminate 없음 (RAC Meter 에 없다).
 * D3: catalog Meter rule (`.bar` · `.value` · `.fill`) + MeterTrack · MeterFill rule.
 */
export const meterBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "meter",
  },
  props: {
    accepts: {
      value: {
        kind: "number",
        label: "Value",
        section: "content",
        default: 75,
      },
      minValue: {
        kind: "number",
        // RAC/HTML 기본과 같은 값 — 패널이 비어 보이지 않게 (2026-09-16)
        default: 0,
        label: "Min",
        section: "content",
      },
      maxValue: {
        kind: "number",
        // RAC/HTML 기본과 같은 값 — 패널이 비어 보이지 않게 (2026-09-16)
        default: 100,
        label: "Max",
        section: "content",
      },
      label: { kind: "string", label: "Label", section: "content" },
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "informative",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      showValueLabel: {
        kind: "boolean",
        label: "Show Value Label",
        section: "appearance",
      },
      // RAC/RSP 정합 감사 (2026-07-15): valueLabel 은 delegatedDom `meter` 가 RAC `Meter` 에 넘기고,
      //   값 글자는 MeterValue 노드 (`{valueText}`) 가 그린다. labelPosition(top/side) 은 D3 구현
      //   완료로 재노출 — CSS(catalog structure.composition.containerVariants["label-position"].side →
      //   generated Meter.css) + Canvas(같은 containerVariants — `rulePartRules.ts`
      //   `CONTAINER_VARIANT_AXES`). side = label · track · value 가로 배치.
      labelPosition: {
        kind: "enum",
        label: "Label Position",
        section: "appearance",
        default: "top",
        options: [
          { value: "top", label: "Top" },
          { value: "side", label: "Side" },
        ],
      },
      valueLabel: {
        kind: "string",
        label: "Value Label",
        section: "appearance",
        // RSP: valueLabel 은 showValueLabel 일 때만 표시 (2026-09-15)
        visibleWhen: { key: "showValueLabel", equals: true },
      },
    },
    toRacProps: "default",
  },
};
