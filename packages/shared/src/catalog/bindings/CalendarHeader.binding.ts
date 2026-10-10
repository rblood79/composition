import type { PrimitiveBinding } from "../types";

/**
 * CalendarHeader — a Calendar month block's `header` (ADR-256 Phase 9 — the reference starter's
 * `<header>{previous Button} <CalendarHeading /> {next Button}</header>`). A container: its parts are
 * the author's nodes — `Button[slot=previous]` · `CalendarHeading` (or the month · year pickers) ·
 * `Button[slot=next]` — which can be reordered, wrapped or swapped. RAC gives the Buttons their
 * paging through the Calendar's `ButtonContext` slots and the heading its text.
 *
 * (Before Phase 9 a leaf the Calendar composed itself — `inline_icon_text` drew the chevrons and the
 * title; the Canvas now draws the parts as nodes, the nav Buttons' box from the Calendar's part
 * rules.)
 *
 * D1: the starter's `header` (outside RAC's structure, no role — RAC unchanged).
 * D2: `size` (carried from the calendar).
 * D3: the CalendarHeader rule (a row: nav Buttons at the ends, heading between).
 */
export const calendarHeaderBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "calendarheader",
  },
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
