import type { PrimitiveBinding } from "../types";

/**
 * SliderThumb — a Slider's handle (ADR-256 Phase 7c — RAC `SliderThumb` in the track). DOM is RAC
 * `SliderThumb` (its input, focus and drag are RAC's; RAC places it at its value). The Canvas places
 * its box the same way (`catalogSliderThumbLayout`) and draws the handle in it (`slider_thumb` — the
 * rule's accent circle and the slider archetype's 2px page-color ring, as the DOM sheet).
 *
 * D1: RAC's `SliderThumb` as is — its `index` is its place among the track's thumbs.
 * D2: size (the Slider's).
 * D3: `COMPONENT_RULES_TABLE.SliderThumb` (box) + the slider archetype's thumb size per owner size.
 */
export const sliderThumbBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "sliderthumb" },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
    },
    toRacProps: "default",
  },
  skiaPrimitive: "slider_thumb",
};
