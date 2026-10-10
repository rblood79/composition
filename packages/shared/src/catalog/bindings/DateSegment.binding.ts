import type { PrimitiveBinding } from "../types";

/**
 * DateSegment — RAC `DateSegment` (ADR-256 Phase 9 · Decision 13 — the reference starter's
 * `<DateInput>{segment => <DateSegment segment={segment} />}</DateInput>`). A **repeat template**:
 * RAC's DateInput makes the segments (year · month · day · literals …) and draws this node once per
 * segment. The Canvas DateInput draws the segment row itself (`datefield_segments`); the template
 * node has no Canvas box of its own.
 *
 * D1: RAC's `DateSegment` (`span[role=spinbutton]` · literals).
 * D2: no props of its own.
 * D3: the field sheets (`.react-aria-DateSegment` — padding, placeholder paint).
 */
export const dateSegmentBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "datesegment" },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
