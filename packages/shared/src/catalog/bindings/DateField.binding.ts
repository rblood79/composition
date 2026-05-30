/**
 * ADR-142 family ②(fields) — DateField leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<DateField>` 가 Label/DateInput/
 * DateSegment slot 합성(D1 — DateInput/DateSegment 는 sub-part, 독립 binding 없음). leaf binding.
 *
 * D2: label/description + size/labelPosition/isQuiet + state. min/max/placeholderValue 는
 *     DateValue 타입(문자열 직렬화)이라 미노출(후속 — RAC 고급 props).
 * D3: 자식 DateInput 이 배경/세그먼트, 부모는 빈 box shell(`_hasChildren`). skiaPrimitive 불필요.
 */

import type { PrimitiveBinding } from "../types";

export const dateFieldBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "DateField",
  },
  rac: {
    primitive: "DateField",
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
      hideTimeZone: {
        kind: "boolean",
        label: "Hide Time Zone",
        section: "locale",
      },
      shouldForceLeadingZeros: {
        kind: "boolean",
        label: "Force Leading Zeros",
        section: "locale",
      },
      isRequired: { kind: "boolean", label: "Required", section: "state" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
    },
    toRacProps: "default",
  },
};
