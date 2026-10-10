import type { PrimitiveBinding } from "../types";

/**
 * CalendarYearPicker — RAC `CalendarYearPicker` (ADR-256 Phase 9 — the reference's Month and
 * year pickers: `<CalendarYearPicker>{props => <Select {...props}>{item =>
 * <SelectItem>{item.formatted}</SelectItem>}</Select>}</CalendarYearPicker>`). RAC renders no
 * element: it hands its child Select the years (its `items`), the focused year (`value`), the
 * move (`onChange`) and the name (`aria-label`); the Select's ListBox draws its item node once per
 * year (`{formatted}` binds RAC's text). Put in a calendar's header beside or in place of the
 * CalendarHeading.
 *
 * D1: RAC's `CalendarYearPicker` (no element — its Select is the header's item).
 * D2: no props of its own.
 * D3: none of its own (`display: contents` on the Canvas); its Select's rules.
 */
export const calendarYearPickerBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "calendaryearpicker" },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
