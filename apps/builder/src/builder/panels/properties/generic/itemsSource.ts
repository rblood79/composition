import { createContext, useContext } from "react";

type Item = Record<string, unknown>;
type ItemId = string | number;

/** The items-manager edits of one element's items prop. */
export interface ItemsActions {
  add(item: Item): void;
  addSection(): void;
  addSeparator(): void;
  remove(itemId: ItemId): void;
  update(itemId: ItemId, patch: Item): void;
  addToSection(sectionId: string, item: Item): void;
  updateInSection(sectionId: string, itemId: string, patch: Item): void;
  removeFromSection(sectionId: string, itemId: string): void;
}

/**
 * Where the items manager reads an element's items and sends its edits. Each `use*` is a hook.
 * The catalog Properties panel (ADR-248 Phase 4e-4) provides the read model and `editItems`
 * commands, so the manager itself is shared.
 */
export interface ItemsSource {
  useItems(elementId: string, itemsKey: string): readonly Item[];
  /** Authored static lists are edited as item children, not the items prop (ADR-234). */
  useIsStaticOwner(elementId: string): boolean;
  useActions(elementId: string, itemsKey: string): ItemsActions;
}

/** Provided by the catalog Properties panel (`CATALOG_ITEMS_SOURCE`); no default (ADR-248 4e-7). */
export const ItemsSourceContext = createContext<ItemsSource | null>(null);

/** Old-store tests only (`itemsSource.store.ts`, removed with the old store): the source without a provider. */
let testFallback: ItemsSource | null = null;
export function setItemsSourceTestFallback(source: ItemsSource | null): void {
  testFallback = source;
}

export function useItemsSource(): ItemsSource {
  const source = useContext(ItemsSourceContext) ?? testFallback;
  if (!source) throw new Error("Items source is not provided");
  return source;
}
