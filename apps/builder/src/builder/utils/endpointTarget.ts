import { toRuntimeApiEndpoint } from "@composition/shared";
import type { ApiEndpoint, DataTable } from "../../types/builder/data.types";

/**
 * An endpoint as a project file or the Preview reads it (`toRuntimeApiEndpoint`), with the
 * collection a query endpoint fills — its id (`targetCollectionId`, what the Preview's `reload`
 * matches first) and its name (`targetCollection`, what the import re-points). An endpoint linked
 * by id fills that collection only: a deleted one leaves no target (its stored name may be another
 * collection's now).
 */
export function endpointWithTarget(
  endpoint: ApiEndpoint,
  collections: ReadonlyMap<string, DataTable>,
): ReturnType<typeof toRuntimeApiEndpoint> {
  const collectionId = endpoint.targetCollectionId;
  const linked = collectionId ? collections.get(collectionId) : undefined;
  const target = collectionId
    ? linked && { targetCollectionId: linked.id, targetCollection: linked.name }
    : endpoint.targetCollection && {
        targetCollection: endpoint.targetCollection,
      };
  return { ...toRuntimeApiEndpoint(endpoint), ...target };
}
