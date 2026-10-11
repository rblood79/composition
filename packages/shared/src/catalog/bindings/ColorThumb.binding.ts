import type { PrimitiveBinding } from "../types";

/**
 * ColorThumb — the handle of a ColorArea · ColorSlider · ColorWheel (ADR-258 Phase 2 — RAC
 * `ColorThumb`, the reference `ColorArea > ColorThumb` · `ColorSlider > … SliderTrack > ColorThumb` ·
 * `ColorWheel > ColorWheelTrack + ColorThumb`). DOM is RAC `ColorThumb` (its inputs, focus and drag
 * are RAC's; RAC places it and paints it the displayed color). The Canvas places its box the same
 * way (`catalogColorThumbLayout`) and draws the handle in it (`color_thumb` — the owner value's
 * display color, `colorControlThumb`).
 *
 * D1: RAC's `ColorThumb` as is. D2: no props (S2 has none — its handle is internal).
 * D3: `COMPONENT_RULES_TABLE.ColorThumb` (size · ring · shadow · focus size).
 */
export const colorThumbBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "colorthumb" },
  props: {
    accepts: {},
    toRacProps: "default",
  },
  skiaPrimitive: "color_thumb",
};
