/**
 * ADR-142 family ⑦(date) — DateRangePicker primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) primitive. composition wrapper(`DateRangePicker.tsx`)가 RAC DateRangePicker +
 * Label/Group/DateInput(start·end)/Button/Popover/RangeCalendar 합성(internal source). Popover+
 * 범위 grid 비-box/portal 시각 → DOM-only cutover(skiaLegacy:true).
 */

import type { PrimitiveBinding } from "../types";

export const dateRangePickerBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "daterangepicker",
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
