/**
 * ADR-320 Phase 2 (breakdown §5.11) — 「Add filter bar」 in a bound list's 「검색 · 필터」: one step puts
 * a FilterBar (the palette's origin) right before the list and connects it (`filtersOf` — its chip
 * becomes the template repeated per condition). Undo takes both away. A list already in a bar's scope
 * shows that bar instead (one bar per list — the graph refuses a second).
 */
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import { setFilterBarTargets } from "../../../../../packages/shared/src/catalog/commands/filterBar";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import { insertNodes } from "../../../../../packages/shared/src/catalog/commands/structure";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import { FILTER_BAR_ORIGIN_ID } from "../../../../../packages/shared/src/catalog/document/filterBarOrigins";
import type {
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import { catalogFilterBarOf } from "../../../../../packages/shared/src/catalog/runtime/filterBar";
import { catalogParentOfNode } from "./insertParent";
import { catalogCreationProps } from "./paletteInsert";
import { childIdsOf, sequence } from "./viewAuthoring";

/** The bar that filters a list (none = the list is its own scope). */
export function catalogListFilterBar(
  graph: Pick<CatalogGraph, "instancesOf" | "getEntry">,
  listId: NodeId,
): NodeEntry | undefined {
  return catalogFilterBarOf(
    graph.instancesOf(FILTER_BAR_ORIGIN_ID),
    (id) => graph.getEntry(id),
    listId,
  );
}

/** 「Add filter bar」: a FilterBar before the list, connected to it — one step. */
export function catalogAddFilterBarCommand(
  plan: { readonly listId: NodeId },
  newId: NewId,
): { command: CatalogCommand; created: { barId: NodeId } } {
  const barId = newId("node") as NodeId;
  const command = sequence("Add filter bar", [
    (stage) => {
      const parent = catalogParentOfNode(stage, plan.listId);
      if (!parent) throw new Error(`NO_PARENT: ${plan.listId}`);
      const definitionId = FILTER_BAR_ORIGIN_ID as LibraryDefinitionId;
      return insertNodes({
        parent,
        index: childIdsOf(stage, parent).indexOf(plan.listId),
        entries: [
          {
            kind: "node",
            id: barId,
            definitionId,
            children: [],
            props: catalogCreationProps(stage, definitionId, "FilterBar"),
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: [barId],
        newId,
      });
    },
    () => setFilterBarTargets(barId, [plan.listId]),
  ]);
  return { command, created: { barId } };
}
