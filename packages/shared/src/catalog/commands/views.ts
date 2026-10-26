/**
 * ADR-284 Decision 1 · 7 — the shared (named) data views: add · edit · remove, and the promotion of
 * a binding's built-in view to a shared one (a derived view — the result count, a grouping — needs
 * the list's view as its source: never a copy of its conditions, which would drift when the list's
 * conditions change). Each is one history step; a derived view made with a promotion is one step
 * by composing the two commands in one transaction.
 */
import type {
  EntryId,
  NodeId,
  ViewEntry,
} from "../document/types";
import { catalogViewRootCollection } from "../document/graph";
import type { CatalogCommand } from "./compose";
import { CommandDraft, fail } from "./context";

const listed = (ids: readonly EntryId<"view">[] | undefined) => ids ?? [];

/** The nodes · views that read a shared view (`binding.viewId` · `source.viewId`). */
export function catalogViewUsers(
  reader: { referrersOf(id: string): Iterable<string>; getEntry(id: string): unknown },
  viewId: EntryId<"view">,
): string[] {
  const users: string[] = [];
  for (const id of reader.referrersOf(viewId)) {
    const entry = reader.getEntry(id) as
      | { kind: "node"; binding?: { viewId?: string } }
      | { kind: "view"; source: { viewId?: string } }
      | undefined;
    if (
      (entry?.kind === "node" && entry.binding?.viewId === viewId) ||
      (entry?.kind === "view" && entry.source.viewId === viewId)
    )
      users.push(id);
  }
  return users;
}

export const addView =
  (input: { entry: ViewEntry; label?: string }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    draft.create(input.entry);
    const project = draft.project();
    draft.write({
      ...project,
      viewIds: [...listed(project.viewIds), input.entry.id],
    });
    return { label: input.label ?? "Add view", ops: draft.ops() };
  };

export const updateView =
  (input: { entry: ViewEntry; label?: string }): CatalogCommand =>
  (reader) => {
    if (reader.getEntry(input.entry.id)?.kind !== "view")
      return fail("ENTRY_NOT_FOUND", input.entry.id);
    return {
      label: input.label ?? "Edit view",
      ops: [{ kind: "put", entry: input.entry }],
    };
  };

/**
 * A derived view (one over another view — a result count, a grouping, a kanban column) goes with
 * the last node reading it: called by a removal with the nodes it removed. A view read by nothing
 * else is removed, then its source if that is a derived view left unread too. A view over a
 * collection (a list's named or promoted view) stays — it is the user's.
 */
export function removeUnreadDerivedViews(
  draft: CommandDraft,
  removedNodes: readonly string[],
): void {
  const queue: string[] = [];
  for (const id of removedNodes) {
    const entry = draft.reader.getEntry(id) as
      | { kind: "node"; binding?: { viewId?: string } }
      | undefined;
    if (entry?.kind === "node" && entry.binding?.viewId)
      queue.push(entry.binding.viewId);
  }
  const gone: string[] = [];
  while (queue.length) {
    const viewId = queue.shift()!;
    if (draft.removed(viewId)) continue;
    const view = draft.read(viewId) as ViewEntry | undefined;
    if (view?.kind !== "view" || !("viewId" in view.source)) continue;
    const readers = catalogViewUsers(draft.reader, view.id).filter(
      (id) => !draft.removed(id),
    );
    if (readers.length) continue;
    draft.remove(view.id);
    gone.push(view.id);
    queue.push(view.source.viewId);
  }
  if (!gone.length) return;
  const project = draft.project();
  draft.write({
    ...project,
    viewIds: listed(project.viewIds).filter((id) => !gone.includes(id)),
  });
}

/** Remove a shared view no binding or view reads (else `VIEW_IN_USE` — the panel names them). */
export const removeView =
  (input: { id: EntryId<"view">; label?: string }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    if (draft.read(input.id)?.kind !== "view")
      return fail("ENTRY_NOT_FOUND", input.id);
    if (catalogViewUsers(reader, input.id).length)
      return fail("VIEW_IN_USE", input.id);
    const project = draft.project();
    draft.write({
      ...project,
      viewIds: listed(project.viewIds).filter((id) => id !== input.id),
    });
    draft.remove(input.id);
    return { label: input.label ?? "Delete view", ops: draft.ops() };
  };

/**
 * A binding's built-in view as a shared view (`id` · `name`): the binding reads it by `viewId`. A
 * binding that already reads a shared view is left as it is (nothing to promote); one with no
 * view gets an empty shared view (every row).
 */
export const promoteBindingView =
  (input: {
    nodeId: NodeId;
    id: EntryId<"view">;
    name: string;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const node = draft.node(input.nodeId);
    const binding = node.binding;
    if (!binding) return fail("BINDING_REQUIRED", input.nodeId);
    if (binding.viewId) return { label: input.label ?? "Share view", ops: [] };
    const { view, ...rest } = binding;
    const entry: ViewEntry = {
      kind: "view",
      id: input.id,
      name: input.name,
      source: { collectionId: binding.collectionId },
      ...(view ?? { where: { id: "where", op: "and", items: [] } }),
    };
    draft.create(entry);
    const project = draft.project();
    draft.write({
      ...project,
      viewIds: [...listed(project.viewIds), input.id],
    });
    draft.write({ ...node, binding: { ...rest, viewId: input.id } });
    if (catalogViewRootCollection(input.id, (id) => draft.read(id)) !==
      binding.collectionId)
      return fail("VIEW_COLLECTION_MISMATCH", input.id);
    return { label: input.label ?? "Share view", ops: draft.ops() };
  };
