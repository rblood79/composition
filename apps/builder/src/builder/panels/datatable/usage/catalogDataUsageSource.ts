import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  catalogCollectionUsage,
  catalogFieldUsageElements,
} from "../../../catalogRuntime/dataBinding";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import { resolveFieldUsage } from "../utils/fieldUsage";
import type { DataUsageSource } from "./dataUsageSource";

/** ADR-248 Phase 4e-4e: document usage from the open catalog project (re-read at each step). */
export function createCatalogDataUsageSource(
  workspace: CatalogWorkspace,
): DataUsageSource {
  const graph = () => workspace.runtime.graph;
  const useRevision = () => {
    const subscribe = useCallback(
      (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
      [],
    );
    return useSyncExternalStore(subscribe, () => graph().revision);
  };
  return {
    useCollectionUsage(collections) {
      const revision = useRevision();
      return useMemo(() => {
        void revision;
        return catalogCollectionUsage(
          graph(),
          collections.map((collection) => collection.id),
        );
      }, [collections, revision]);
    },
    useFieldUsage(collection, field) {
      const revision = useRevision();
      return useMemo(() => {
        void revision;
        if (!collection || !field) return [];
        return resolveFieldUsage(
          catalogFieldUsageElements(graph(), collection.id),
          collection,
          field,
        );
      }, [collection, field, revision]);
    },
  };
}
