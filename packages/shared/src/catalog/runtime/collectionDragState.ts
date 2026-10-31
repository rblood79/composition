/**
 * ADR-284 Phase 5 · 6 — which collections drag and drop, from the document's rules alone. The
 * Preview gives a list `dragAndDropHooks` by it (`domBinding.components.tsx` `withDragAndDrop`) and
 * the composition root reads the same answer for a Table's drag column (ADR-295 후속 — S2 / RAC
 * Table draw a drag column whenever the table drags: `allowsDragging`), so the Canvas and the DOM
 * agree on whether the column is there.
 */
import { catalogActionsDeep } from "../document/interactionActions";
import { COLLECTION_DRAG_DROP_EVENTS } from "../../interactions/concepts/collectionDragDrop";
import type { CatalogGraph } from "../document/graph";
import type { InteractionEntry } from "../document/types";
import {
  catalogInteractionAppliesTo,
  type CatalogInteractionRecord,
} from "../resolution/effectiveInteractions";

/** The drag data type of a collection's items (`<type>+<collection or node id>`). */
export const CATALOG_DRAG_TYPE = "application/x-composition-item+";
/** The drops that bring items from elsewhere (`onReorder` · `onDragEnd` stay in the list). */
const FOREIGN_DROPS = new Set(["onInsert", "onRootDrop", "onItemDrop"]);
const DRAG_DROP_EVENTS: ReadonlySet<string> = new Set(
  COLLECTION_DRAG_DROP_EVENTS,
);

interface DragRules {
  readonly revision: number;
  /** The rules on a drag and drop event. */
  readonly rules: readonly InteractionEntry[];
  /** The collections each node's drop rules write (`update` · `move` … `collectionId`). */
  readonly writesByOwner: ReadonlyMap<string, ReadonlySet<string>>;
  readonly writesAll: ReadonlySet<string>;
}
const dragRules = new WeakMap<CatalogGraph, DragRules>();

/** One scan of the project's drag and drop rules per document revision. */
function dragRulesOf(graph: CatalogGraph): DragRules {
  const cached = dragRules.get(graph);
  if (cached?.revision === graph.revision) return cached;
  const rules: InteractionEntry[] = [];
  const writesByOwner = new Map<string, Set<string>>();
  const writesAll = new Set<string>();
  const project = graph.getEntry(graph.projectId);
  for (const id of project?.kind === "project" ? project.interactionIds : []) {
    const entry = graph.getEntry(id);
    if (entry?.kind !== "interaction" || !DRAG_DROP_EVENTS.has(entry.trigger))
      continue;
    rules.push(entry);
    if (!FOREIGN_DROPS.has(entry.trigger)) continue;
    for (const action of catalogActionsDeep(entry.actions))
      if ("collectionId" in action && action.collectionId) {
        let owned = writesByOwner.get(entry.ownerId);
        if (!owned) writesByOwner.set(entry.ownerId, (owned = new Set()));
        owned.add(action.collectionId);
        writesAll.add(action.collectionId);
      }
  }
  const next = { revision: graph.revision, rules, writesByOwner, writesAll };
  dragRules.set(graph, next);
  return next;
}

/** The drag and drop events a record's rules handle (the document's answer to `handlersOf`). */
export function catalogDragDropTriggers(
  graph: CatalogGraph,
  record: CatalogInteractionRecord,
): readonly string[] {
  return [
    ...new Set(
      dragRulesOf(graph)
        .rules.filter((entry) =>
          catalogInteractionAppliesTo(
            (id) => graph.getEntry(id as never),
            entry,
            record,
          ),
        )
        .map((entry) => entry.trigger),
    ),
  ];
}

export interface CatalogCollectionDragState {
  /** The type its items carry (`<type>+<bound collection, else the node>`). */
  readonly dragType: string;
  /** The item types it accepts: its own when it reorders, and the collections its drops write. */
  readonly acceptedTypes: readonly string[];
  /** Its items drag (RAC `getItems` — S2 / RAC Table `allowsDragging`). */
  readonly draggable: boolean;
}

/**
 * A collection whose rules handle a drag and drop (`triggers`), or whose bound collection another
 * list's drop rule writes, drags and drops — undefined otherwise. A list no rule drops onto but
 * whose collection another list's drop rule writes drags only (the photo grid); one whose drop
 * rules only write other collections takes drops only (the album sidebar).
 */
export function catalogCollectionDragState(
  graph: CatalogGraph,
  record: { readonly sourceId: string },
  triggers: readonly string[],
): CatalogCollectionDragState | undefined {
  const source = graph.getEntry(record.sourceId as never);
  const binding = source?.kind === "node" ? source.binding : undefined;
  const { writesAll, writesByOwner } = dragRulesOf(graph);
  if (!triggers.length && !(binding && writesAll.has(binding.collectionId)))
    return undefined;
  const own = binding?.collectionId ?? record.sourceId;
  const reorders = triggers.includes("onReorder");
  const written = writesByOwner.get(record.sourceId);
  const accepted = [
    ...new Set(
      written?.size ? [...(reorders ? [own] : []), ...written] : [own],
    ),
  ];
  return {
    dragType: `${CATALOG_DRAG_TYPE}${own}`,
    acceptedTypes: accepted.map((id) => `${CATALOG_DRAG_TYPE}${id}`),
    draggable:
      !binding ||
      writesAll.has(own) ||
      reorders ||
      triggers.includes("onDragEnd") ||
      !written?.size,
  };
}
