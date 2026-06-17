/**
 * ADR-912 — ColorSwatchPicker container catalog cutover.
 *
 * Factory children(ColorSwatch[]) own the visible swatches. DOM rendering delegates to the
 * existing rendererMap path so ColorSwatch children are wrapped as RAC ColorSwatchPickerItem.
 * Skia uses the componentRulesTable generic shell and independent child ColorSwatch nodes.
 */

import type { PrimitiveBinding } from "../types";

export const colorSwatchPickerBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "colorswatchpicker",
  },
  props: {
    accepts: {
      defaultValue: {
        kind: "string",
        label: "Default Value",
        section: "content",
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
      layout: {
        kind: "enum",
        label: "Layout",
        section: "appearance",
        default: "grid",
        options: [
          { value: "grid", label: "Grid" },
          { value: "stack", label: "Stack" },
        ],
      },
      density: {
        kind: "enum",
        label: "Density",
        section: "appearance",
        default: "regular",
        options: [
          { value: "compact", label: "Compact" },
          { value: "regular", label: "Regular" },
          { value: "spacious", label: "Spacious" },
        ],
      },
      rounding: {
        kind: "enum",
        label: "Rounding",
        section: "appearance",
        default: "default",
        options: [
          { value: "default", label: "Default" },
          { value: "none", label: "None" },
          { value: "full", label: "Full" },
        ],
      },
      columns: {
        kind: "number",
        label: "Columns",
        section: "layout",
        default: 6,
        min: 1,
        max: 12,
        step: 1,
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
