import type { PrimitiveBinding } from "../types";

/**
 * SliderTrack — a Slider's track (ADR-256 Phase 7c — the reference `SliderTrack > SliderFill +
 * SliderThumb`). DOM is RAC `SliderTrack` holding its child nodes (the fill, the thumbs, anything
 * the author puts in); its bar is its own box (the rule's background · full radius — the Canvas the
 * same box), the thumbs overflow it.
 *
 * D1: RAC's `SliderTrack` as is (its pointer handling is RAC's).
 * D2: size (the Slider's — `sizePropagation`).
 * D3: the bar (`COMPONENT_RULES_TABLE.SliderTrack`).
 */
export const sliderTrackBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "slidertrack" },
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
  // ADR-258 Phase 2: in a ColorSlider the track paints the channel gradient (`_colorGradient`); a
  //   Slider's track has none and keeps its rule bar (the primitive returns nothing).
  skiaPrimitive: "color_slider_track",
};
