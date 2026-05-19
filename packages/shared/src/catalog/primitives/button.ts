import type { PrimitiveBinding } from "../types";
import {
  BUTTON_FILL_STYLE_VALUES,
  BUTTON_SIZE_VALUES,
  BUTTON_TYPE_VALUES,
  BUTTON_VARIANT_VALUES,
  toButtonRacProps,
  type ButtonCanonicalProps,
  type ButtonRacProps,
} from "../outputs/toRacProps";

const buttonAccepts = {
  children: {
    kind: "string",
    label: "Label",
    section: "content",
    default: "Button",
  },
  text: {
    kind: "string",
    label: "Text",
    section: "content",
    inspector: false,
  },
  label: {
    kind: "string",
    label: "Label",
    section: "content",
    inspector: false,
  },
  variant: {
    kind: "variant",
    label: "Variant",
    section: "appearance",
    default: "primary",
  },
  fillStyle: {
    kind: "enum",
    label: "Fill",
    section: "appearance",
    default: "fill",
    options: BUTTON_FILL_STYLE_VALUES.map((value) => ({
      value,
      label: value === "fill" ? "Fill" : "Outline",
    })),
  },
  size: {
    kind: "size",
    label: "Size",
    section: "appearance",
    default: "md",
  },
  type: {
    kind: "enum",
    label: "Type",
    section: "appearance",
    default: "button",
    options: BUTTON_TYPE_VALUES.map((value) => ({
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
  isLoading: {
    kind: "boolean",
    label: "Loading",
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

export const buttonPrimitiveBinding: PrimitiveBinding<
  ButtonCanonicalProps,
  ButtonRacProps
> = {
  tag: "Button",
  family: "primitives/actions",
  runtime: {
    source: "react-aria-components",
    exportName: "Button",
  },
  defaultProps: {
    children: "Button",
    variant: "primary",
    fillStyle: "fill",
    size: "md",
    type: "button",
  },
  props: {
    accepts: buttonAccepts,
  },
  toRacProps: toButtonRacProps,
  skiaPrimitive: { kind: "button" },
};

export const buttonInspectorThemeValues = {
  variants: {
    Button: BUTTON_VARIANT_VALUES,
  },
  sizes: {
    Button: BUTTON_SIZE_VALUES,
  },
};
