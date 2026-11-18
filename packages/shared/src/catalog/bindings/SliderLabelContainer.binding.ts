import type { PrimitiveBinding } from "../types";

/**
 * SliderLabelContainer — a Slider's label container (S2 1.8.2 `Slider.tsx` `labelContainer` — a `div`
 * holding the `FieldLabel` and, with the label on top, the `SliderOutput`; 2026-11-18).
 *
 * D1: S2's `div` (outside RAC's structure, no role — RAC unchanged). Part lookups pass through it
 *     (`presence.ts` `PART_FRAME_TYPES` — its Label and value text stay the Slider's).
 * D2: no props of its own.
 * D3: `COMPONENT_RULES_TABLE.SliderLabelContainer` (a `1fr auto` grid) and the Slider's `side` block.
 */
export const sliderLabelContainerBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "sliderlabelcontainer" },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
