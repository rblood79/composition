import type { PrimitiveBinding } from "../types";
import {
  TREE_SELECTION_BEHAVIOR_VALUES,
  TREE_SELECTION_MODE_VALUES,
  TREE_VARIANT_VALUES,
  toTreeRacProps,
  type TreeCanonicalProps,
  type TreeRacProps,
} from "../outputs/toRacProps";

const treeAccepts = {
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
    options: TREE_VARIANT_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  selectionMode: {
    kind: "enum",
    label: "Selection mode",
    section: "state",
    default: "single",
    options: TREE_SELECTION_MODE_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  selectionBehavior: {
    kind: "enum",
    label: "Selection behavior",
    section: "state",
    default: "toggle",
    options: TREE_SELECTION_BEHAVIOR_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  expandedKeys: {
    kind: "string-array",
    label: "Expanded keys",
    section: "state",
  },
  selectedKey: {
    kind: "string",
    label: "Selected key",
    section: "state",
  },
  isDisabled: {
    kind: "boolean",
    label: "Disabled",
    section: "state",
    default: false,
  },
} as const;

export const treePrimitiveBinding: PrimitiveBinding<
  TreeCanonicalProps,
  TreeRacProps
> = {
  tag: "Tree",
  family: "tree-table",
  runtime: {
    source: "react-aria-components",
    exportName: "Tree",
  },
  defaultProps: {
    "aria-label": "Tree",
    variant: "default",
    selectionMode: "single",
    selectionBehavior: "toggle",
    disallowEmptySelection: false,
    isDisabled: false,
    expandedKeys: ["documents"],
    items: [
      {
        id: "documents",
        label: "Documents",
        children: [
          { id: "weekly-report", label: "Weekly Report" },
          { id: "project-plan", label: "Project Plan" },
        ],
      },
      { id: "photos", label: "Photos" },
    ],
  },
  props: {
    accepts: treeAccepts,
  },
  toRacProps: toTreeRacProps,
  skiaPrimitive: { kind: "tree" },
};

export const treeInspectorThemeValues = {
  variants: {
    Tree: TREE_VARIANT_VALUES,
  },
};
