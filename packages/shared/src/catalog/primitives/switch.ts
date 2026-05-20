import type { PrimitiveBinding } from "../types";
import {
  SWITCH_SIZE_VALUES,
  toSwitchRacProps,
  type SwitchCanonicalProps,
  type SwitchRacProps,
} from "../outputs/toRacProps";

const switchAccepts = {
  children: {
    kind: "string",
    label: "Label",
    section: "content",
    default: "Switch",
  },
  label: {
    kind: "string",
    label: "Label",
    section: "content",
    inspector: false,
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
    options: SWITCH_SIZE_VALUES.map((value) => ({
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
  isLoading: {
    kind: "boolean",
    label: "Loading",
    section: "state",
    default: false,
  },
  name: {
    kind: "string",
    label: "Name",
    section: "state",
    inspector: false,
  },
  value: {
    kind: "string",
    label: "Value",
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

export const switchPrimitiveBinding: PrimitiveBinding<
  SwitchCanonicalProps,
  SwitchRacProps
> = {
  tag: "Switch",
  family: "selection",
  runtime: {
    source: "react-aria-components",
    exportName: "Switch",
  },
  defaultProps: {
    children: "Switch",
    size: "md",
    isEmphasized: false,
    isSelected: false,
    isDisabled: false,
    isReadOnly: false,
  },
  props: {
    accepts: switchAccepts,
  },
  toRacProps: toSwitchRacProps,
  skiaPrimitive: { kind: "switch" },
};

export const switchInspectorThemeValues = {
  sizes: {
    Switch: SWITCH_SIZE_VALUES,
  },
};
