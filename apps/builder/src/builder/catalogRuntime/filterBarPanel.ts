/**
 * ADR-320 Phase 2 (breakdown §5.11) — what the filter bar's panel reads: the lists it may filter
 * (the page's bound lists of the 17 types — the bar's collection's once it filters one, none another
 * bar filters) and the fields it offers (its collection's schema in the bar's order, the hidden ones
 * marked). Which start items the supply cannot take is `filterBarRefused.ts` (lazy — it reads the
 * request serializer).
 */
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import { FILTER_BAR_ORIGIN_ID } from "../../../../../packages/shared/src/catalog/document/filterBarOrigins";
import type {
  DefinitionId,
  NodeEntry,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  CATALOG_FILTER_TARGET_TYPES,
  catalogFilterBarCollection,
} from "../../../../../packages/shared/src/catalog/runtime/filterBar";
import { catalogFilterBarFieldList } from "../../../../../packages/shared/src/catalog/runtime/filterBarFields";

type Reader = Pick<
  CatalogGraph,
  "getEntry" | "instancesOf" | "ownerOf" | "projectId" | "getDefinition"
>;

const typeOf = (graph: Reader, node: NodeEntry): string =>
  graph.getDefinition(node.definitionId as DefinitionId)?.name ?? "";

/** The page a node is on (its top owner). */
function pageOf(graph: Reader, id: string): string | undefined {
  let at: string | undefined = id;
  let last = id;
  while (at) {
    last = at;
    at = graph.ownerOf(at as NodeId);
  }
  return last;
}

/** A list the bar may filter: a bound list of the 17 on the bar's page, no other bar's. */
export interface CatalogFilterBarCandidate {
  readonly id: NodeId;
  readonly name: string;
  readonly type: string;
  readonly connected: boolean;
}

export function catalogFilterBarCandidates(
  graph: Reader,
  barId: NodeId,
): CatalogFilterBarCandidate[] {
  const bar = graph.getEntry(barId);
  if (bar?.kind !== "node") return [];
  const page = pageOf(graph, barId);
  const own = new Set<string>(bar.filtersOf ?? []);
  const others = new Set<string>();
  for (const id of graph.instancesOf(FILTER_BAR_ORIGIN_ID)) {
    if (id === barId) continue;
    const other = graph.getEntry(id);
    if (other?.kind === "node")
      for (const target of other.filtersOf ?? []) others.add(target);
  }
  const collection = catalogFilterBarCollection(bar, (id) =>
    graph.getEntry(id),
  );
  const project = graph.getEntry(graph.projectId);
  const out: CatalogFilterBarCandidate[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = graph.getEntry(id);
    if (node?.kind !== "node") return;
    const type = typeOf(graph, node);
    if (
      node.binding &&
      CATALOG_FILTER_TARGET_TYPES.has(type) &&
      !others.has(id) &&
      (!collection || node.binding.collectionId === collection)
    )
      out.push({
        id: node.id,
        name: node.name || type,
        type,
        connected: own.has(id),
      });
    for (const child of node.children) visit(child);
    for (const override of node.descendantOverrides)
      if (override.kind === "fillSlot") override.childIds.forEach(visit);
  };
  if (project?.kind === "project")
    for (const pageId of project.pageIds) {
      if (page && pageId !== page) continue;
      const entry = graph.getEntry(pageId);
      if (entry?.kind === "page") entry.children.forEach(visit);
    }
  return out;
}

/** The bar's collection schema as its panel lists it (the bar's order first, hidden marked). */
export function catalogFilterBarFields(
  graph: Reader,
  bar: NodeEntry,
): { id: string; label: string; type?: string; hidden: boolean }[] {
  return catalogFilterBarFieldList(bar, (id) => graph.getEntry(id)).map(
    ({ id, label, type, hidden }) => ({
      id,
      label,
      ...(type ? { type } : {}),
      hidden,
    }),
  );
}
