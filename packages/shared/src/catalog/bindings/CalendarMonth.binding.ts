import type { PrimitiveBinding } from "../types";

/**
 * CalendarMonth — one month block of a Calendar · RangeCalendar (ADR-256 Phase 9 — the reference
 * starter's `div.month > header + CalendarGrid`). A **repeat template**: the resolver shows it once
 * per visible month (`visibleDuration.months`; a days/weeks view: once) and each copy's index is
 * the month offset of the CalendarHeading · CalendarGrid inside it (RAC `offset={{months: i}}` —
 * not stored). Its state keys `isFirstMonth` · `isLastMonth` show the previous · next Buttons on the
 * first · last block.
 *
 * D1: the starter's `div.month` — outside RAC's structure, no role (RAC unchanged).
 * D2: no props of its own (`size` carried from the calendar).
 * D3: the CalendarMonth rule (a column: header over grid, the calendar size's gap).
 */
export const calendarMonthBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "calendarmonth" },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
        editorHidden: true,
      },
    },
    toRacProps: "default",
  },
};
