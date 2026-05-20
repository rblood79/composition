import type { PrimitiveBinding } from "../types";
import {
  COLOR_PICKER_SIZE_VALUES,
  COLOR_PICKER_VARIANT_VALUES,
  toColorPickerRacProps,
  type ColorPickerCanonicalProps,
  type ColorPickerRacProps,
} from "../outputs/toRacProps";

const colorPickerAccepts = {
  defaultValue: {
    kind: "string",
    label: "Default Value",
    section: "content",
    default: "#ff0000",
    placeholder: "#ff0000",
  },
  variant: {
    kind: "enum",
    label: "Variant",
    section: "appearance",
    default: "default",
    options: COLOR_PICKER_VARIANT_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: COLOR_PICKER_SIZE_VALUES.map((value) => ({
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
    default: "Color picker",
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

export const colorPickerPrimitiveBinding: PrimitiveBinding<
  ColorPickerCanonicalProps,
  ColorPickerRacProps
> = {
  tag: "ColorPicker",
  family: "date-color",
  runtime: {
    source: "react-aria-components",
    exportName: "ColorPicker",
  },
  defaultProps: {
    defaultValue: "#ff0000",
    variant: "default",
    size: "md",
    isDisabled: false,
  },
  props: {
    accepts: colorPickerAccepts,
  },
  toRacProps: toColorPickerRacProps,
  placement: {
    kind: "node-with-children",
    children: [
      {
        type: "ColorArea",
        props: {
          color: "#ff0000",
          xChannel: "saturation",
          yChannel: "brightness",
          colorSpace: "hsb",
          size: "md",
          xValue: 0.75,
          yValue: 0.25,
          isDisabled: false,
        },
      },
      {
        type: "ColorSlider",
        props: {
          color: "#ff0000",
          channel: "hue",
          colorSpace: "hsb",
          orientation: "horizontal",
          size: "md",
          value: 0,
          isDisabled: false,
        },
      },
      {
        type: "ColorField",
        props: {
          label: "Hex",
          value: "#ff0000",
          placeholder: "#000000",
          colorSpace: "rgb",
          size: "md",
          labelPosition: "top",
          isDisabled: false,
        },
      },
    ],
  },
};

export const colorPickerInspectorThemeValues = {
  sizes: {
    ColorPicker: COLOR_PICKER_SIZE_VALUES,
  },
};
