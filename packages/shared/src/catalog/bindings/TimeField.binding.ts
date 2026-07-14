/**
 * ADR-142 family ②(fields) — TimeField leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<TimeField>` 가 Label/DateInput/
 * DateSegment slot 합성(D1). leaf binding — DateField 와 동형 + hourCycle 고유.
 *
 * D3: 자식 DateInput 이 세그먼트, 부모는 빈 box shell(`_hasChildren`). skiaPrimitive 불필요.
 */

import type { PrimitiveBinding } from "../types";

export const timeFieldBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "TimeField",
  },
  rac: {
    primitive: "TimeField",
    parts: ["label", "dateInput", "dateSegment", "description", "fieldError"],
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
      hourCycle: {
        kind: "enum",
        label: "Hour Cycle",
        section: "locale",
        default: "24",
        options: [
          { value: "12", label: "12-hour (AM/PM)" },
          { value: "24", label: "24-hour" },
        ],
      },
      shouldForceLeadingZeros: {
        kind: "boolean",
        label: "Force Leading Zeros",
        section: "locale",
      },
      granularity: {
        kind: "enum",
        label: "Granularity",
        section: "content",
        options: [
          { value: "day", label: "Day" },
          { value: "hour", label: "Hour" },
          { value: "minute", label: "Minute" },
          { value: "second", label: "Second" },
        ],
      },
      isRequired: { kind: "boolean", label: "Required", section: "state" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
      errorMessage: {
        kind: "string",
        label: "Error Message",
        section: "state",
      },
    },
    toRacProps: "default",
    // size 를 TimeField.tsx 가 React prop 으로 소비 + 자기 `data-size` 를 재작성
    //   → passthrough 없으면 default("md") 고정 + toRacProps 의 data-size 를 덮어씀
    //   (DateField.binding 과 동일 근거, 2026-07-14 전수 확장).
    propPassthrough: ["size"],
  },
};
