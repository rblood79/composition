import type {
  GridListProps,
  ListBoxProps,
  MenuProps,
  TableProps,
  TagGroupProps,
  ToggleButtonGroupProps,
  TreeProps,
} from "react-aria-components";
import type { InteractionConcept } from "./types";

/**
 * RAC `useMultipleSelectionState` (guides/selection.md · ListBox.md · GridList.md · Table.md ·
 * Tree.md · TagGroup.md · Menu.md · ToggleButtonGroup.md "Selection").
 */
const NAMES = [
  "selectedKeys",
  "defaultSelectedKeys",
  "onSelectionChange",
  "selectionMode",
  "disallowEmptySelection",
  "disabledKeys",
] as const satisfies readonly (keyof ListBoxProps<object>)[];
const GRID = NAMES satisfies readonly (keyof GridListProps<object>)[];
const TABLE = NAMES satisfies readonly (keyof TableProps)[];
const TREE = NAMES satisfies readonly (keyof TreeProps<object>)[];
const TAGS = NAMES satisfies readonly (keyof TagGroupProps)[];
const MENU = NAMES satisfies readonly (keyof MenuProps<object>)[];
const TOGGLES = [
  "selectedKeys",
  "defaultSelectedKeys",
  "onSelectionChange",
  "selectionMode",
  "disallowEmptySelection",
  "isDisabled",
] as const satisfies readonly (keyof ToggleButtonGroupProps)[];
void [GRID, TABLE, TREE, TAGS, MENU, TOGGLES];

export const multiSelection = {
  id: "multiSelection",
  racDoc: "guides/selection.md — selectedKeys / onSelectionChange",
  racType:
    "ListBoxProps · GridListProps · TableProps · TreeProps · TagGroupProps · MenuProps · ToggleButtonGroupProps",
  events: ["onSelectionChange"],
  args: { onSelectionChange: ["keys"] },
  state: {
    prop: "selectedKeys",
    defaultProp: "defaultSelectedKeys",
    callback: "onSelectionChange",
    valueType: "keys",
  },
  conditions: [
    "isDisabled",
    "selectionMode",
    "disallowEmptySelection",
    "disabledKeys",
  ],
  capabilities: {
    selectItem: {
      labelKey: "capabilities.selectItem",
      value: "!param",
      param: { kind: "itemKey", labelKey: "capabilities.paramItemKey" },
      op: "add",
    },
    deselectItem: {
      labelKey: "capabilities.deselectItem",
      value: "!param",
      param: { kind: "itemKey", labelKey: "capabilities.paramItemKey" },
      op: "remove",
    },
    clearSelection: { labelKey: "capabilities.clearSelection", value: [] },
  },
} as const satisfies InteractionConcept;
