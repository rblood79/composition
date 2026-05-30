/**
 * ADR-142 family ⑦(date) — DatePicker primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) primitive. composition wrapper(`DatePicker.tsx`)가 RAC DatePicker +
 * Label/Group/DateInput/Button/Popover/Calendar 합성(internal source). Popover+Calendar grid 는
 * 비-box/portal 시각 → DOM-only cutover(skiaLegacy:true).
 */

import type { PrimitiveBinding } from "../types";

export const datePickerBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "datepicker",
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
      showCalendarIcon: {
        kind: "boolean",
        label: "Show Calendar Icon",
        section: "appearance",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
    },
    toRacProps: "default",
  },
};
