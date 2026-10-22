import type {
  BreadcrumbsProps,
  GridListProps,
  ListBoxProps,
  MenuProps,
  TableProps,
  TreeProps,
} from "react-aria-components";
import type { InteractionConcept } from "./types";

/** RAC collection action (ListBox.md · GridList.md · Tree.md · Menu.md · Breadcrumbs.md "Actions"). */
const NAMES = [
  "onAction",
] as const satisfies readonly (keyof ListBoxProps<object>)[];
const GRID = NAMES satisfies readonly (keyof GridListProps<object>)[];
const TREE = NAMES satisfies readonly (keyof TreeProps<object>)[];
const MENU = NAMES satisfies readonly (keyof MenuProps<object>)[];
const CRUMBS = NAMES satisfies readonly (keyof BreadcrumbsProps<object>)[];
/** A Table's row action is `onRowAction` (Table.md "Row actions"). */
const ROW = ["onRowAction"] as const satisfies readonly (keyof TableProps)[];
void [GRID, TREE, MENU, CRUMBS];

export const action = {
  id: "action",
  racDoc:
    "ListBox.md · GridList.md · Tree.md · Menu.md · Breadcrumbs.md — Actions",
  racType:
    "ListBoxProps · GridListProps · TreeProps · MenuProps · BreadcrumbsProps",
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
