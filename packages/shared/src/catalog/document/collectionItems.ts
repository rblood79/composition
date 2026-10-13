/**
 * RAC collection item types → their collections and the wrappers between them (TagList, TabList,
 * sections, TableBody, parent TreeItems). Inside its collection an item's selection is the
 * collection's (RAC `data-selected` from the collection's keys), not the item template's display
 * state.
 */
export const COLLECTION_ITEM_OWNERS: Readonly<
  Record<
    string,
    { readonly owners: readonly string[]; readonly through: readonly string[] }
  >
> = {
  Tab: { owners: ["Tabs"], through: ["TabList"] },
  Tag: { owners: ["TagGroup"], through: ["TagList"] },
  ListBoxItem: { owners: ["ListBox"], through: ["ListBoxSection"] },
  GridListItem: { owners: ["GridList"], through: ["GridListSection"] },
  TreeItem: { owners: ["Tree"], through: ["TreeItem"] },
  // ADR-256 Phase 5i-2: a RAC Table's row (its selection checkbox shows the row's selection) — an
  // S2 TableView's too (RAC's Table inside, ADR-257 Phase 5).
  Row: { owners: ["Table", "TableView"], through: ["TableBody"] },
  // (A submenu's item — in its SubmenuTrigger — is not one of the Menu's selectable items.)
  MenuItem: { owners: ["Menu"], through: ["MenuSection"] },
  // ADR-256 Phase 10: an S2 CardView's Card (its RAC GridListItem).
  Card: { owners: ["CardView"], through: [] },
};

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
  return collectionType === "Tree" ? "single" : "none";
}

/**
 * Whether an item's Selected (`isSelected` — the item's edit surface, as a Tag's) starts its
 * collection's selection: RAC's `defaultSelectedKeys` are the keys of the items set Selected, and
 * RAC selects nothing while the collection's `selectionMode` is none (2026-10-13 — a static item
 * picks its state in the Design panel; a bound list's rows take it from the template or a field).
 */
export function catalogItemStartsSelected(
  collectionType: string,
  collectionProps: Readonly<Record<string, unknown>>,
  itemProps: Readonly<Record<string, unknown>>,
): boolean {
  return (
    itemProps.isSelected === true &&
    catalogCollectionSelectionMode(collectionType, collectionProps) !== "none"
  );
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
