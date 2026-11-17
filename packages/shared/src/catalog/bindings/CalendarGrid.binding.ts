import type { PrimitiveBinding } from "../types";

/**
 * CalendarGrid — RAC `CalendarGrid` (ADR-256 Phase 9 — the reference starter's
 * `<CalendarGrid offset={{months: i}}>{date => <CalendarCell date={date} />}</CalendarGrid>`): the
 * weekday row and the week rows of its month block's month (its offset = the block's copy index —
 * not stored). Its one child is the CalendarCell template RAC draws per date (Decision 13); RAC
 * draws the weekday row itself.
 *
 * **Skia = calendar_month_grid replace**: the grid primitive draws the weekday row, the day cells
 * and the today dot from the calendar model (`_calendarGrid` — `runtime/calendarModel.ts`, RAC's
 * date arithmetic for the calendar's duration · first day · weeks at the grid's month offset). The cell
 * template has no Canvas box of its own (`catalogHiddenAtRest`).
 *
 * D1: RAC's `CalendarGrid` (`table[role=grid]` — RAC's dates, keyboard navigation).
 * D2: `defaultToday` (the Canvas today dot) — no size or variant (2026-10-12 · 10-13).
 * D3: the CalendarGrid rule (`sizes.iconSize` — the widest cell) + `manualBoxRules` CalendarGrid (7
 *     cells of 30 by itself, filling the grid row — S2's, 2026-11-18, where the grid repeats per
 *     shown month); the cells follow its width (`catalogCalendarGridSize`).
 */
export const calendarGridBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "calendargrid",
  },
  props: {
    accepts: {
      defaultToday: {
        kind: "boolean",
        label: "Show today",
        section: "content",
        editorHidden: true,
      },
      dayOffset: { kind: "number", label: "Day offset", section: "content", editorHidden: true },
      totalDays: { kind: "number", label: "Total days", section: "content", editorHidden: true },
      todayDate: { kind: "number", label: "Today date", section: "content", editorHidden: true },
    },
    toRacProps: "default",
  },
  skiaPrimitive: "calendar_month_grid",
};
