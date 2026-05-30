/**
 * ADR-142 family ②(fields) — SearchField leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<SearchField>` 가 Label/Input/clear
 * Button slot 합성(D1). leaf binding — TextField 와 동형(검색 clear 는 RAC 내장).
 *
 * D3: 자식 Input 이 배경, 부모는 빈 box shell(`_hasChildren`). skiaPrimitive 불필요.
 */

import type { PrimitiveBinding } from "../types";

export const searchFieldBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "SearchField",
  },
  rac: {
    primitive: "SearchField",
    parts: ["label", "input", "description", "fieldError"],
    slots: ["description", "errorMessage"],
    states: ["isDisabled", "isInvalid", "isReadOnly", "isRequired", "isEmpty"],
    renderProps: [
      "isDisabled",
      "isInvalid",
      "isReadOnly",
      "isRequired",
      "isEmpty",
    ],
    dataAttributes: [
      "data-disabled",
      "data-invalid",
      "data-readonly",
      "data-required",
      "data-empty",
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
      placeholder: {
        kind: "string",
        label: "Placeholder",
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
      isRequired: { kind: "boolean", label: "Required", section: "state" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
    },
    toRacProps: "default",
  },
};
