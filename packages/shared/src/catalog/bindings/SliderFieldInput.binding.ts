import type { PrimitiveBinding } from "../types";

/**
 * SliderFieldInput — a Slider's field input (S2 1.8.2 `Slider.tsx` — the `fieldInput()` `div` holding
 * the `SliderTrack` and, with the label at the side, the `SliderOutput` after it; 2026-11-18).
 *
 * D1: S2's `div` (outside RAC's structure, no role — RAC unchanged). Part lookups pass through it
 *     (`presence.ts` `PART_FRAME_TYPES` — its track and value text stay the Slider's).
 * D2: size (the Slider's — `sizePropagation`; its gap).
 * D3: `COMPONENT_RULES_TABLE.SliderFieldInput` (a centered row, gap 16 · 16 · 20 · 24).
 */
export const sliderFieldInputBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "sliderfieldinput" },
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
