import type { PrimitiveBinding } from "../types";
import {
  TOGGLE_BUTTON_GROUP_ORIENTATION_VALUES,
  TOGGLE_BUTTON_GROUP_SELECTION_MODE_VALUES,
  TOGGLE_BUTTON_GROUP_SIZE_VALUES,
  toToggleButtonGroupRacProps,
  type ToggleButtonGroupCanonicalProps,
  type ToggleButtonGroupRacProps,
} from "../outputs/toRacProps";

const toggleButtonGroupAccepts = {
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: TOGGLE_BUTTON_GROUP_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  orientation: {
    kind: "enum",
    label: "Orientation",
    section: "appearance",
    default: "horizontal",
    options: TOGGLE_BUTTON_GROUP_ORIENTATION_VALUES.map((value) => ({
      value,
      label: value === "horizontal" ? "Horizontal" : "Vertical",
    })),
  },
  indicator: {
    kind: "boolean",
    label: "Indicator",
    section: "appearance",
    default: false,
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
  selectionMode: {
    kind: "enum",
    label: "Selection Mode",
    section: "state",
    default: "single",
    options: TOGGLE_BUTTON_GROUP_SELECTION_MODE_VALUES.map((value) => ({
      value,
      label: value === "single" ? "Single" : "Multiple",
    })),
  },
  isDisabled: {
    kind: "boolean",
    label: "Disabled",
    section: "state",
    default: false,
  },
  value: {
    kind: "string-array",
    label: "Selected keys",
    section: "state",
    default: [],
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

export const toggleButtonGroupPrimitiveBinding: PrimitiveBinding<
  ToggleButtonGroupCanonicalProps,
  ToggleButtonGroupRacProps
> = {
  tag: "ToggleButtonGroup",
  family: "primitives/actions",
  runtime: {
    source: "react-aria-components",
    exportName: "ToggleButtonGroup",
  },
  defaultProps: {
    size: "md",
    orientation: "horizontal",
    selectionMode: "single",
    indicator: false,
    isEmphasized: false,
    isQuiet: false,
    value: [],
  },
  props: {
    accepts: toggleButtonGroupAccepts,
  },
  toRacProps: toToggleButtonGroupRacProps,
  placement: {
    kind: "node-with-children",
    children: [
      {
        type: "ToggleButton",
        props: {
          children: "Toggle 1",
          isSelected: false,
          isDisabled: false,
          size: "md",
        },
      },
      {
        type: "ToggleButton",
        props: {
          children: "Toggle 2",
          isSelected: false,
          isDisabled: false,
          size: "md",
        },
      },
    ],
  },
};
