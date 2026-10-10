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
 * D2: no props of its own.
 * D3: none of its own (`display: contents` on the Canvas); its Select's rules.
 */
export const calendarMonthPickerBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "calendarmonthpicker" },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
