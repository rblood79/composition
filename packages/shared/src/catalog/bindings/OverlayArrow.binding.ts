import type { PrimitiveBinding } from "../types";

/**
 * OverlayArrow — a Popover's · Tooltip's arrow (ADR-256 Phase 8a — the reference
 * `Popover > OverlayArrow + children` · `Tooltip > OverlayArrow + children`). DOM is RAC
 * `OverlayArrow` with the starter's arrow svg (Popover 12 · Tooltip 8): RAC places it from the
 * trigger (`data-placement`) and the overlay's sheet turns and paints the svg. The arrow is there
 * when the node is — the author adds or removes it (G0 ④ `trigger` row).
 *
 * D1: RAC's `OverlayArrow` as is (its place is the overlay's).
 * D2: no props of its own.
 * D3: the overlay's sheet (`.react-aria-OverlayArrow svg` — fill · stroke · turn). No rule of its
 *     own; the Canvas draws no open overlay, so it has no box there.
 */
export const overlayArrowBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "overlayarrow" },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
