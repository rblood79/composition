import { createContext, useContext, useMemo } from "react";
import type {
  DataField,
  DataTable,
} from "../../../../types/builder/data.types";
import { resolveCollectionUsage } from "../../../../services/ai/data/collectionReadModel";
import { getAiToolReadModel } from "../../../../services/ai/tools/canonicalToolReadModel";
import { useStore } from "../../../stores";
import { resolveFieldUsage, type FieldUsageRef } from "../utils/fieldUsage";

/**
 * ADR-248 Phase 4e-4e: where the Data surfaces read document usage from — "used by N" per
 * collection (the list · the binding picker) and a field's users (the field panel). The store
 * source reads the old element store; the catalog workspace provides the graph's collection index.
 */
export interface DataUsageSource {
  useCollectionUsage(
    collections: readonly DataTable[],
  ): ReadonlyMap<string, number>;
  useFieldUsage(
    collection: DataTable | undefined,
    field: DataField | null,
  ): readonly FieldUsageRef[];
}

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

export const DataUsageSourceContext = createContext<DataUsageSource | null>(
  null,
);

export function useDataUsageSource(): DataUsageSource {
  return useContext(DataUsageSourceContext) ?? STORE_DATA_USAGE_SOURCE;
}
