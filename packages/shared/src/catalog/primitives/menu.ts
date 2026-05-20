import type { PrimitiveBinding } from "../types";
import {
  MENU_ALIGN_VALUES,
  MENU_DIRECTION_VALUES,
  MENU_SELECTION_MODE_VALUES,
  MENU_SIZE_VALUES,
  MENU_VARIANT_VALUES,
  toMenuRacProps,
  type MenuCanonicalProps,
  type MenuRacProps,
} from "../outputs/toRacProps";

const menuAccepts = {
  label: {
    kind: "string",
    label: "Label",
    section: "content",
    default: "Menu",
  },
  items: {
    kind: "binding",
    label: "Items",
    section: "content",
  },
  variant: {
    kind: "enum",
    label: "Variant",
    section: "appearance",
    default: "primary",
    options: MENU_VARIANT_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: MENU_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  align: {
    kind: "enum",
    label: "Align",
    section: "appearance",
    default: "start",
    options: MENU_ALIGN_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  direction: {
    kind: "enum",
    label: "Direction",
    section: "appearance",
    default: "bottom",
    options: MENU_DIRECTION_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  shouldFlip: {
    kind: "boolean",
    label: "Should flip",
    section: "appearance",
    default: true,
  },
  selectionMode: {
    kind: "enum",
    label: "Selection mode",
    section: "state",
    default: "none",
    options: MENU_SELECTION_MODE_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  isQuiet: {
    kind: "boolean",
    label: "Quiet",
    section: "state",
    default: false,
  },
  isDisabled: {
    kind: "boolean",
    label: "Disabled",
    section: "state",
    default: false,
  },
  children: {
    kind: "string",
    label: "Button text",
    section: "content",
    inspector: false,
  },
  selectedKeys: {
    kind: "string-array",
    label: "Selected keys",
    section: "state",
    inspector: false,
  },
  defaultSelectedKeys: {
    kind: "string-array",
    label: "Default selected keys",
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

export const menuPrimitiveBinding: PrimitiveBinding<
  MenuCanonicalProps,
  MenuRacProps
> = {
  tag: "Menu",
  family: "collections",
  runtime: {
    source: "react-aria-components",
    exportName: "Menu",
  },
  defaultProps: {
    label: "Menu",
    children: "Menu",
    variant: "primary",
    size: "md",
    align: "start",
    direction: "bottom",
    shouldFlip: true,
    selectionMode: "none",
    isQuiet: false,
    isDisabled: false,
    items: [
      { id: "item-1", label: "Menu Item 1" },
      { id: "item-2", label: "Menu Item 2" },
      { id: "item-3", label: "Menu Item 3" },
    ],
  },
  props: {
    accepts: menuAccepts,
  },
  toRacProps: toMenuRacProps,
  skiaPrimitive: { kind: "menu" },
};

export const menuInspectorThemeValues = {
  variants: {
    Menu: MENU_VARIANT_VALUES,
  },
  sizes: {
    Menu: MENU_SIZE_VALUES,
  },
};
