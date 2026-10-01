import { createContext, useContext } from "react";
import type {
  DataField,
  DataTable,
} from "../../../../types/builder/data.types";
import type { FieldUsageRef } from "../utils/fieldUsage";

/**
 * ADR-248 Phase 4e-4e: where the Data surfaces read document usage from — "used by N" per
 * collection (the list · the binding picker) and a field's users (the field panel). The catalog
 * workspace provides the graph's collection index (no default).
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

export const DataUsageSourceContext = createContext<DataUsageSource | null>(
  null,
);

/** Old-store tests only (`dataUsageSource.store.ts`, removed with the old store): the host without a provider. */
let testFallback: DataUsageSource | null = null;
export function setDataUsageSourceTestFallback(
  host: DataUsageSource | null,
): void {
  testFallback = host;
}

export function useDataUsageSource(): DataUsageSource {
  const host = useContext(DataUsageSourceContext) ?? testFallback;
  if (!host) throw new Error("Data usage host is not provided");
  return host;
}
