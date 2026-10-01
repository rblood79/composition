import { useMemo } from "react";
import { useStore } from "../../../stores";
import { useActiveCanonicalDocument } from "../../../stores/canonical/canonicalElementsBridge";
import { isStaticCollectionOwner } from "../../../components/staticCollectionMigration";
import { useCanonicalPropertyResolvedElement } from "../hooks/useCanonicalPropertyRead";
import {
  setItemsSourceTestFallback,
  type ItemsActions,
  type ItemsSource,
} from "./itemsSource";

/**
 * ADR-248 4e-7: the old element store's items source (moved out of `itemsSource.ts`); old-store
 * tests import this module. Goes with the old store.
 */
type Item = Record<string, unknown>;
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

setItemsSourceTestFallback(CANONICAL_ITEMS_SOURCE);
