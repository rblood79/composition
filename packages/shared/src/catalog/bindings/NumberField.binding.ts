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
    },
    toRacProps: "default",
  },
};
