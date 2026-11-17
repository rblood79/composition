import type { PrimitiveBinding } from "../types";

/**
 * CalendarHeader — a calendar's header row (S2 1.8.2 `Calendar.tsx` `CalendarHeader` — `<Header>` of
 * one heading group per shown month, 2026-11-18; before, ADR-256 Phase 9's per-month `header` of the
 * reference starter). Its child is the heading group (`CalendarMonth` — repeated per shown month),
 * which holds the author's parts: `Button[slot=previous]` · `CalendarHeading` (or the month · year
 * pickers) · `Button[slot=next]`. RAC gives the Buttons their paging through the Calendar's
 * `ButtonContext` slots and the heading its text.
 *
 * (Before Phase 9 a leaf the Calendar composed itself — `inline_icon_text` drew the chevrons and the
 * title; the Canvas now draws the parts as nodes, the nav Buttons' box from the heading group's part
 * rules.)
 *
 * D1: S2's `header` (outside RAC's structure, no role — RAC unchanged).
 * D2: no props of its own (the calendar has no size — 2026-10-13).
 * D3: `manualBoxRules` CalendarHeader (a row of the heading groups, S2 `columnGap` 24).
 */
export const calendarHeaderBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "calendarheader",
  },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
