import type { PrimitiveBinding } from "../types";

/**
 * ProgressBarTrack — a ProgressBar's track (the reference `div.track`, ADR-256 Phase 7a). DOM is a
 * plain `div.bar` in RAC's `ProgressBar` children — its box the ProgressBar sheet's `.bar` (part
 * rule) — holding the fill node (`ProgressBarFill`, its width `{percentage}%`) and anything else the
 * author puts in. The Canvas draws the track box from this rule (the owner's variant —
 * `catalogDerivedProps`); the fill draws itself (no `value_fill_bar` over the track).
 *
 * D1: none — a plain element in RAC's `ProgressBar` children.
 * D2: no props of its own (`variant` · `size` come from its ProgressBar).
 * D3: the track color (the owner's DOM `--track-color`).
 */
export const progressBarTrackBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "progressbartrack" },
  props: {
    accepts: {
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
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
