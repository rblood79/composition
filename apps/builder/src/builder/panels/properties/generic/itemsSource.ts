import { createContext, useContext, useMemo } from "react";
import { useStore } from "../../../stores";
import { useActiveCanonicalDocument } from "../../../stores/canonical/canonicalElementsBridge";
import { isStaticCollectionOwner } from "../../../components/staticCollectionMigration";
import { useCanonicalPropertyResolvedElement } from "../hooks/useCanonicalPropertyRead";

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
 * The default is the old canonical store; the catalog Properties panel (ADR-248 Phase 4e-4)
 * provides the read model and `editItems` commands, so the manager itself is shared.
 */
export interface ItemsSource {
  useItems(elementId: string, itemsKey: string): readonly Item[];
  /** Authored static lists are edited as item children, not the items prop (ADR-234). */
  useIsStaticOwner(elementId: string): boolean;
  useActions(elementId: string, itemsKey: string): ItemsActions;
}

const EMPTY: readonly Item[] = [];

const CANONICAL_ITEMS_SOURCE: ItemsSource = {
  useItems(elementId, itemsKey) {
    // ADR-228: ref instance 는 origin ⊕ override 의 유효 items 를 보인다 (쓰기는 instance override).
    const element = useCanonicalPropertyResolvedElement(elementId);
    return useMemo(() => {
      const value = (element?.props as Item | undefined)?.[itemsKey];
      return Array.isArray(value) ? (value as Item[]) : EMPTY;
    }, [element, itemsKey]);
  },
  useIsStaticOwner(elementId) {
    const canonicalDocument = useActiveCanonicalDocument();
    return useMemo(
      () =>
        canonicalDocument
          ? isStaticCollectionOwner(canonicalDocument, elementId)
          : false,
      [canonicalDocument, elementId],
    );
  },
  useActions(elementId, itemsKey) {
    return useMemo<ItemsActions>(() => {
      const store = () => useStore.getState();
      return {
        add: (item) => void store().addItem(elementId, itemsKey, item),
        addSection: () => void store().addSection(elementId, itemsKey),
        addSeparator: () => void store().addSeparator(elementId, itemsKey),
        remove: (itemId) =>
          void store().removeItem(elementId, itemsKey, itemId),
        update: (itemId, patch) =>
          void store().updateItem(elementId, itemsKey, itemId, patch),
        addToSection: (sectionId, item) =>
          void store().addItemToSection(elementId, itemsKey, sectionId, item),
        updateInSection: (sectionId, itemId, patch) =>
          void store().updateItemInSection(
            elementId,
            itemsKey,
            sectionId,
            itemId,
            patch,
          ),
        removeFromSection: (sectionId, itemId) =>
          void store().removeItemFromSection(
            elementId,
            itemsKey,
            sectionId,
            itemId,
          ),
      };
    }, [elementId, itemsKey]);
  },
};

export const ItemsSourceContext = createContext<ItemsSource>(
  CANONICAL_ITEMS_SOURCE,
);

export function useItemsSource(): ItemsSource {
  return useContext(ItemsSourceContext);
}
