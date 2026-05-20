import type { PrimitiveBinding } from "../types";
import {
  COLOR_SLIDER_CHANNEL_VALUES,
  COLOR_SLIDER_COLOR_SPACE_VALUES,
  COLOR_SLIDER_ORIENTATION_VALUES,
  COLOR_SLIDER_SIZE_VALUES,
  toColorSliderRacProps,
  type ColorSliderCanonicalProps,
  type ColorSliderRacProps,
} from "../outputs/toRacProps";

const colorSliderAccepts = {
  color: {
    kind: "string",
    label: "Color",
    section: "content",
    default: "#ff0000",
    placeholder: "#ff0000",
  },
  value: {
    kind: "number",
    label: "Value",
    section: "content",
    default: 0.5,
    min: 0,
    max: 1,
    step: 0.01,
  },
  channel: {
    kind: "enum",
    label: "Channel",
    section: "content",
    default: "hue",
    options: COLOR_SLIDER_CHANNEL_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  colorSpace: {
    kind: "enum",
    label: "Color Space",
    section: "content",
    default: "hsb",
    options: COLOR_SLIDER_COLOR_SPACE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: COLOR_SLIDER_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  orientation: {
    kind: "enum",
    label: "Orientation",
    section: "appearance",
    default: "horizontal",
    options: COLOR_SLIDER_ORIENTATION_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  isDisabled: {
    kind: "boolean",
    label: "Disabled",
    section: "state",
    default: false,
  },
  "aria-label": {
    kind: "string",
    label: "ARIA Label",
    section: "state",
    default: "Color slider",
    inspector: false,
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

export const colorSliderPrimitiveBinding: PrimitiveBinding<
  ColorSliderCanonicalProps,
  ColorSliderRacProps
> = {
  tag: "ColorSlider",
  family: "date-color",
  runtime: {
    source: "react-aria-components",
    exportName: "ColorSlider",
  },
  defaultProps: {
    color: "#ff0000",
    value: 0.5,
    channel: "hue",
    colorSpace: "hsb",
    orientation: "horizontal",
    size: "md",
    isDisabled: false,
  },
  props: {
    accepts: colorSliderAccepts,
  },
  toRacProps: toColorSliderRacProps,
  skiaPrimitive: { kind: "color-slider" },
};

export const colorSliderInspectorThemeValues = {
  sizes: {
    ColorSlider: COLOR_SLIDER_SIZE_VALUES,
  },
};
