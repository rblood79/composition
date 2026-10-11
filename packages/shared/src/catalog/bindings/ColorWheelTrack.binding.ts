import type { PrimitiveBinding } from "../types";

/**
 * ColorWheelTrack — a ColorWheel's ring (ADR-258 Phase 2 — RAC `ColorWheelTrack`, the reference
 * `ColorWheel > ColorWheelTrack + ColorThumb`). DOM is RAC `ColorWheelTrack`: RAC sizes it to the
 * wheel and paints the hue sweep clipped to the ring (`useColorWheel` track style). The Canvas
 * draws the same sweep in the same ring (`color_wheel_track` — `colorWheelGradient`).
 *
 * D1: RAC's `ColorWheelTrack` as is. D2: no props (S2's track is internal).
 * D3: `COMPONENT_RULES_TABLE.ColorWheelTrack` (the disabled fill).
 */
export const colorWheelTrackBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "colorwheeltrack" },
  props: {
    accepts: {},
    toRacProps: "default",
  },
  skiaPrimitive: "color_wheel_track",
};
