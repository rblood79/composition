import { catalogActionsDeep } from "./interactionActions";
import type {
  CatalogEntry,
  CollectionEntry,
  InteractionAction,
  InteractionEntry,
} from "./types";

/**
 * ADR-324 Decision 1 — the rules that save a 「모아서 저장」 collection's edits at once, which the
 * collection cannot have beside its batch save (the first edit would run them — HC1). The two shapes
 * are the ones the runtime counts as 「a rule's save sends the edits」 (`interactions/bindings.ts`
 * `savesRule` with the event's · the rule's own edits):
 *
 * 1. a rule on an edit event of a component showing the collection — the Table's `onCellsChange`
 *    (the Table bound to it) or an editable cell Form's `onSubmit` (a Form under it) — with a write
 *    `callEndpoint` among its Dos;
 * 2. a rule whose Dos edit the collection and also call a write `callEndpoint` (a Form that posts and
 *    appends — the appended row would be an unsaved change sent a second time).
 *
 * A write endpoint = one whose method is not GET · HEAD.
 */
export const COLLECTION_EDIT_OPCODES: ReadonlySet<InteractionAction["opcode"]> =
  new Set([
    "append",
    "update",
    "remove",
    "insert",
    "insertBefore",
    "insertAfter",
    "prepend",
    "move",
    "moveBefore",
    "moveAfter",
    "removeSelectedItems",
  ]);

/** The edit events of a component showing a collection (a Table's several-cell write, a cell Form). */
const EDIT_TRIGGERS = new Set(["onCellsChange", "onSubmit"]);

export interface ImmediateSaveReader {
  get(id: string): CatalogEntry | undefined;
  interactionIds: readonly string[];
  /** A node's parent node (none at a page root). */
  parentOf(id: string): string | undefined;
}

const writesEndpoint = (
  action: InteractionAction,
  get: ImmediateSaveReader["get"],
): boolean => {
  if (action.opcode !== "callEndpoint") return false;
  const endpoint = get(action.endpointId);
  // (An endpoint not found is not a read: the rule is counted — validation names the dangling id.)
  return endpoint?.kind !== "endpoint" || !["GET"].includes(endpoint.method);
};

/** The node · its ancestors bound to `collectionId` (the nearest first). */
function boundAt(
  nodeId: string,
  collectionId: string,
  read: ImmediateSaveReader,
): "self" | "ancestor" | undefined {
  let first = true;
  const seen = new Set<string>();
  for (
    let id: string | undefined = nodeId;
    id && !seen.has(id);
    id = read.parentOf(id)
  ) {
    seen.add(id);
    const entry = read.get(id);
    if (entry?.kind === "node" && entry.binding?.collectionId === collectionId)
      return first ? "self" : "ancestor";
    first = false;
  }
  return undefined;
}

/** The rules that save `collectionId`'s edits at once (shapes 1 and 2) — by interaction id. */
export function catalogImmediateSaveRules(
  collectionId: string,
  read: ImmediateSaveReader,
): InteractionEntry[] {
  const found: InteractionEntry[] = [];
  for (const id of read.interactionIds) {
    const rule = read.get(id);
    if (rule?.kind !== "interaction") continue;
    const actions = catalogActionsDeep(rule.actions);
    if (!actions.some((action) => writesEndpoint(action, read.get))) continue;
    const edits = actions.some(
      (action) =>
        COLLECTION_EDIT_OPCODES.has(action.opcode) &&
        "collectionId" in action &&
        action.collectionId === collectionId,
    );
    const onEdit =
      EDIT_TRIGGERS.has(rule.trigger) &&
      (() => {
        const at = boundAt(rule.ownerId, collectionId, read);
        return rule.trigger === "onCellsChange"
          ? at === "self"
          : at !== undefined;
      })();
    if (edits || onEdit) found.push(rule);
  }
  return found;
}

/** The collections whose 「모아서 저장」 is on (`save` set). */
export function catalogBatchSaveCollections(
  collectionIds: readonly string[],
  get: ImmediateSaveReader["get"],
): CollectionEntry[] {
  const out: CollectionEntry[] = [];
  for (const id of collectionIds) {
    const entry = get(id);
    if (entry?.kind === "collection" && entry.save) out.push(entry);
  }
  return out;
}

/** The endpoints a save setting names (write connections and the recheck one). */
export function catalogSaveEndpointIds(
  save: NonNullable<CollectionEntry["save"]>,
): { write: string[]; read: string[] } {
  const write: string[] = [];
  if (save.send.shape === "batch") write.push(save.send.endpointId);
  else
    for (const kind of ["update", "create", "remove"] as const) {
      const connection = save.send[kind];
      if (connection) write.push(connection.endpointId);
    }
  return {
    write,
    read: save.conflict?.by === "recheck" ? [save.conflict.endpointId] : [],
  };
}
