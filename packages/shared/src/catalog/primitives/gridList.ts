import type { PrimitiveBinding } from "../types";
import {
  GRID_LIST_LAYOUT_VALUES,
  GRID_LIST_SELECTION_BEHAVIOR_VALUES,
  GRID_LIST_SELECTION_MODE_VALUES,
  GRID_LIST_VALIDATION_BEHAVIOR_VALUES,
  GRID_LIST_VARIANT_VALUES,
  toGridListRacProps,
  type GridListCanonicalProps,
  type GridListRacProps,
} from "../outputs/toRacProps";

const gridListAccepts = {
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
    options: GRID_LIST_VARIANT_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  layout: {
    kind: "enum",
    label: "Layout",
    section: "appearance",
    default: "stack",
    options: GRID_LIST_LAYOUT_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  columns: {
    kind: "number",
    label: "Columns",
    section: "appearance",
    default: 2,
    min: 1,
    max: 12,
    step: 1,
    visibleWhen: { key: "layout", equals: "grid" },
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
  selectionMode: {
    kind: "enum",
    label: "Selection mode",
    section: "state",
    default: "none",
    options: GRID_LIST_SELECTION_MODE_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  selectionBehavior: {
    kind: "enum",
    label: "Selection behavior",
    section: "state",
    default: "toggle",
    options: GRID_LIST_SELECTION_BEHAVIOR_VALUES.map((value) => ({
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
  allowsDragging: {
    kind: "boolean",
    label: "Allows dragging",
    section: "state",
    default: false,
  },
  renderEmptyState: {
    kind: "boolean",
    label: "Render empty state",
    section: "state",
    default: false,
  },
  validationBehavior: {
    kind: "enum",
    label: "Validation behavior",
    section: "state",
    inspector: false,
    default: "native",
    options: GRID_LIST_VALIDATION_BEHAVIOR_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
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

export const gridListPrimitiveBinding: PrimitiveBinding<
  GridListCanonicalProps,
  GridListRacProps
> = {
  tag: "GridList",
  family: "collections",
  runtime: {
    source: "react-aria-components",
    exportName: "GridList",
  },
  defaultProps: {
    variant: "default",
    layout: "stack",
    columns: 2,
    selectionMode: "none",
    selectionBehavior: "toggle",
    disallowEmptySelection: false,
    isDisabled: false,
    autoFocus: false,
    allowsDragging: false,
    renderEmptyState: false,
    validationBehavior: "native",
    items: [
      {
        id: "item-1",
        label: "Desert Sunset",
        textValue: "Desert Sunset",
        description: "PNG - 2/3/2024",
      },
      {
        id: "item-2",
        label: "Hiking Trail",
        textValue: "Hiking Trail",
        description: "JPEG - 1/10/2022",
      },
      {
        id: "item-3",
        label: "Mountain Sunrise",
        textValue: "Mountain Sunrise",
        description: "PNG - 3/15/2015",
      },
    ],
  },
  props: {
    accepts: gridListAccepts,
  },
  toRacProps: toGridListRacProps,
  skiaPrimitive: { kind: "grid-list" },
};

export const gridListInspectorThemeValues = {
  variants: {
    GridList: GRID_LIST_VARIANT_VALUES,
  },
};
