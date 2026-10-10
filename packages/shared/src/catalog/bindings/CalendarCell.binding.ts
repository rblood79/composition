import type { PrimitiveBinding } from "../types";

/**
 * CalendarCell — RAC `CalendarCell` (ADR-256 Phase 9 · Decision 13 — the reference
 * `CalendarGrid > {date => <CalendarCell date={date} />}`). A **repeat template**: RAC's grid makes
 * the dates and draws this node once per date; without children the cell shows RAC's formatted day,
 * with children those (a child's `{formattedDate}` binds RAC's value). The Canvas grid draws the
 * cells from the calendar model; it does not lay out the template node itself.
 *
 * D1: RAC's `CalendarCell` (`td > div[role=button]`, its date · selection · focus — RAC's).
 * D2: no props of its own.
 * D3: the Calendar sheets (`.react-aria-CalendarCell` — the size's box, selected · today paint).
 */
export const calendarCellBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "calendarcell" },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
