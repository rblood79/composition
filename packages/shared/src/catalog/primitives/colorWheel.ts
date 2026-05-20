import type { PrimitiveBinding } from "../types";
import {
  COLOR_WHEEL_SIZE_VALUES,
  toColorWheelRacProps,
  type ColorWheelCanonicalProps,
  type ColorWheelRacProps,
} from "../outputs/toRacProps";

const colorWheelAccepts = {
  color: {
    kind: "string",
    label: "Color",
    section: "content",
    default: "#ff0000",
    placeholder: "#ff0000",
  },
  hue: {
    kind: "number",
    label: "Hue",
    section: "content",
    default: 0,
    min: 0,
    max: 360,
    step: 1,
  },
  outerRadius: {
    kind: "number",
    label: "Outer Radius",
    section: "appearance",
    default: 100,
    min: 1,
    max: 240,
    step: 1,
  },
  innerRadius: {
    kind: "number",
    label: "Inner Radius",
    section: "appearance",
    default: 74,
    min: 0,
    max: 239,
    step: 1,
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: COLOR_WHEEL_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
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
    default: "Color wheel",
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

export const colorWheelPrimitiveBinding: PrimitiveBinding<
  ColorWheelCanonicalProps,
  ColorWheelRacProps
> = {
  tag: "ColorWheel",
  family: "date-color",
  runtime: {
    source: "react-aria-components",
    exportName: "ColorWheel",
  },
  defaultProps: {
    color: "#ff0000",
    hue: 0,
    outerRadius: 100,
    innerRadius: 74,
    size: "md",
    isDisabled: false,
  },
  props: {
    accepts: colorWheelAccepts,
  },
  toRacProps: toColorWheelRacProps,
  skiaPrimitive: { kind: "color-wheel" },
};

export const colorWheelInspectorThemeValues = {
  sizes: {
    ColorWheel: COLOR_WHEEL_SIZE_VALUES,
  },
};
