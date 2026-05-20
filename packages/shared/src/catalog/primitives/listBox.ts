import type { PrimitiveBinding } from "../types";
import {
  LIST_BOX_ORIENTATION_VALUES,
  LIST_BOX_SELECTION_BEHAVIOR_VALUES,
  LIST_BOX_SELECTION_MODE_VALUES,
  LIST_BOX_VARIANT_VALUES,
  toListBoxRacProps,
  type ListBoxCanonicalProps,
  type ListBoxRacProps,
} from "../outputs/toRacProps";

const listBoxAccepts = {
  items: {
    kind: "binding",
    label: "Items",
    section: "content",
  },
  variant: {
    kind: "enum",
    label: "Variant",
    section: "appearance",
    default: "default",
    options: LIST_BOX_VARIANT_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  orientation: {
    kind: "enum",
    label: "Orientation",
    section: "appearance",
    default: "vertical",
    options: LIST_BOX_ORIENTATION_VALUES.map((value) => ({
      value,
      label: value === "horizontal" ? "Horizontal" : "Vertical",
    })),
  },
  filterText: {
    kind: "string",
    label: "Filter text",
    section: "filtering",
  },
  filterFields: {
    kind: "string-array",
    label: "Filter fields",
    section: "filtering",
  },
  enableVirtualization: {
    kind: "boolean",
    label: "Virtualized",
    section: "performance",
    default: false,
  },
  height: {
    kind: "number",
    label: "Height",
    section: "performance",
    default: 300,
    min: 80,
    visibleWhen: { key: "enableVirtualization", equals: true },
  },
  overscan: {
    kind: "number",
    label: "Overscan",
    section: "performance",
    default: 5,
    min: 0,
    visibleWhen: { key: "enableVirtualization", equals: true },
  },
  selectionMode: {
    kind: "enum",
    label: "Selection mode",
    section: "state",
    default: "single",
    options: LIST_BOX_SELECTION_MODE_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  selectionBehavior: {
    kind: "enum",
    label: "Selection behavior",
    section: "state",
    default: "toggle",
    options: LIST_BOX_SELECTION_BEHAVIOR_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  disallowEmptySelection: {
    kind: "boolean",
    label: "Disallow empty",
    section: "state",
    default: false,
  },
  isDisabled: {
    kind: "boolean",
    label: "Disabled",
    section: "state",
    default: false,
  },
  autoFocus: {
    kind: "boolean",
    label: "Auto focus",
    section: "state",
    default: false,
  },
  selectedKey: {
    kind: "string",
    label: "Selected key",
    section: "state",
    inspector: false,
  },
  selectedKeys: {
    kind: "string-array",
    label: "Selected keys",
    section: "state",
    inspector: false,
  },
  defaultSelectedKey: {
    kind: "string",
    label: "Default selected key",
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

export const listBoxPrimitiveBinding: PrimitiveBinding<
  ListBoxCanonicalProps,
  ListBoxRacProps
> = {
  tag: "ListBox",
  family: "collections",
  runtime: {
    source: "react-aria-components",
    exportName: "ListBox",
  },
  defaultProps: {
    variant: "default",
    orientation: "vertical",
    selectionMode: "single",
    selectionBehavior: "toggle",
    disallowEmptySelection: false,
    isDisabled: false,
    autoFocus: false,
    enableVirtualization: false,
    height: 300,
    overscan: 5,
    items: [
      { id: "item-1", label: "Aardvark", value: "aardvark" },
      { id: "item-2", label: "Cat", value: "cat" },
      { id: "item-3", label: "Kangaroo", value: "kangaroo" },
      { id: "item-4", label: "Dog", value: "dog" },
      { id: "item-5", label: "Elephant", value: "elephant" },
      { id: "item-6", label: "Giraffe", value: "giraffe" },
      { id: "item-7", label: "Hippo", value: "hippo" },
      { id: "item-8", label: "Lion", value: "lion" },
      { id: "item-9", label: "Monkey", value: "monkey" },
      { id: "item-10", label: "Panda", value: "panda" },
    ],
  },
  props: {
    accepts: listBoxAccepts,
  },
  toRacProps: toListBoxRacProps,
  skiaPrimitive: { kind: "list-box" },
};

export const listBoxInspectorThemeValues = {
  variants: {
    ListBox: LIST_BOX_VARIANT_VALUES,
  },
};
