/**
 * ADR-310 Decision 7 — the collection type table: one row per RAC collection family. The item type
 * lists the catalog used to keep by hand in five places (the "+" families · the item owners · the
 * resolver's row items · the Code view's item components · the owners whose items sit in a list
 * node) are columns of this table and computed from it below.
 *
 * - `owner` · `list` · `item` · `section`: who holds what (`list` = the part the items sit in —
 *   TagGroup's TagList).
 * - `pair`: the item's paired node (a Tab's TabPanel, by key). `recursive`: items hold items.
 * - `insert`: the Design "+" adds its items (`COLLECTION_FAMILIES`) — CardView's Cards and a Table's
 *   rows have their own commands.
 * - `repeat`: a bound one repeats its item per data row in the resolver — a bound Table's rows are
 *   still the synthesized ones (ADR-310 Phase 4 changes that).
 * - `selects`: its items' selection is the collection's (`COLLECTION_ITEM_OWNERS`).
 * - `codeItems`: the Code view writes `items` + its item component (ADR-310 Phase 6 widens it).
 * - `parts`: the parts the owner's "+" adds into (default `[list]`).
 * - `pickers`: owners whose items sit in this collection node (Select's ListBox, in its Popover).
 */
export interface CollectionTypeRow {
  readonly owner: string;
  readonly list?: string;
  readonly item: string;
  readonly section?: string;
  readonly pair?: string;
  readonly recursive?: boolean;
  readonly insert: boolean;
  readonly repeat: boolean;
  readonly selects: boolean;
  readonly codeItems: boolean;
  readonly parts?: readonly string[];
  readonly pickers?: readonly string[];
}
export const COLLECTION_TYPE_TABLE: readonly CollectionTypeRow[] = [
  {
    owner: "Tabs",
    list: "TabList",
    item: "Tab",
    pair: "TabPanel",
    insert: true,
    repeat: true,
    selects: true,
    codeItems: false,
  },
  {
    owner: "TagGroup",
    list: "TagList",
    item: "Tag",
    insert: true,
    repeat: true,
    selects: true,
    codeItems: true,
  },
  {
    owner: "SelectBoxGroup",
    item: "SelectBox",
    insert: true,
    repeat: true,
    selects: true,
    codeItems: false,
  },
  {
    owner: "ListBox",
    item: "ListBoxItem",
    section: "ListBoxSection",
    insert: true,
    repeat: true,
    selects: true,
    codeItems: true,
    pickers: ["Select", "ComboBox"],
  },
  {
    owner: "GridList",
    item: "GridListItem",
    section: "GridListSection",
    insert: true,
    repeat: true,
    selects: true,
    codeItems: true,
  },
  // (A MenuItem in a MenuItem is not a submenu — the reference's submenu is a `SubmenuTrigger`,
  // ADR-256 후속 6 — and a submenu's item is not one of the Menu's selectable items.)
  {
    owner: "Menu",
    item: "MenuItem",
    section: "MenuSection",
    insert: true,
    repeat: true,
    selects: true,
    codeItems: true,
    pickers: ["MenuTrigger"],
  },
  {
    owner: "Breadcrumbs",
    item: "Breadcrumb",
    insert: true,
    repeat: true,
    selects: false,
    codeItems: false,
  },
  {
    owner: "Tree",
    item: "TreeItem",
    recursive: true,
    insert: true,
    repeat: true,
    selects: true,
    codeItems: true,
  },
  // ADR-256 Phase 10: an S2 CardView's Card (its RAC GridListItem).
  {
    owner: "CardView",
    item: "Card",
    insert: false,
    repeat: true,
    selects: true,
    codeItems: true,
  },
  // ADR-256 Phase 5i-2: a RAC Table's row (its selection checkbox shows the row's selection).
  {
    owner: "Table",
    list: "TableBody",
    item: "Row",
    insert: false,
    repeat: false,
    selects: true,
    codeItems: true,
    parts: ["TableHeader", "TableBody"],
  },
];

/**
 * RAC collection item types → their collections and the wrappers between them (TagList, TabList,
 * sections, TableBody, parent TreeItems). Inside its collection an item's selection is the
 * collection's (RAC `data-selected` from the collection's keys), not the item template's display
 * state. (Computed from `COLLECTION_TYPE_TABLE` — its `selects` rows.)
 */
export const COLLECTION_ITEM_OWNERS: Readonly<
  Record<
    string,
    { readonly owners: readonly string[]; readonly through: readonly string[] }
  >
> = Object.fromEntries(
  COLLECTION_TYPE_TABLE.filter((row) => row.selects).map((row) => [
    row.item,
    {
      owners: [row.owner],
      through: [
        ...(row.list ? [row.list] : []),
        ...(row.section ? [row.section] : []),
        ...(row.recursive ? [row.item] : []),
      ],
    },
  ]),
);

/**
 * Item types a bound collection repeats per data row, with their paired types (a Tab's TabPanel):
 * the row template positions (ADR-310 — the table's `repeat` rows).
 */
export const CATALOG_ROW_ITEM_TYPES: ReadonlySet<string> = new Set(
  COLLECTION_TYPE_TABLE.filter((row) => row.repeat).flatMap((row) => [
    row.item,
    ...(row.pair ? [row.pair] : []),
  ]),
);

/** A collection's (or its list part's · picker's) item component in the Code view's `items` code. */
export const CODE_VIEW_ITEM_TYPES: Readonly<Record<string, string>> =
  Object.fromEntries(
    COLLECTION_TYPE_TABLE.filter((row) => row.codeItems).flatMap((row) => [
      [row.owner, row.item],
      ...(row.list ? [[row.list, row.item]] : []),
      ...(row.pickers ?? []).flatMap((picker) =>
        // (A MenuTrigger's Code is the Menu's — the Menu node writes `items`.)
        picker === "MenuTrigger" ? [] : [[picker, row.item]],
      ),
    ]),
  );

/**
 * Owners whose items sit in a part node: the owner's "+" adds the item there (the part's own "+"
 * too) — a Tabs' TabList, a picker's ListBox (in its Popover), a Table's header and body.
 */
export const COLLECTION_ITEM_PARTS: Readonly<
  Record<string, readonly string[]>
> = Object.fromEntries(
  COLLECTION_TYPE_TABLE.flatMap((row) => [
    ...(row.list ? [[row.owner, row.parts ?? [row.list]] as const] : []),
    ...(row.pickers ?? []).map((picker) => [picker, [row.owner]] as const),
  ]),
);

/** Whether `itemType`, under the ancestor types (nearest first), sits inside its collection. */
export function isInOwnCollection(
  itemType: string,
  ancestorTypes: Iterable<string>,
): boolean {
  const item = COLLECTION_ITEM_OWNERS[itemType];
  if (!item) return false;
  for (const type of ancestorTypes) {
    if (item.owners.includes(type)) return true;
    if (!item.through.includes(type)) return false;
  }
  return false;
}

/** Whether `type` is a collection whose items `COLLECTION_ITEM_OWNERS` lists. */
export function isItemCollection(type: string): boolean {
  return Object.values(COLLECTION_ITEM_OWNERS).some((item) =>
    item.owners.includes(type),
  );
}

/** Whether `childType`, met inside a `collectionType`, is one of its items (not a wrapper). */
export function isCollectionItemOf(
  childType: string,
  collectionType: string,
): boolean {
  return !!COLLECTION_ITEM_OWNERS[childType]?.owners.includes(collectionType);
}

/** Whether `childType`, met inside a `collectionType`, is a wrapper its items sit in. */
export function isCollectionWrapperOf(
  childType: string,
  collectionType: string,
): boolean {
  return Object.values(COLLECTION_ITEM_OWNERS).some(
    (item) =>
      item.owners.includes(collectionType) && item.through.includes(childType),
  );
}

/**
 * A collection's selection mode: its `selectionMode`, else its binding's default (a Tree selects
 * one — S2 · the Tree binding; the other collections select nothing).
 */
export function catalogCollectionSelectionMode(
  collectionType: string,
  props: Readonly<Record<string, unknown>>,
): string {
  const mode = props.selectionMode;
  if (typeof mode === "string" && mode) return mode;
  return collectionType === "Tree" || collectionType === "SelectBoxGroup"
    ? "single"
    : "none";
}

/**
 * RAC group item types → their group (ADR-256 후속 7). RAC's group context reaches an item through
 * any element (`CheckboxGroupStateContext` · `RadioGroupStateContext` · `ToggleGroupStateContext`),
 * and inside the group the item's selection is the group's value — as a collection item's is its
 * collection's keys — not the item template's display state.
 */
const GROUP_ITEM_OWNERS: Readonly<Record<string, string>> = {
  Checkbox: "CheckboxGroup",
  Radio: "RadioGroup",
  ToggleButton: "ToggleButtonGroup",
};

/** Whether `itemType`, under the ancestor types (nearest first), sits inside its RAC group. */
export function isInOwnGroup(
  itemType: string,
  ancestorTypes: Iterable<string>,
): boolean {
  const group = GROUP_ITEM_OWNERS[itemType];
  if (!group) return false;
  for (const type of ancestorTypes) if (type === group) return true;
  return false;
}
