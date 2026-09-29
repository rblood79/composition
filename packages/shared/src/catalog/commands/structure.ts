import { cloneNodeSubgraph } from "../document/clone";
import { ownedChildren, referencedIds } from "../document/graph";
import type {
  CatalogEntry,
  CatalogReader,
  EntryId,
  InteractionEntry,
  NodeEntry,
  NodeId,
  StateVariableEntry,
} from "../document/types";
import type { CatalogCommand } from "./compose";
import {
  assertNestable,
  childList,
  CommandDraft,
  fail,
  isWithin,
  locate,
  overrideAt,
  sameAddress,
  setChildList,
  topLevel,
  type EditTarget,
  type NodeParent,
} from "./context";
import { ensureChildList, type NewId } from "./materialize";

/**
 * ADR-248 Phase 4b structure commands: insert, move/reorder, remove, duplicate, copy and paste.
 * Each is one transaction; nodes are placed in a page, an owned node, or an instance's container
 * position (materialized into a `fillSlot` on first use).
 */

type Related = StateVariableEntry | InteractionEntry;

const clampIndex = (index: number | undefined, length: number): number =>
  index === undefined || index < 0 || index > length ? length : index;

function addRelated(draft: CommandDraft, related: readonly Related[]): void {
  if (!related.length) return;
  for (const entry of related) draft.create(entry);
  const project = draft.project();
  draft.write({
    ...project,
    stateVariableIds: [
      ...project.stateVariableIds,
      ...related
        .filter((entry) => entry.kind === "stateVariable")
        .map((entry) => entry.id as EntryId<"stateVariable">),
    ],
    interactionIds: [
      ...project.interactionIds,
      ...related
        .filter((entry) => entry.kind === "interaction")
        .map((entry) => entry.id as EntryId<"interaction">),
    ],
  });
}

function placeAt(
  draft: CommandDraft,
  parent: NodeParent,
  index: number | undefined,
  ids: readonly NodeId[],
  newId: NewId,
): void {
  const list = ensureChildList(draft, parent, newId);
  const at = clampIndex(index, list.length);
  setChildList(draft, parent, [
    ...list.slice(0, at),
    ...ids,
    ...list.slice(at),
  ]);
}

export interface InsertNodesInput {
  parent: NodeParent;
  /** Position in the parent's children; absent or out of range = the end. */
  index?: number;
  /** The new subtree records (every ID new), roots first or in any order. */
  entries: readonly NodeEntry[];
  rootIds: readonly NodeId[];
  /** Owned state variables and interactions of the new nodes. */
  related?: readonly Related[];
  newId: NewId;
  label?: string;
}
export const insertNodes =
  (input: InsertNodesInput): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const byId = new Map(input.entries.map((entry) => [entry.id, entry]));
    assertNestable(
      draft,
      input.parent,
      input.rootIds.map(
        (id) => byId.get(id)?.definitionId ?? fail("ROOT_NOT_IN_ENTRIES", id),
      ),
    );
    for (const entry of input.entries) draft.create(entry);
    addRelated(draft, input.related ?? []);
    placeAt(draft, input.parent, input.index, input.rootIds, input.newId);
    return {
      label: input.label ?? "Insert",
      ops: draft.ops(),
      selectAfter: input.rootIds,
    };
  };

export interface MoveNodesInput {
  ids: readonly NodeId[];
  parent: NodeParent;
  /** Position among the parent's children without the moved nodes; absent = the end. */
  index?: number;
  newId: NewId;
  label?: string;
}
/** Move (or reorder) nodes; nodes under another moved node travel with it. */
export const moveNodes =
  (input: MoveNodesInput): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const roots = topLevel(reader, input.ids);
    const parentNode =
      input.parent.kind === "node"
        ? input.parent.id
        : input.parent.kind === "descendant"
          ? input.parent.ownerId
          : undefined;
    for (const id of roots)
      if (parentNode && isWithin(reader, parentNode, id))
        fail("MOVE_INTO_SELF", id);
    assertNestable(
      draft,
      input.parent,
      roots.map((id) => draft.node(id).definitionId),
    );
    const owners = new Map(roots.map((id) => [id, reader.ownerOf(id)]));
    for (const id of roots) {
      const { parent } = locate(draft, id, owners.get(id));
      const list = childList(draft, parent) ?? [];
      setChildList(
        draft,
        parent,
        list.filter((child) => child !== id),
      );
    }
    placeAt(draft, input.parent, input.index, roots, input.newId);
    return {
      label: input.label ?? "Move",
      ops: draft.ops(),
      selectAfter: roots,
    };
  };

/** Owned subtree of a node (children, fill-slot children and replacements), node first. */
function subtree(draft: CommandDraft, id: NodeId): NodeId[] {
  const out: NodeId[] = [];
  const stack = [id];
  while (stack.length) {
    const next = stack.pop()!;
    out.push(next);
    stack.push(...ownedChildren(draft.node(next)));
  }
  return out;
}

/**
 * Remove records and everything that names them: owned state variables and interactions (and
 * interactions that act on a removed variable or target), and other instances' overrides whose
 * address passes through a removed node.
 */
function removeWithReferrers(
  draft: CommandDraft,
  ids: readonly string[],
): void {
  const queue = [...ids];
  for (const id of ids) draft.remove(id);
  const removedRelated: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    for (const referrerId of draft.reader.referrersOf(id)) {
      if (draft.removed(referrerId)) continue;
      const entry = draft.read(referrerId);
      if (!entry) continue;
      if (entry.kind === "stateVariable" || entry.kind === "interaction") {
        draft.remove(referrerId);
        removedRelated.push(referrerId);
        queue.push(referrerId);
      } else if (entry.kind === "node") {
        const kept = entry.descendantOverrides.filter(
          (item) =>
            !referencedIds({
              ...entry,
              descendantOverrides: [item],
            } as CatalogEntry).some((ref) => draft.removed(ref)),
        );
        if (kept.length !== entry.descendantOverrides.length)
          draft.write({ ...entry, descendantOverrides: kept });
      }
    }
  }
  if (!removedRelated.length) return;
  const gone = new Set(removedRelated);
  const project = draft.project();
  draft.write({
    ...project,
    stateVariableIds: project.stateVariableIds.filter((id) => !gone.has(id)),
    interactionIds: project.interactionIds.filter((id) => !gone.has(id)),
  });
}

export interface RemoveInput {
  /** Owned nodes are deleted; an instance's template position is hidden (`enabled: false`). */
  targets: readonly EditTarget[];
  label?: string;
}
export const removeTargets =
  (input: RemoveInput): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const nodeIds = topLevel(
      reader,
      input.targets.flatMap((target) =>
        target.kind === "node" ? [target.id] : [],
      ),
    );
    const removed: NodeId[] = [];
    for (const id of nodeIds) {
      const ownerId = reader.ownerOf(id);
      const owner = ownerId ? draft.read(ownerId) : undefined;
      const replaced =
        owner?.kind === "node"
          ? owner.descendantOverrides.find(
              (item) => item.kind === "replace" && item.replacementId === id,
            )
          : undefined;
      if (replaced && owner?.kind === "node") {
        // A replacement's position is hidden, like a template position the user deletes.
        draft.write({
          ...owner,
          descendantOverrides: [
            ...owner.descendantOverrides.filter((item) => item !== replaced),
            { kind: "patch", address: replaced.address, enabled: false },
          ],
        });
      } else {
        const { parent } = locate(draft, id, ownerId);
        const list = childList(draft, parent) ?? [];
        setChildList(
          draft,
          parent,
          list.filter((child) => child !== id),
        );
      }
      removed.push(...subtree(draft, id));
    }
    for (const target of input.targets) {
      if (target.kind !== "descendant") continue;
      if (removed.includes(target.ownerId)) continue;
      const owner = draft.node(target.ownerId);
      const current = overrideAt(owner, target.address);
      const overrides = owner.descendantOverrides.filter(
        (item) => !sameAddress(item.address, target.address),
      );
      overrides.push(
        current?.kind === "patch"
          ? { ...current, enabled: false }
          : { kind: "patch", address: target.address, enabled: false },
      );
      draft.write({ ...owner, descendantOverrides: overrides });
    }
    removeWithReferrers(draft, removed);
    return { label: input.label ?? "Delete", ops: draft.ops() };
  };

/** Allocate the related ID kinds the clone asks for. */
const relatedId =
  (newId: NewId) =>
  (
    oldId: EntryId<"stateVariable"> | EntryId<"interaction">,
  ): EntryId<"stateVariable"> | EntryId<"interaction"> =>
    oldId.startsWith("project:stateVariable:")
      ? newId("stateVariable")
      : newId("interaction");

export interface DuplicateNodesInput {
  ids: readonly NodeId[];
  newId: NewId;
  label?: string;
}
/** Duplicate each top-level node right after itself, with its owned records. */
export const duplicateNodes =
  (input: DuplicateNodesInput): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const copies: NodeId[] = [];
    for (const id of topLevel(reader, input.ids)) {
      const { parent, index } = locate(draft, id);
      const clone = cloneNodeSubgraph(
        {
          getEntry: (entryId) => draft.read(entryId),
          referrersOf: (entryId) => reader.referrersOf(entryId),
        },
        id,
        () => input.newId("node"),
        relatedId(input.newId),
      );
      for (const entry of clone.entries) draft.create(entry);
      addRelated(draft, clone.relatedEntries);
      placeAt(draft, parent, index + 1, [clone.rootId], input.newId);
      copies.push(clone.rootId);
    }
    return {
      label: input.label ?? "Duplicate",
      ops: draft.ops(),
      selectAfter: copies,
    };
  };

/** A copied selection: its records as they were (pasted later with new IDs). */
export interface CatalogClipboard {
  rootIds: readonly NodeId[];
  entries: readonly (NodeEntry | Related)[];
}
/** Read-only: the top-level nodes' subtrees and their owned state variables and interactions. */
export function copyNodes(
  reader: CatalogReader,
  ids: readonly NodeId[],
): CatalogClipboard {
  const draft = new CommandDraft(reader);
  const rootIds = topLevel(reader, ids);
  const nodes = new Set(rootIds.flatMap((id) => subtree(draft, id)));
  const entries: (NodeEntry | Related)[] = [];
  const related = new Set<string>();
  for (const id of nodes) {
    entries.push(structuredClone(draft.node(id)));
    for (const referrerId of reader.referrersOf(id)) {
      const entry = reader.getEntry(referrerId);
      if (
        (entry?.kind === "stateVariable" || entry?.kind === "interaction") &&
        nodes.has(entry.ownerId as NodeId) &&
        !related.has(referrerId)
      ) {
        related.add(referrerId);
        entries.push(structuredClone(entry));
      }
    }
  }
  return { rootIds, entries };
}

export interface PasteNodesInput {
  clipboard: CatalogClipboard;
  parent: NodeParent;
  index?: number;
  newId: NewId;
  label?: string;
}
/** Paste a clipboard with new IDs (the source may be gone or in another project). */
export const pasteNodes =
  (input: PasteNodesInput): CatalogCommand =>
  (reader) => {
    const records = new Map(
      input.clipboard.entries.map((entry) => [entry.id as string, entry]),
    );
    const referrers = new Map<string, Set<string>>();
    for (const entry of input.clipboard.entries)
      for (const ref of referencedIds(entry as CatalogEntry)) {
        if (!referrers.has(ref)) referrers.set(ref, new Set());
        referrers.get(ref)!.add(entry.id);
      }
    const source = {
      getEntry: (id: string) => records.get(id) as CatalogEntry | undefined,
      referrersOf: (id: string) => referrers.get(id) ?? new Set<string>(),
    };
    const entries: NodeEntry[] = [];
    const related: Related[] = [];
    const rootIds: NodeId[] = [];
    for (const rootId of input.clipboard.rootIds) {
      const clone = cloneNodeSubgraph(
        source,
        rootId,
        () => input.newId("node"),
        relatedId(input.newId),
      );
      entries.push(...clone.entries);
      related.push(...clone.relatedEntries);
      rootIds.push(clone.rootId);
    }
    return insertNodes({
      parent: input.parent,
      index: input.index,
      entries,
      rootIds,
      related,
      newId: input.newId,
      label: input.label ?? "Paste",
    })(reader);
  };
