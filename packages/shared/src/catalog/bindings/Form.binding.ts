/**
 * ADR-142 family ②(fields) — Form leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<Form>` 은 자식 field(TextField 등)를
 * 담는 **컨테이너**(SHELL_ONLY) — `<form>` element + validation 흐름(D1). leaf binding.
 *
 * D2: variant(default·outlined)/size + labelPosition/labelAlign/necessityIndicator(자식 field
 *     상속 hint, data-* 라우팅) + validationBehavior.
 * D3: container 배경(variant)은 theme/tokens data-* rules. Skia 는 `_hasChildren` shell —
 *     자식 field 가 canonical children 트리. skiaPrimitive 불필요(보편 box frame).
 */

import type { PrimitiveBinding } from "../types";

export const formBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "Form",
  },
  rac: {
    primitive: "Form",
    parts: ["form"],
    slots: [],
    states: [],
    renderProps: [],
    dataAttributes: [],
  },
  props: {
    accepts: {
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
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
      necessityIndicator: {
        kind: "enum",
        label: "Necessity Indicator",
        section: "appearance",
        options: [
          { value: "icon", label: "Icon (*)" },
          { value: "label", label: "Label (required)" },
        ],
      },
      validationBehavior: {
        kind: "enum",
        label: "Validation Behavior",
        section: "state",
        default: "native",
        options: [
          { value: "native", label: "Native" },
          { value: "aria", label: "ARIA" },
        ],
      },
      // form HTML attributes — live consumer: FormRenderers.tsx renderForm
      action: { kind: "string", label: "Action", section: "state" },
      method: {
        kind: "enum",
        label: "Method",
        section: "state",
        default: "get",
        options: [
          { value: "get", label: "GET" },
          { value: "post", label: "POST" },
        ],
      },
      encType: {
        kind: "enum",
        label: "Enc Type",
        section: "state",
        options: [
          {
            value: "application/x-www-form-urlencoded",
            label: "URL Encoded",
          },
          { value: "multipart/form-data", label: "Multipart" },
          { value: "text/plain", label: "Plain Text" },
        ],
      },
      target: {
        kind: "enum",
        label: "Target",
        section: "state",
        options: [
          { value: "_self", label: "Self" },
          { value: "_blank", label: "Blank" },
          { value: "_parent", label: "Parent" },
          { value: "_top", label: "Top" },
        ],
      },
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
      restoreFocus: {
        kind: "boolean",
        label: "Restore Focus",
        section: "state",
      },
    },
    toRacProps: "default",
  },
};
