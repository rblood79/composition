/**
 * ADR-142 family ③(selection) — Switch leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<Switch>` 가 track+thumb indicator +
 * label slot 합성(D1). leaf binding.
 *
 * D3: indicator(track + thumb)는 비-DOM-trivial → `skiaPrimitive: "switch_toggle"` draw module.
 *     label 은 자식 Label Element 담당.
 */

import type { PrimitiveBinding } from "../types";

export const switchBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "Switch",
  },
  rac: {
    primitive: "Switch",
    parts: ["switch", "indicator", "label"],
    slots: [],
    states: ["isSelected", "isDisabled"],
    renderProps: ["isSelected", "isDisabled"],
    dataAttributes: ["data-selected", "data-disabled"],
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Label", section: "content" },
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
      isSelected: { kind: "boolean", label: "Selected", section: "state" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC Switch 공식 prop —
      //   isReadOnly/name 은 renderSwitch 기소비, value/autoFocus 는 배선 동반.
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      name: { kind: "string", label: "Name", section: "content" },
      value: { kind: "string", label: "Value", section: "content" },
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
    },
    toRacProps: "default",
  },
  // track + thumb indicator — box+text 가 아님.
  skiaPrimitive: "switch_toggle",
};
