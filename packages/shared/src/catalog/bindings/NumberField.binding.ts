/**
 * ADR-142 family ②(fields) — NumberField leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<NumberField>` 가 Label/Group/Input/
 * stepper Button slot 합성(D1). leaf binding — TextField 와 동형 + number 고유 props.
 *
 * D2: label/description + size/labelPosition/isQuiet + min/max/step(formatOptions 는 미노출,
 *     locale-dependent 라 후속) + state.
 * D3: 자식 Input 이 배경, 부모는 빈 box shell(`_hasChildren`). skiaPrimitive 불필요.
 */

import type { PrimitiveBinding } from "../types";

export const numberFieldBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "NumberField",
  },
  rac: {
    primitive: "NumberField",
    parts: ["label", "group", "input", "description", "fieldError"],
    slots: ["description", "errorMessage"],
    states: ["isDisabled", "isInvalid", "isReadOnly", "isRequired"],
    renderProps: ["isDisabled", "isInvalid", "isReadOnly", "isRequired"],
    dataAttributes: [
      "data-disabled",
      "data-invalid",
      "data-readonly",
      "data-required",
    ],
  },
  props: {
    accepts: {
      label: { kind: "string", label: "Label", section: "content" },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
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
      // RSP labelAlign (2026-08-21, design-data 감사 §1-2 축①) — side 라벨 컬럼 안에서의
      //   라벨 텍스트 정렬. DOM 은 `data-label-align` → catalog nested rule 의
      //   `text-align: var(--form-label-align)`, Canvas 는 같은 rule 블록 (`rulePartRules.ts`
      //   `LABEL_ALIGN_AXIS`). Form 조상 값은 상속하고 (DOM `fieldBase` — `inheritedForm`)
      //   자신이 지정하면 자신이 우선 (nearest-wins).
      labelAlign: {
        kind: "enum",
        label: "Label Align",
        section: "appearance",
        default: "start",
        options: [
          { value: "start", label: "Start" },
          { value: "center", label: "Center" },
          { value: "end", label: "End" },
        ],
        // RSP: labelAlign 은 labelPosition="side" 에서만 의미 (2026-09-15)
        visibleWhen: { key: "labelPosition", equals: "side" },
      },
      isQuiet: { kind: "boolean", label: "Quiet", section: "appearance" },
      // RAC NumberField props
      minValue: { kind: "number", label: "Min Value", section: "content" },
      maxValue: { kind: "number", label: "Max Value", section: "content" },
      step: { kind: "number", label: "Step", section: "content", min: 0 },
      // form binding props
      value: { kind: "string", label: "Value", section: "content" },
      name: { kind: "string", label: "Name", section: "content" },
      errorMessage: {
        kind: "string",
        label: "Error Message",
        section: "state",
      },
      isRequired: { kind: "boolean", label: "Required", section: "state" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC NumberField 공식 prop —
      //   delegatedDom `numberfield` (`nodeTreeField` · `fieldBase`) 가 RAC NumberField 로 전달.
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
      isWheelDisabled: {
        kind: "boolean",
        label: "Wheel Disabled",
        section: "state",
      },
      // RSP 표준 required 표시 방식 — field 가 Label 노드에 덧붙인다 (`catalogFieldNecessityIndicator`)
      necessityIndicator: {
        kind: "enum",
        label: "Necessity Indicator",
        section: "appearance",
        // RSP/RAC 기본 표시는 icon (`*`) — seg 가 선택 없이 시작하지 않도록 (2026-09-16 사용자 결정)
        default: "icon",
        options: [
          { value: "icon", label: "Icon" },
          { value: "label", label: "Label" },
        ],
      },
      // ADR-915 P1-g (2026-07-16): RAC NumberField 공식 locale — delegatedDom `numberfield` 가
      //   `props.locale` 를 RAC NumberField 로 전달(숫자 포맷 로케일).
      locale: { kind: "string", label: "Locale", section: "content" },
    },
    toRacProps: "default",
    // size 는 DOM 에서 delegatedDom `numberfield` (`nodeTreeField`) 가 `data-size` 로 싣는다
    //   (DateField.binding 과 같은 선언, 2026-07-14 전수 확장).
    propPassthrough: ["size"],
  },
};
