/**
 * ADR-286 Decision 2 — the data definitions (collections · API endpoints · project variables) are
 * document entries: one command writes them, so a data edit is one history step, one save and part
 * of the project file. The Data panel's `DataChange` ops (ADR-213 — AI · agent · import) keep their
 * vocabulary: the Builder reduces them and writes the result with `setDataEntries`.
 */
import type {
  CollectionEntry,
  DataCollectionId,
  DataEndpointId,
  DataEntry,
  EndpointEntry,
  EntryId,
  ProjectEntry,
  ProjectVariableEntry,
  ProjectVariableId,
  ViewEntry,
} from "../document/types";
import type { CatalogCommand } from "./compose";
import { CommandDraft, fail } from "./context";

type DataEntryId = DataEntry["id"];
const LIST_KEY = {
  collection: "collectionIds",
  endpoint: "endpointIds",
  projectVariable: "projectVariableIds",
} as const;
const kindOf = (id: string): DataEntry["kind"] | undefined =>
  id.startsWith("data:collection:")
    ? "collection"
    : id.startsWith("data:endpoint:")
      ? "endpoint"
      : id.startsWith("data:variable:")
        ? "projectVariable"
        : undefined;

/** The nodes bound to a collection (the graph's or a stage's binding index). */
function boundNodes(
  draft: CommandDraft,
  collectionId: DataCollectionId,
): Iterable<string> {
  const reader = draft.reader as Partial<{
    bindingsOf(id: string): ReadonlySet<string>;
  }>;
  return reader.bindingsOf?.(collectionId) ?? [];
}

/**
 * A removed collection takes what reads it, in the same step (undo restores both): the bindings to
 * it, the shared views over it (and views derived from those), and endpoints filling it.
 */
function removeCollectionReaders(
  draft: CommandDraft,
  collectionId: DataCollectionId,
): void {
  for (const nodeId of boundNodes(draft, collectionId)) {
    if (draft.removed(nodeId)) continue;
    const node = draft.read(nodeId);
    if (node?.kind !== "node" || node.binding?.collectionId !== collectionId)
      continue;
    const { binding: _binding, ...unbound } = node;
    draft.write(unbound);
  }
  const project = draft.project();
  const views = (project.viewIds ?? [])
    .map((id) => draft.read(id))
    .filter((entry): entry is ViewEntry => entry?.kind === "view");
  const gone = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const view of views)
      if (
        !gone.has(view.id) &&
        ("collectionId" in view.source
          ? view.source.collectionId === collectionId
          : gone.has(view.source.viewId))
      ) {
        gone.add(view.id);
        grew = true;
      }
  }
  for (const id of gone) draft.remove(id);
  if (gone.size)
    draft.write({
      ...project,
      viewIds: (project.viewIds ?? []).filter((id) => !gone.has(id)),
    });
  for (const id of draft.project().endpointIds ?? []) {
    if (draft.removed(id)) continue;
    const endpoint = draft.read(id);
    if (endpoint?.kind !== "endpoint") continue;
    if (endpoint.targetCollectionId !== collectionId) continue;
    const { targetCollectionId: _target, ...rest } = endpoint;
    draft.write(rest);
  }
}

/**
 * Write data entries (new or replaced) and remove others, the project's lists following. A removed
 * collection's readers go in the same step (`removeCollectionReaders`).
 */
export const setDataEntries =
  (input: {
    puts?: readonly DataEntry[];
    removeIds?: readonly DataEntryId[];
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const lists: {
      collectionIds: DataCollectionId[];
      endpointIds: DataEndpointId[];
      projectVariableIds: ProjectVariableId[];
    } = {
      collectionIds: [...(draft.project().collectionIds ?? [])],
      endpointIds: [...(draft.project().endpointIds ?? [])],
      projectVariableIds: [...(draft.project().projectVariableIds ?? [])],
    };
    for (const id of input.removeIds ?? []) {
      const kind = kindOf(id);
      if (!kind || draft.read(id)?.kind !== kind)
        return fail("ENTRY_NOT_FOUND", id);
      draft.remove(id);
      const key = LIST_KEY[kind];
      (lists[key] as string[]).splice((lists[key] as string[]).indexOf(id), 1);
    }
    for (const entry of input.puts ?? []) {
      if (kindOf(entry.id) !== entry.kind) fail("INVALID_ID", entry.id);
      const current = draft.read(entry.id);
      if (current && current.kind !== entry.kind)
        fail("ID_COLLISION", entry.id);
      draft.write(entry);
      const list = lists[LIST_KEY[entry.kind]] as string[];
      if (!list.includes(entry.id)) list.push(entry.id);
    }
    // The project changes only when a list does (an edit of an entry leaves it — its step then
    // redraws only what reads that entry, ADR-286 R8).
    const project = draft.project();
    const next: ProjectEntry = { ...project };
    let listsChanged = false;
    for (const key of [
      "collectionIds",
      "endpointIds",
      "projectVariableIds",
    ] as const) {
      const before = (project[key] ?? []) as readonly string[];
      const after = lists[key] as readonly string[];
      if (
        before.length !== after.length ||
        before.some((id, index) => id !== after[index])
      )
        listsChanged = true;
      if (after.length) (next as unknown as Record<string, unknown>)[key] = after;
      else delete next[key];
    }
    if (listsChanged) draft.write(next);
    for (const id of input.removeIds ?? [])
      if (kindOf(id) === "collection")
        removeCollectionReaders(draft, id as DataCollectionId);
    return { label: input.label ?? "Edit data", ops: draft.ops() };
  };

export const addCollection = (input: {
  entry: CollectionEntry;
  label?: string;
}): CatalogCommand =>
  setDataEntries({
    puts: [input.entry],
    label: input.label ?? "Add collection",
  });
export const updateCollection = (input: {
  entry: CollectionEntry;
  label?: string;
}): CatalogCommand =>
  setDataEntries({
    puts: [input.entry],
    label: input.label ?? "Edit collection",
  });
export const removeCollection = (input: {
  id: DataCollectionId;
  label?: string;
}): CatalogCommand =>
  setDataEntries({
    removeIds: [input.id],
    label: input.label ?? "Delete collection",
  });
export const setEndpoint = (input: {
  entry: EndpointEntry;
  label?: string;
}): CatalogCommand =>
  setDataEntries({ puts: [input.entry], label: input.label ?? "Edit API" });
export const removeEndpoint = (input: {
  id: DataEndpointId;
  label?: string;
}): CatalogCommand =>
  setDataEntries({
    removeIds: [input.id],
    label: input.label ?? "Delete API",
  });
export const setProjectVariable = (input: {
  entry: ProjectVariableEntry;
  label?: string;
}): CatalogCommand =>
  setDataEntries({
    puts: [input.entry],
    label: input.label ?? "Edit variable",
  });
export const removeProjectVariable = (input: {
  id: ProjectVariableId;
  label?: string;
}): CatalogCommand =>
  setDataEntries({
    removeIds: [input.id],
    label: input.label ?? "Delete variable",
  });

/** The project's data entries of one kind, in list order (no document scan). */
export function catalogDataEntries<K extends DataEntry["kind"]>(
  reader: { projectId: EntryId<"project">; getEntry(id: string): unknown },
  kind: K,
): Extract<DataEntry, { kind: K }>[] {
  const project = reader.getEntry(reader.projectId) as ProjectEntry | undefined;
  const ids = (project?.[LIST_KEY[kind]] ?? []) as readonly string[];
  const out: Extract<DataEntry, { kind: K }>[] = [];
  for (const id of ids) {
    const entry = reader.getEntry(id) as DataEntry | undefined;
    if (entry?.kind === kind)
      out.push(entry as Extract<DataEntry, { kind: K }>);
  }
  return out;
}
