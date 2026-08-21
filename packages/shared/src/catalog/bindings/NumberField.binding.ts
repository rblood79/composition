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
      //   `text-align: var(--form-label-align)`, Skia 는 buildSpecNodeData.resolveLabelAlignment
      //   (start|center|end → left|center|right 매핑). Form 조상 값은 renderer/조상 walk 로 상속하고
      //   자신이 지정하면 자신이 우선 (nearest-wins, 양 경로 동일).
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
      //   renderNumberField 가 shared NumberField(AriaNumberFieldProps extends)로 전달.
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
      isWheelDisabled: {
        kind: "boolean",
        label: "Wheel Disabled",
        section: "state",
      },
      // RSP 표준 required 표시 방식 — renderNumberField 기소비
      necessityIndicator: {
        kind: "enum",
        label: "Necessity Indicator",
        section: "appearance",
        options: [
          { value: "icon", label: "Icon" },
          { value: "label", label: "Label" },
        ],
      },
      // ADR-915 P1-g (2026-07-16): RAC NumberField 공식 locale — renderNumberField
      //   (FormRenderers:273) 가 `element.props.locale` 를 RAC NumberField 로 전달(숫자 포맷
      //   로케일). form-common 4종 중 유일하게 DOM-live 인 셀(labelAlign/validationBehavior 는
      //   개별 field 미소비, 나머지 locale 은 Date/NumberField 외 dead — 감사 후 잔여).
      locale: { kind: "string", label: "Locale", section: "content" },
    },
    toRacProps: "default",
    // size 를 NumberField.tsx 가 React prop 으로 소비 (stepper 버튼 + 입력 크기 결정) + 자기
    //   `data-size` 를 재작성 → passthrough 없으면 default("md") 고정 + toRacProps 의 data-size
    //   를 덮어씀 (DateField.binding 과 동일 근거, 2026-07-14 전수 확장).
    propPassthrough: ["size"],
  },
};
