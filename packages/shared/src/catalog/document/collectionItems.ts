/**
 * RAC collection item types → their collection and the wrappers between them (TagList, TabList,
 * sections, parent TreeItems). Inside its collection an item's selection is the collection's
 * (RAC `data-selected` from the collection's keys), not the item template's display state.
 */
export const COLLECTION_ITEM_OWNERS: Readonly<
  Record<
    string,
    { readonly owner: string; readonly through: readonly string[] }
  >
> = {
  Tab: { owner: "Tabs", through: ["TabList"] },
  Tag: { owner: "TagGroup", through: ["TagList"] },
  ListBoxItem: { owner: "ListBox", through: ["ListBoxSection"] },
  GridListItem: { owner: "GridList", through: ["GridListSection"] },
  TreeItem: { owner: "Tree", through: ["TreeItem"] },
  // ADR-256 Phase 5i-2: a RAC Table's row (its selection checkbox shows the row's selection).
  Row: { owner: "Table", through: ["TableBody"] },
};

/** Whether `itemType`, under the ancestor types (nearest first), sits inside its collection. */
export function isInOwnCollection(
  itemType: string,
  ancestorTypes: Iterable<string>,
): boolean {
  const item = COLLECTION_ITEM_OWNERS[itemType];
  if (!item) return false;
  for (const type of ancestorTypes) {
    if (type === item.owner) return true;
    if (!item.through.includes(type)) return false;
  }
  return false;
}
