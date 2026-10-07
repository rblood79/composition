import { mapShowWhenNodeIds } from "./stateOwnerRefs";
import type {
  CatalogReader,
  DescendantOverride,
  EntryId,
  NodeEntry,
  NodeId,
  StateVariableEntry,
  InteractionEntry,
} from "./types";
import { CatalogValidationError } from "./validation";

/** Clones owned records only. Definition, library and external data references remain IDs. */
export function cloneNodeSubgraph(
  graph: Pick<CatalogReader, "getEntry" | "referrersOf">,
  rootId: NodeId,
  allocateId: (oldId: NodeId) => NodeId,
  allocateRelatedId?: (
    oldId: EntryId<"stateVariable"> | EntryId<"interaction">,
  ) => EntryId<"stateVariable"> | EntryId<"interaction">,
): {
  rootId: NodeId;
  entries: readonly NodeEntry[];
  relatedEntries: readonly (StateVariableEntry | InteractionEntry)[];
} {
  const cloned = new Map<NodeId, NodeId>();
  const allocated = new Set<NodeId>();
  const ordered: NodeEntry[] = [];
  const read = (id: NodeId): NodeEntry => {
    const entry = graph.getEntry(id);
    if (entry?.kind !== "node")
      throw new CatalogValidationError("NODE_REQUIRED", id);
    return entry;
  };
  const visit = (id: NodeId): void => {
    if (cloned.has(id)) return;
    const next = allocateId(id);
    if (allocated.has(next) || graph.getEntry(next))
      throw new CatalogValidationError("CLONE_ID_COLLISION", next);
    cloned.set(id, next);
    allocated.add(next);
    const node = read(id);
    for (const childId of node.children) visit(childId);
    for (const override of node.descendantOverrides) {
      if (override.kind === "replace") visit(override.replacementId);
      if (override.kind === "fillSlot")
        for (const childId of override.childIds) visit(childId);
    }
    ordered.push(node);
  };
  visit(rootId);
  const map = (id: NodeId) => cloned.get(id) ?? id;
  const overrides = (
    items: readonly DescendantOverride[],
  ): DescendantOverride[] =>
    items.map((item) => {
      const address = {
        instances: item.address.instances.map((id) =>
          id.startsWith("project:node:") ? map(id as NodeId) : id,
        ),
        templatePath: item.address.templatePath.map((id) =>
          id.startsWith("project:node:") ? map(id as NodeId) : id,
        ),
      };
      if (item.kind === "replace")
        return { ...item, address, replacementId: map(item.replacementId) };
      if (item.kind === "fillSlot")
        return { ...item, address, childIds: item.childIds.map(map) };
      return { ...item, address };
    });
  // Owned state variables and interactions, from the reverse reference index (no document scan).
  const related: (StateVariableEntry | InteractionEntry)[] = [];
  const seen = new Set<string>();
  for (const nodeId of cloned.keys())
    for (const referrerId of graph.referrersOf(nodeId)) {
      if (seen.has(referrerId)) continue;
      const entry = graph.getEntry(referrerId);
      if (
        (entry?.kind === "stateVariable" || entry?.kind === "interaction") &&
        cloned.has(entry.ownerId as NodeId)
      ) {
        seen.add(referrerId);
        related.push(entry);
      }
    }
  if (related.length && !allocateRelatedId)
    throw new CatalogValidationError(
      "CLONE_RELATED_ID_ALLOCATOR_REQUIRED",
      rootId,
    );
  const relatedIds = new Map<string, string>();
  for (const entry of related) {
    const id = allocateRelatedId!(entry.id);
    if (
      !id.startsWith(`project:${entry.kind}:`) ||
      graph.getEntry(id) ||
      allocated.has(id as NodeId)
    )
      throw new CatalogValidationError("CLONE_ID_COLLISION", id);
    if ([...relatedIds.values()].includes(id))
      throw new CatalogValidationError("CLONE_ID_COLLISION", id);
    relatedIds.set(entry.id, id);
  }
  const relatedEntries = related.map((entry) => {
    if (entry.kind === "stateVariable")
      return {
        ...structuredClone(entry),
        id: relatedIds.get(entry.id) as EntryId<"stateVariable">,
        ownerId: map(entry.ownerId as NodeId),
      };
    const action = structuredClone(entry.action);
    if (
      action.opcode === "setState" &&
      action.variableId.startsWith("project:")
    )
      action.variableId = (relatedIds.get(action.variableId) ??
        action.variableId) as EntryId<"stateVariable">;
    if (action.opcode === "capability") action.targetId = map(action.targetId);
    return {
      ...structuredClone(entry),
      id: relatedIds.get(entry.id) as EntryId<"interaction">,
      ownerId: map(entry.ownerId),
      ...(entry.address
        ? {
            address: {
              instances: entry.address.instances.map((id) =>
                id.startsWith("project:node:") ? map(id as NodeId) : id,
              ),
              templatePath: entry.address.templatePath.map((id) =>
                id.startsWith("project:node:") ? map(id as NodeId) : id,
              ),
            },
          }
        : {}),
      action,
    };
  });
  return {
    rootId: map(rootId),
    entries: ordered.map((entry) => ({
      ...structuredClone(entry),
      id: map(entry.id),
      children: entry.children.map(map),
      descendantOverrides: overrides(entry.descendantOverrides),
      // ADR-256 §1-1: a state owner inside the copy is the copy's (a reference outside stays).
      ...(entry.showWhen
        ? { showWhen: mapShowWhenNodeIds(entry.showWhen, map) }
        : {}),
    })),
    relatedEntries,
  };
}
