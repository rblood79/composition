import type { PrimitiveBinding } from "../types";
import {
  RADIO_SIZE_VALUES,
  RADIO_VARIANT_VALUES,
  toRadioRacProps,
  type RadioCanonicalProps,
  type RadioRacProps,
} from "../outputs/toRacProps";

const radioAccepts = {
  children: {
    kind: "string",
    label: "Label",
    section: "content",
    default: "Radio",
  },
  value: {
    kind: "string",
    label: "Value",
    section: "content",
    default: "radio",
  },
  variant: {
    kind: "enum",
    label: "Variant",
    section: "appearance",
    default: "default",
    options: RADIO_VARIANT_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  isEmphasized: {
    kind: "boolean",
    label: "Emphasized",
    section: "appearance",
    default: false,
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: RADIO_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  isSelected: {
    kind: "boolean",
    label: "Selected",
    section: "state",
    default: false,
  },
  defaultSelected: {
    kind: "boolean",
    label: "Default Selected",
    section: "state",
    inspector: false,
  },
  isDisabled: {
    kind: "boolean",
    label: "Disabled",
    section: "state",
    default: false,
  },
  isReadOnly: {
    kind: "boolean",
    label: "Read Only",
    section: "state",
    default: false,
  },
  autoFocus: {
    kind: "boolean",
    label: "Auto Focus",
    section: "state",
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

export const radioPrimitiveBinding: PrimitiveBinding<
  RadioCanonicalProps,
  RadioRacProps
> = {
  tag: "Radio",
  family: "selection",
  runtime: {
    source: "react-aria-components",
    exportName: "Radio",
  },
  defaultProps: {
    children: "Radio",
    value: "radio",
    variant: "default",
    size: "md",
    isEmphasized: false,
    isSelected: false,
    isDisabled: false,
    isReadOnly: false,
  },
  props: {
    accepts: radioAccepts,
  },
  toRacProps: toRadioRacProps,
  skiaPrimitive: { kind: "radio" },
};

export const radioInspectorThemeValues = {
  variants: {
    Radio: RADIO_VARIANT_VALUES,
  },
  sizes: {
    Radio: RADIO_SIZE_VALUES,
  },
};
