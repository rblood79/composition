import type {
  BreadcrumbsProps,
  GridListItemProps,
  GridListProps,
  ListBoxItemProps,
  ListBoxProps,
  MenuItemProps,
  MenuProps,
  RowProps,
  TableProps,
  TagGroupProps,
  TagProps,
  TreeItemProps,
  TreeProps,
} from "react-aria-components";
import type { InteractionConcept } from "./types";

/**
 * RAC collection action (ListBox.md · GridList.md · Tree.md · Menu.md · Breadcrumbs.md · TagGroup.md
 * "Actions").
 */
const NAMES = [
  "onAction",
] as const satisfies readonly (keyof ListBoxProps<object>)[];
const GRID = NAMES satisfies readonly (keyof GridListProps<object>)[];
const TREE = NAMES satisfies readonly (keyof TreeProps<object>)[];
const MENU = NAMES satisfies readonly (keyof MenuProps<object>)[];
const CRUMBS = NAMES satisfies readonly (keyof BreadcrumbsProps<object>)[];
const TAGS = NAMES satisfies readonly (keyof TagGroupProps)[];
/** An item's own action (ListBox.md · GridList.md · Tree.md · Table.md · TagGroup.md · Menu.md items). */
const ITEM = ["onAction"] as const satisfies readonly (keyof ListBoxItemProps)[];
const ITEMS = [
  ITEM satisfies readonly (keyof GridListItemProps)[],
  ITEM satisfies readonly (keyof TreeItemProps)[],
  ITEM satisfies readonly (keyof RowProps<object>)[],
  ITEM satisfies readonly (keyof TagProps)[],
  ITEM satisfies readonly (keyof MenuItemProps)[],
];
/** Menu.md — `onClose`: the menu should close after an item was selected. */
const CLOSE = ["onClose"] as const satisfies readonly (keyof MenuProps<object>)[];
/** A Table's row action is `onRowAction` (Table.md "Row actions"). */
const ROW = ["onRowAction"] as const satisfies readonly (keyof TableProps)[];
void [GRID, TREE, MENU, CRUMBS, TAGS, ITEMS];

export const action = {
  id: "action",
  racDoc:
    "ListBox.md · GridList.md · Tree.md · Menu.md · Breadcrumbs.md · TagGroup.md — Actions",
  racType:
    "ListBoxProps · GridListProps · TreeProps · MenuProps · BreadcrumbsProps · TagGroupProps",
  events: NAMES,
  args: { onAction: ["key"] },
  conditions: ["isDisabled", "disabledKeys"],
} as const satisfies InteractionConcept;

export const rowAction = {
  id: "action",
  racDoc: "Table.md — Row actions",
  racType: "TableProps",
  events: ROW,
  args: { onRowAction: ["key"] },
  conditions: ["disabledKeys"],
} as const satisfies InteractionConcept;

/**
 * An item's own action (the item node's When): RAC calls the item's `onAction` and then its
 * collection's — the same user event (`selectionBehavior` · modality decide it).
 */
export const itemAction = {
  id: "action",
  racDoc: "ListBox.md · GridList.md · Tree.md · Table.md · TagGroup.md · Menu.md — item onAction",
  racType:
    "ListBoxItemProps · GridListItemProps · TreeItemProps · RowProps · TagProps · MenuItemProps",
  events: ITEM,
  conditions: ["isDisabled"],
} as const satisfies InteractionConcept;

/** Menu.md — `onClose` (after an item is selected, unless `shouldCloseOnSelect` is false). */
export const menuClose = {
  id: "close",
  group: "action",
  racDoc: "Menu.md — onClose",
  racType: "MenuProps",
  events: CLOSE,
  conditions: [],
} as const satisfies InteractionConcept;
