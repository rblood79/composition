import type { PrimitiveBinding } from "../types";

/**
 * MeterTrack — a Meter's track (ADR-256 Phase 7b — `div.track` of the reference anatomy). DOM is a
 * plain `div.bar` in RAC's `Meter` children — its box the Meter sheet's `.bar` (part rule) —
 * holding the fill node (`MeterFill`, its width `{percentage}%`) and anything the author puts in.
 * The Canvas draws the track box from this rule; the fill draws itself.
 *
 * D1: none — a plain element in RAC's `Meter` children.
 * D2: no props of its own (`variant` · `size` come from its Meter).
 * D3: the track color (neutral-subtle — the Meter sheet's `.bar`).
 */
export const meterTrackBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "metertrack" },
  props: {
    accepts: {
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "informative",
        editorHidden: true,
      },
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
