import type { PrimitiveBinding } from "../types";

/**
 * SliderTrackBar — the bar inside a Slider's track (S2 1.8.2 `Slider.tsx` `upperTrack` — a `div` in
 * RAC's `SliderTrack`, holding the `SliderFill`; 2026-11-18). The track is S2's row (24 · 32 · 40 ·
 * 48 — where a press moves the thumb); the bar sits across its middle (thin 4 · thick 16, S2
 * `trackStyling`) and the fill fills it from the value.
 *
 * D1: S2's `div` (outside RAC's structure, no role — RAC unchanged); its disabled look is the
 *     Slider's state (`SliderStateContext` — RAC's `data-disabled` on the fill and thumb).
 * D2: size (the Slider's — `sizePropagation`).
 * D3: `COMPONENT_RULES_TABLE.SliderTrackBar` (S2 `gray-300`, `disabled` while disabled; the thick
 *     bar's height · corner from the Slider's `trackStyle` — `CATALOG_SLIDER_THICK_TRACK`).
 */
export const sliderTrackBarBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "slidertrackbar" },
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
