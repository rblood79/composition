import type { PrimitiveBinding } from "../types";
import {
  TABLE_DENSITY_VALUES,
  TABLE_SELECTION_BEHAVIOR_VALUES,
  TABLE_SELECTION_MODE_VALUES,
  toTableRacProps,
  type TableCanonicalProps,
  type TableRacProps,
} from "../outputs/toRacProps";

const tableAccepts = {
  columns: {
    kind: "binding",
    label: "Columns",
    section: "content",
  },
  rows: {
    kind: "binding",
    label: "Rows",
    section: "content",
  },
  density: {
    kind: "enum",
    label: "Density",
    section: "appearance",
    default: "regular",
    options: TABLE_DENSITY_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  isQuiet: {
    kind: "boolean",
    label: "Quiet",
    section: "appearance",
    default: false,
  },
  selectionMode: {
    kind: "enum",
    label: "Selection mode",
    section: "state",
    default: "none",
    options: TABLE_SELECTION_MODE_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  selectionBehavior: {
    kind: "enum",
    label: "Selection behavior",
    section: "state",
    default: "toggle",
    options: TABLE_SELECTION_BEHAVIOR_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  allowsSorting: {
    kind: "boolean",
    label: "Allow sorting",
    section: "features",
    default: true,
  },
  allowsResizingColumns: {
    kind: "boolean",
    label: "Allow resizing",
    section: "features",
    default: false,
  },
} as const;

const tableColumns = [
  { id: "name", label: "Name", isRowHeader: true },
  { id: "role", label: "Role" },
];

const tableRows = [
  { id: "ada", name: "Ada Lovelace", role: "Engineer" },
  { id: "grace", name: "Grace Hopper", role: "Admiral" },
];

export const tablePrimitiveBinding: PrimitiveBinding<
  TableCanonicalProps,
  TableRacProps
> = {
  tag: "Table",
  family: "tree-table",
  runtime: {
    source: "react-aria-components",
    exportName: "Table",
  },
  defaultProps: {
    "aria-label": "People",
    density: "regular",
    selectionMode: "none",
    selectionBehavior: "toggle",
    disallowEmptySelection: false,
    allowsSorting: true,
    allowsResizingColumns: false,
    isQuiet: false,
    columns: tableColumns,
    rows: tableRows,
  },
  props: {
    accepts: tableAccepts,
  },
  toRacProps: toTableRacProps,
  skiaPrimitive: { kind: "table" },
};

export const tableViewPrimitiveBinding: PrimitiveBinding<
  TableCanonicalProps,
  TableRacProps
> = {
  tag: "TableView",
  family: "tree-table",
  runtime: {
    source: "react-aria-components",
    exportName: "Table",
  },
  defaultProps: {
    "aria-label": "Table View",
    density: "regular",
    selectionMode: "none",
    selectionBehavior: "toggle",
    disallowEmptySelection: false,
    allowsSorting: true,
    allowsResizingColumns: true,
    isQuiet: false,
    columns: [
      { id: "name", label: "Name", isRowHeader: true },
      { id: "status", label: "Status" },
    ],
    rows: [
      { id: "design", name: "Design System", status: "Active" },
      { id: "runtime", name: "Runtime", status: "Ready" },
    ],
  },
  props: {
    accepts: tableAccepts,
  },
  toRacProps: toTableRacProps,
  skiaPrimitive: { kind: "table" },
};

export const tableInspectorThemeValues = {
  variants: {},
};
