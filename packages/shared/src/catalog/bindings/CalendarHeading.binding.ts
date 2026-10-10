import type { PrimitiveBinding } from "../types";

/**
 * CalendarHeading — RAC `CalendarHeading` (ADR-256 Phase 9 — the reference starter's
 * `<CalendarHeading offset={{months: i}} />`): the month its block shows (a days/weeks view: the
 * shown day range), formatted by RAC in the calendar's locale. Its offset is its CalendarMonth
 * block's index (not stored).
 *
 * D1: RAC's `CalendarHeading` (a `Heading` whose text RAC writes).
 * D2: no props of its own (`size` carried from the calendar).
 * D3: the Calendar rule's `header .react-aria-CalendarHeading` (centered bold title at the size's
 *     font).
 */
export const calendarHeadingBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "calendarheading" },
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
