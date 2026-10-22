import { toRuntimeApiEndpoint } from "@composition/shared";
import type { ApiEndpoint, DataTable } from "../../types/builder/data.types";

/**
 * An endpoint as a project file or the Preview reads it (`toRuntimeApiEndpoint`), with the
 * collection a query endpoint fills by name (`targetCollection`) — the import re-points it, the
 * Preview's `reload` (`useAsyncList.reload`) finds the endpoint of a collection by it.
 */
export function endpointWithTarget(
  endpoint: ApiEndpoint,
  collections: ReadonlyMap<string, DataTable>,
): ReturnType<typeof toRuntimeApiEndpoint> & { targetCollection?: string } {
  const collectionId = endpoint.targetCollectionId;
  const target =
    (collectionId && collections.get(collectionId)?.name) ||
    endpoint.targetCollection;
  return {
    ...toRuntimeApiEndpoint(endpoint),
    ...(target ? { targetCollection: target } : {}),
  };
}
