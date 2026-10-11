import type { PrimitiveBinding } from "../types";

/**
 * CalendarMonthPicker — RAC `CalendarMonthPicker` (ADR-256 Phase 9 — the reference's Month and
 * year pickers: `<CalendarMonthPicker>{props => <Select {...props}>{item =>
 * <SelectItem>{item.formatted}</SelectItem>}</Select>}</CalendarMonthPicker>`). RAC renders no
 * element: it hands its child Select the months (its `items`), the focused month (`value`), the
 * move (`onChange`) and the name (`aria-label`); the Select's ListBox draws its item node once per
 * month (`{formatted}` binds RAC's text). Put in a calendar's header beside or in place of the
 * CalendarHeading.
 *
 * D1: RAC's `CalendarMonthPicker` (no element — its Select is the header's item).
 * D2: RAC's `format` (the month names' form — unset = RAC's `short`, no default stored).
 * D3: none of its own (`display: contents` on the Canvas); its Select's rules.
 */
export const calendarMonthPickerBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "calendarmonthpicker" },
  props: {
    accepts: {
      format: {
        kind: "enum",
        label: "Format",
        section: "content",
        options: [
          { value: "numeric", label: "Numeric" },
          { value: "2-digit", label: "2-Digit" },
          { value: "long", label: "Long" },
          { value: "short", label: "Short" },
          { value: "narrow", label: "Narrow" },
        ],
      },
    },
    toRacProps: "default",
  },
};
