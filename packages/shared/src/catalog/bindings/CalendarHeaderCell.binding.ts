import type { PrimitiveBinding } from "../types";

/**
 * CalendarHeaderCell — RAC `CalendarHeaderCell` (ADR-256 Phase 9 · Decision 13 — the reference API
 * `CalendarGridHeader > {day => <CalendarHeaderCell />}`). A **repeat template**: RAC's grid makes
 * the weekday names and draws this node once per weekday; without children it shows RAC's day name,
 * with children those. The Canvas grid draws the weekday row from the calendar model; the template
 * node has no Canvas box of its own.
 *
 * D1: RAC's `CalendarHeaderCell` (`th`).
 * D2: no props of its own.
 * D3: the Calendar sheets (`.react-aria-CalendarGridHeader th`).
 */
export const calendarHeaderCellBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "calendarheadercell" },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
