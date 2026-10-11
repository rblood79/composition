/**
 * ColorSlider — RAC `<ColorSlider>` + Label + SliderOutput + `<SliderTrack>` + `<ColorThumb>`.
 *
 * D2 (ADR-258, S2 1.8.0 = RAC 1.21.0 names): `channel` (RAC requires one — default `hue`, the
 * reference's first example) · `colorSpace` · `defaultValue` (RAC color syntax — `racColor`; RAC has no default and
 * throws without one — `hsl(0, 100%, 50%)`, the reference's) · `orientation`. The channel must be
 * in the effective space (`alpha` is in every one) — see ColorArea's note. S2 `label` is the Label
 * node's `{label}` (ADR-258 Phase 2 origin) — empty = RAC writes the channel's name.
 * D3: the track gradient · thumb · Label · SliderOutput text are the document value's function
 * (`runtime/colorControlGradient.ts`).
 */

import type { PrimitiveBinding } from "../types";

export const colorSliderBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "ColorSlider",
  },
  rac: {
    primitive: "ColorSlider",
    parts: ["sliderTrack", "sliderOutput", "colorThumb"],
    slots: [],
    states: ["isDisabled"],
    renderProps: ["isDisabled"],
    dataAttributes: ["data-disabled"],
  },
  props: {
    accepts: {
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      label: { kind: "string", label: "Label", section: "content" },
      defaultValue: {
        kind: "rac-color",
        label: "Default Value",
        section: "content",
        default: "hsl(0, 100%, 50%)",
      },
      channel: {
        kind: "enum",
        label: "Channel",
        section: "appearance",
        default: "hue",
        options: [
          { value: "hue", label: "Hue" },
          { value: "saturation", label: "Saturation" },
          { value: "brightness", label: "Brightness" },
          { value: "lightness", label: "Lightness" },
          { value: "red", label: "Red" },
          { value: "green", label: "Green" },
          { value: "blue", label: "Blue" },
          { value: "alpha", label: "Alpha" },
        ],
      },
      colorSpace: {
        kind: "enum",
        label: "Color Space",
        section: "appearance",
        options: [
          { value: "rgb", label: "RGB" },
          { value: "hsl", label: "HSL" },
          { value: "hsb", label: "HSB" },
        ],
      },
      orientation: {
        kind: "enum",
        label: "Orientation",
        section: "appearance",
        default: "horizontal",
        options: [
          { value: "horizontal", label: "Horizontal" },
          { value: "vertical", label: "Vertical" },
        ],
      },
    },
    toRacProps: "default",
  },
};
