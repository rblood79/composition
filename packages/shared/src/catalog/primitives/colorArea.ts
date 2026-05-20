import type { PrimitiveBinding } from "../types";
import {
  COLOR_AREA_CHANNEL_VALUES,
  COLOR_AREA_COLOR_SPACE_VALUES,
  COLOR_AREA_SIZE_VALUES,
  toColorAreaRacProps,
  type ColorAreaCanonicalProps,
  type ColorAreaRacProps,
} from "../outputs/toRacProps";

const colorAreaAccepts = {
  color: {
    kind: "string",
    label: "Color",
    section: "content",
    default: "#ff0000",
    placeholder: "#ff0000",
  },
  xValue: {
    kind: "number",
    label: "X Value",
    section: "content",
    default: 0.75,
    min: 0,
    max: 1,
    step: 0.01,
  },
  yValue: {
    kind: "number",
    label: "Y Value",
    section: "content",
    default: 0.25,
    min: 0,
    max: 1,
    step: 0.01,
  },
  xChannel: {
    kind: "enum",
    label: "X Channel",
    section: "content",
    default: "saturation",
    options: COLOR_AREA_CHANNEL_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  yChannel: {
    kind: "enum",
    label: "Y Channel",
    section: "content",
    default: "brightness",
    options: COLOR_AREA_CHANNEL_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  colorSpace: {
    kind: "enum",
    label: "Color Space",
    section: "content",
    default: "hsb",
    options: COLOR_AREA_COLOR_SPACE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: COLOR_AREA_SIZE_VALUES.map((value) => ({
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
    default: "Color area",
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

export const colorAreaPrimitiveBinding: PrimitiveBinding<
  ColorAreaCanonicalProps,
  ColorAreaRacProps
> = {
  tag: "ColorArea",
  family: "date-color",
  runtime: {
    source: "react-aria-components",
    exportName: "ColorArea",
  },
  defaultProps: {
    color: "#ff0000",
    xValue: 0.75,
    yValue: 0.25,
    xChannel: "saturation",
    yChannel: "brightness",
    colorSpace: "hsb",
    size: "md",
    isDisabled: false,
  },
  props: {
    accepts: colorAreaAccepts,
  },
  toRacProps: toColorAreaRacProps,
  skiaPrimitive: { kind: "color-area" },
};

export const colorAreaInspectorThemeValues = {
  sizes: {
    ColorArea: COLOR_AREA_SIZE_VALUES,
  },
};
