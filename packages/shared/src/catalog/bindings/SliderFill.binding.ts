import type { PrimitiveBinding } from "../types";

/**
 * SliderFill — the filled part of a Slider's track (ADR-256 Phase 7c — the reference
 * `SliderTrack > SliderFill + SliderThumb`). DOM is RAC `SliderFill`: RAC places it from the
 * Slider's state (`insetInlineStart` · width — from the track start, or between a range's thumbs).
 * The Canvas places its box the same way (`catalogSliderFillLayout`).
 *
 * D1: RAC's `SliderFill` as is (its place is the Slider's state).
 * D2: no props of its own.
 * D3: the fill (`COMPONENT_RULES_TABLE.SliderFill` — accent, full radius).
 */
export const sliderFillBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "sliderfill" },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
    },
    toRacProps: "default",
  },
};
