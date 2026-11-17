import type { PrimitiveBinding } from "../types";

/**
 * CalendarMonth — one month's heading group in a calendar's header row (S2 1.8.2 `Calendar.tsx`
 * `CalendarHeader` — `div.heading` per shown month, 2026-11-18; before, ADR-256 Phase 9's month block
 * `div.month > header + CalendarGrid`). A **repeat template**: the resolver shows it once per visible
 * month (`visibleDuration.months`; a days/weeks view: once) and each copy's index is the month offset
 * of the CalendarHeading inside it (RAC `offset={{months: i}}` — not stored). Its state keys
 * `isFirstMonth` · `isLastMonth` show the previous · next Buttons on the first · last group. (The
 * grids repeat on their own in the grid row — a CalendarGrid outside a CalendarMonth.)
 *
 * D1: S2's `div` (outside RAC's structure, no role — RAC unchanged).
 * D2: no props of its own (the calendar has no size — 2026-10-13).
 * D3: `manualBoxRules` CalendarMonth (S2 `headingStyles` — a row: nav Buttons at the ends, heading
 *     between, the groups sharing the header row alike) and its part rules.
 */
export const calendarMonthBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "calendarmonth" },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
