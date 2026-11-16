import { useMemo } from "react";
import { useCatalogRevision } from "../../../catalogRuntime/react";
import {
  catalogCollectionUsage,
  catalogFieldUsageElements,
} from "../../../catalogRuntime/dataBinding";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import { definitionTypeName } from "../../../../../../../packages/shared/src/catalog/commands/context";
import type { DefinitionId } from "../../../../../../../packages/shared/src/catalog/document/types";
import { resolveFieldUsage } from "../utils/fieldUsage";

/** ADR-312 — 노드의 컴포넌트 type 이름 (Chart 역할 축). 풀리지 않는 정의는 없음. */
function componentTypeOf(
  graph: Parameters<typeof definitionTypeName>[0],
  definitionId: string,
): string | undefined {
  try {
    return definitionTypeName(graph, definitionId as DefinitionId);
  } catch {
    return undefined;
  }
}
import type { DataUsageSource } from "./dataUsageSource";

/** ADR-248 Phase 4e-4e: document usage from the open catalog project (re-read at each step). */
export function createCatalogDataUsageSource(
  workspace: CatalogWorkspace,
): DataUsageSource {
  const graph = () => workspace.runtime.graph;
  const useRevision = () => useCatalogRevision(workspace);
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
          catalogFieldUsageElements(graph(), collection.id).map((element) => ({
            ...element,
            componentType: componentTypeOf(graph(), element.type),
          })),
          collection,
          field,
        );
      }, [collection, field, revision]);
    },
  };
}
