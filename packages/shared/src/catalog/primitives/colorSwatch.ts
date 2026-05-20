import type { PrimitiveBinding } from "../types";
import {
  COLOR_SWATCH_ROUNDING_VALUES,
  COLOR_SWATCH_SIZE_VALUES,
  COLOR_SWATCH_VARIANT_VALUES,
  toColorSwatchRacProps,
  type ColorSwatchCanonicalProps,
  type ColorSwatchRacProps,
} from "../outputs/toRacProps";

const colorSwatchAccepts = {
  color: {
    kind: "string",
    label: "Color",
    section: "content",
    default: "#3B82F6",
  },
  variant: {
    kind: "enum",
    label: "Variant",
    section: "appearance",
    default: "default",
    options: COLOR_SWATCH_VARIANT_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: COLOR_SWATCH_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  rounding: {
    kind: "enum",
    label: "Rounding",
    section: "appearance",
    default: "default",
    options: COLOR_SWATCH_ROUNDING_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  isSelected: {
    kind: "boolean",
    label: "Selected",
    section: "state",
    default: false,
  },
  isDisabled: {
    kind: "boolean",
    label: "Disabled",
    section: "state",
    default: false,
  },
  className: {
    kind: "string",
    label: "Class name",
    section: "appearance",
    inspector: false,
  },
  style: {
    kind: "string",
    label: "Style",
    section: "appearance",
    inspector: false,
  },
} as const;

export const colorSwatchPrimitiveBinding: PrimitiveBinding<
  ColorSwatchCanonicalProps,
  ColorSwatchRacProps
> = {
  tag: "ColorSwatch",
  family: "date-color",
  runtime: {
    source: "react-aria-components",
    exportName: "ColorSwatch",
  },
  defaultProps: {
    color: "#3B82F6",
    variant: "default",
    size: "md",
    rounding: "default",
    isSelected: false,
    isDisabled: false,
  },
  props: {
    accepts: colorSwatchAccepts,
  },
  toRacProps: toColorSwatchRacProps,
  skiaPrimitive: { kind: "color-swatch" },
};

export const colorSwatchInspectorThemeValues = {
  variants: {
    ColorSwatch: COLOR_SWATCH_VARIANT_VALUES,
  },
  sizes: {
    ColorSwatch: COLOR_SWATCH_SIZE_VALUES,
  },
};
