/**
 * ADR-320 Phase 2 (breakdown §5.11) — which start items a filter bar's lists cannot take: the Preview
 * assignment's judgment (`catalogJudgeFilterItems` — a field the rows lack, a condition the request
 * cannot carry). Loaded with the bar's start-condition editor (it reads the request serializer).
 */
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  CatalogEntry,
  NodeEntry,
  ViewCondition,
  ViewConditionGroup,
} from "../../../../../packages/shared/src/catalog/document/types";
import { catalogFilterBarCollection } from "../../../../../packages/shared/src/catalog/runtime/filterBar";
import { catalogJudgeFilterItems } from "../../../../../packages/shared/src/catalog/runtime/filterScope";
import { catalogTableStateQueries } from "../../../../../packages/shared/src/catalog/runtime/tableStateQuery";
import {
  viewFieldOf,
  viewRunReferences,
  viewRunSchema,
} from "../../../../../packages/shared/src/collections/view/evaluate";
import {
  endpointUrlKeys,
  viewQueryLimits,
} from "../../../../../packages/shared/src/collections/view/serialize";

type Reader = Pick<CatalogGraph, "getEntry" | "projectId">;

/**
 * The start items the bar's lists' supply cannot take (their ids) — the Preview drops them when it
 * assigns the tree (§5.3). Mock rows take every condition on a field they have; an endpoint takes
 * what its query format carries.
 */
export function catalogFilterBarRefusedItems(
  graph: Reader,
  bar: NodeEntry,
  tree: ViewConditionGroup | undefined,
): Set<string> {
  if (!tree) return new Set();
  const read = (id: string) => graph.getEntry(id);
  const collectionId = catalogFilterBarCollection(bar, read);
  const collection = collectionId ? read(collectionId) : undefined;
  if (collection?.kind !== "collection") return new Set();
  const project = read(graph.projectId);
  const entries = (ids: readonly string[] | undefined): CatalogEntry[] =>
    (ids ?? []).flatMap((id) => {
      const entry = read(id);
      return entry ? [entry] : [];
    });
  const collections =
    project?.kind === "project"
      ? entries(project.collectionIds).flatMap((entry) =>
          entry.kind === "collection"
            ? [{ ...entry, id: entry.id.replace(/^data:collection:/, "") }]
            : [],
        )
      : [];
  const schema = viewRunSchema(collection.schema);
  const references = viewRunReferences(collections as never);
  const endpoint =
    project?.kind === "project" && !collection.useMockData
      ? entries(project.endpointIds).find(
          (entry) =>
            entry.kind === "endpoint" &&
            entry.targetCollectionId === collection.id,
        )
      : undefined;
  const format =
    endpoint?.kind === "endpoint"
      ? (endpoint.querySerialization as unknown as
          Parameters<typeof viewQueryLimits>[0] | undefined)
      : undefined;
  const { refused } = catalogJudgeFilterItems(tree, {
    fieldReadable: (path) => !!viewFieldOf(path, schema, references),
    refusedBy: (items, ids) =>
      !!format &&
      endpoint?.kind === "endpoint" &&
      viewQueryLimits(
        format,
        {
          queries:
            catalogTableStateQueries(undefined, {
              where: items as (ViewCondition | ViewConditionGroup)[],
            }) ?? [],
          schema,
        },
        endpoint.method,
        endpointUrlKeys(endpoint),
      ).some(
        (warning) =>
          warning.code === "GET_BODY" ||
          (warning.conditionId !== undefined && ids.has(warning.conditionId)),
      ),
  });
  return new Set(refused.map((item) => item.id));
}
