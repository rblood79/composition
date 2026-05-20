import type { PrimitiveBinding } from "../types";
import {
  TOGGLE_BUTTON_SIZE_VALUES,
  toToggleButtonRacProps,
  type ToggleButtonCanonicalProps,
  type ToggleButtonRacProps,
} from "../outputs/toRacProps";

const toggleButtonAccepts = {
  children: {
    kind: "string",
    label: "Label",
    section: "content",
    default: "Toggle",
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
  isEmphasized: {
    kind: "boolean",
    label: "Emphasized",
    section: "appearance",
    default: false,
  },
  isQuiet: {
    kind: "boolean",
    label: "Quiet",
    section: "appearance",
    default: false,
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: TOGGLE_BUTTON_SIZE_VALUES.map((value) => ({
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

export const toggleButtonPrimitiveBinding: PrimitiveBinding<
  ToggleButtonCanonicalProps,
  ToggleButtonRacProps
> = {
  tag: "ToggleButton",
  family: "primitives/actions",
  runtime: {
    source: "react-aria-components",
    exportName: "ToggleButton",
  },
  defaultProps: {
    children: "Toggle",
    size: "md",
    isEmphasized: false,
    isQuiet: false,
    isSelected: false,
  },
  props: {
    accepts: toggleButtonAccepts,
  },
  toRacProps: toToggleButtonRacProps,
  skiaPrimitive: { kind: "toggle-button" },
};
