import type { PrimitiveBinding } from "../types";
import {
  TOOLBAR_ORIENTATION_VALUES,
  TOOLBAR_SIZE_VALUES,
  TOOLBAR_VARIANT_VALUES,
  toToolbarRacProps,
  type ToolbarCanonicalProps,
  type ToolbarRacProps,
} from "../outputs/toRacProps";

const toolbarAccepts = {
  "aria-label": {
    kind: "string",
    label: "ARIA label",
    section: "content",
    default: "Toolbar",
  },
  variant: {
    kind: "enum",
    label: "Variant",
    section: "appearance",
    default: "default",
    options: TOOLBAR_VARIANT_VALUES.map((value) => ({
      value,
      label: value === "default" ? "Default" : "Accent",
    })),
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: TOOLBAR_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  orientation: {
    kind: "enum",
    label: "Orientation",
    section: "appearance",
    default: "horizontal",
    options: TOOLBAR_ORIENTATION_VALUES.map((value) => ({
      value,
      label: value === "horizontal" ? "Horizontal" : "Vertical",
    })),
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

export const toolbarPrimitiveBinding: PrimitiveBinding<
  ToolbarCanonicalProps,
  ToolbarRacProps
> = {
  tag: "Toolbar",
  family: "primitives/actions",
  runtime: {
    source: "react-aria-components",
    exportName: "Toolbar",
  },
  defaultProps: {
    "aria-label": "Toolbar",
    orientation: "horizontal",
    variant: "default",
    size: "md",
  },
  props: {
    accepts: toolbarAccepts,
  },
  toRacProps: toToolbarRacProps,
  placement: {
    kind: "node-with-children",
    children: [
      {
        type: "Button",
        props: {
          children: "Action 1",
          variant: "secondary",
          size: "sm",
          isDisabled: false,
        },
      },
      {
        type: "Button",
        props: {
          children: "Action 2",
          variant: "secondary",
          size: "sm",
          isDisabled: false,
        },
      },
      {
        type: "Separator",
        props: {
          orientation: "vertical",
          size: "sm",
          style: {
            width: "1px",
            height: "20px",
          },
        },
      },
      {
        type: "Button",
        props: {
          children: "Action 3",
          variant: "secondary",
          size: "sm",
          isDisabled: false,
        },
      },
    ],
  },
};
