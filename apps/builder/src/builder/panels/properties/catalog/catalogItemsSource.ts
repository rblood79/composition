import { useCallback, useMemo, useSyncExternalStore } from "react";
import { editItems } from "../../../../../../../packages/shared/src/catalog/commands";
import type { ItemsEdit } from "../../../../../../../packages/shared/src/catalog/commands/items";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import { targetKey } from "../../../catalogRuntime/session";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";
import type { ItemsActions, ItemsSource } from "../generic/itemsSource";

type Item = Record<string, unknown>;
const EMPTY: readonly Item[] = [];
const noSubscription = () => () => {};

function useRecordTarget(identity: string) {
  const workspace = useCatalogWorkspace();
  return useMemo(
    () => workspace.itemOfRecord(identity)?.target,
    [identity, workspace],
  );
}

/** A new row keeps a given id, else gets a random one (the old item actions' rule). */
const withId = (item: Item): Item => ({
  label: "Item",
  ...item,
  id:
    item.id !== undefined && item.id !== ""
      ? String(item.id)
      : crypto.randomUUID(),
});

/**
 * ADR-248 Phase 4e-4: the items manager over the catalog document — the list the target shows now
 * (read model prop source: own, else its template's, else the defaults) and one `editItems`
 * command per edit (the whole list written back as the target's own value, one history step).
 */
export const CATALOG_ITEMS_SOURCE: ItemsSource = {
  useItems(elementId, itemsKey) {
    const { readModel } = useCatalogWorkspace();
    const target = useRecordTarget(elementId);
    const id = target ? targetKey(target) : "";
    const subscribe = useCallback(
      (notify: () => void) =>
        target
          ? readModel.subscribePropSource(target, itemsKey, notify)
          : noSubscription(),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the target
      [readModel, id, itemsKey],
    );
    return useSyncExternalStore(subscribe, () => {
      const value = target
        ? readModel.propSource(target, itemsKey).value
        : undefined;
      return Array.isArray(value) ? (value as readonly Item[]) : EMPTY;
    });
  },
  useIsStaticOwner() {
    return false;
  },
  useActions(elementId, itemsKey) {
    const target = useRecordTarget(elementId);
    const run = useCatalogCommandRunner();
    return useMemo<ItemsActions>(() => {
      const edit = (change: ItemsEdit) => {
        if (target) run(editItems({ target, key: itemsKey, edit: change }));
      };
      const patchOf = (patch: Item) =>
        patch as Extract<ItemsEdit, { kind: "update" }>["patch"];
      return {
        add: (item) => edit({ kind: "add", item: withId(item) as never }),
        addSection: () =>
          edit({
            kind: "add",
            item: {
              id: crypto.randomUUID(),
              type: "section",
              header: "New Section",
              items: [],
            } as never,
          }),
        addSeparator: () =>
          edit({
            kind: "add",
            item: { id: crypto.randomUUID(), type: "separator" } as never,
          }),
        remove: (itemId) => edit({ kind: "remove", id: itemId }),
        update: (itemId, patch) =>
          edit({ kind: "update", id: itemId, patch: patchOf(patch) }),
        addToSection: (sectionId, item) =>
          edit({
            kind: "add",
            item: withId(item) as never,
            section: sectionId,
          }),
        updateInSection: (sectionId, itemId, patch) =>
          edit({
            kind: "update",
            id: itemId,
            patch: patchOf(patch),
            section: sectionId,
          }),
        removeFromSection: (sectionId, itemId) =>
          edit({ kind: "remove", id: itemId, section: sectionId }),
      };
    }, [itemsKey, run, target]);
  },
};
