/**
 * ColorArea — RAC `<ColorArea>` + `<ColorThumb>` (2D gradient + thumb).
 *
 * D2 (ADR-258, S2 1.8.0 = RAC 1.21.0 names): `colorSpace` · `xChannel` · `yChannel` · `xName` ·
 * `yName` · `defaultValue` (RAC color syntax — `racColor`, RAC's default `#ffffff`). The axes must
 * be channels of the effective space (`colorSpace`, else the value's own) and differ — a
 * composition restriction RAC throws on; the Design panel widens a pick to a valid combination in
 * one write (`normalizeColorControlPatch`) and the validator refuses the rest. `value`
 * (controlled) is not taken: the Preview runs uncontrolled from `defaultValue` (ADR-250).
 * D3: the gradient · thumb are the document value's function (`runtime/colorControlGradient.ts`) —
 * the Canvas draws them from the same function (ADR-258 Phase 2).
 */

import type { PrimitiveBinding } from "../types";

export const colorAreaBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "ColorArea",
  },
  rac: {
    primitive: "ColorArea",
    parts: ["colorThumb"],
    slots: [],
    states: ["isDisabled"],
    renderProps: ["isDisabled"],
    dataAttributes: ["data-disabled"],
  },
  props: {
    accepts: {
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      defaultValue: {
        kind: "rac-color",
        label: "Default Value",
        section: "content",
        default: "#ffffff",
      },
      colorSpace: {
        kind: "enum",
        label: "Color Space",
        section: "content",
        options: [
          { value: "rgb", label: "RGB" },
          { value: "hsl", label: "HSL" },
          { value: "hsb", label: "HSB" },
        ],
      },
      xChannel: {
        kind: "enum",
        label: "X Channel",
        section: "content",
        options: [
          { value: "hue", label: "Hue" },
          { value: "saturation", label: "Saturation" },
          { value: "brightness", label: "Brightness" },
          { value: "lightness", label: "Lightness" },
          { value: "red", label: "Red" },
          { value: "green", label: "Green" },
          { value: "blue", label: "Blue" },
        ],
      },
      yChannel: {
        kind: "enum",
        label: "Y Channel",
        section: "content",
        options: [
          { value: "hue", label: "Hue" },
          { value: "saturation", label: "Saturation" },
          { value: "brightness", label: "Brightness" },
          { value: "lightness", label: "Lightness" },
          { value: "red", label: "Red" },
          { value: "green", label: "Green" },
          { value: "blue", label: "Blue" },
        ],
      },
      xName: { kind: "string", label: "X Name", section: "content" },
      yName: { kind: "string", label: "Y Name", section: "content" },
    },
    toRacProps: "default",
  },
  // ADR-258 Phase 2: the area's gradient layers (`_colorGradient` — RAC's `useColorAreaGradient`).
  skiaPrimitive: "color_area_fill",
};
