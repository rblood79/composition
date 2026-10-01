import { useMemo } from "react";
import { resolveCollectionUsage } from "../../../../services/ai/data/collectionReadModel";
import { getAiToolReadModel } from "../../../../services/ai/tools/canonicalToolReadModel";
import { useStore } from "../../../stores";
import { resolveFieldUsage } from "../utils/fieldUsage";
import {
  setDataUsageSourceTestFallback,
  type DataUsageSource,
} from "./dataUsageSource";

/**
 * ADR-248 4e-7: the old element store's DataUsageSource — no longer in the app (the catalog workspace
 * provides the host). Old-store tests import this module to run against it; it goes with the
 * old store.
 */
export const STORE_DATA_USAGE_SOURCE: DataUsageSource = {
  useCollectionUsage(collections) {
    // 요소가 바뀌면 다시 센다 (읽기는 getAiToolReadModel 경유)
    const elements = useStore((state) => state.elements);
    return useMemo(() => {
      void elements;
      return resolveCollectionUsage(getAiToolReadModel().elements, collections);
    }, [collections, elements]);
  },
  useFieldUsage(collection, field) {
    const elements = useStore((state) => state.elements);
    return useMemo(() => {
      void elements;
      if (!collection || !field) return [];
      return resolveFieldUsage(
        getAiToolReadModel().elements,
        collection,
        field,
      );
    }, [collection, field, elements]);
  },
};

setDataUsageSourceTestFallback(STORE_DATA_USAGE_SOURCE);
