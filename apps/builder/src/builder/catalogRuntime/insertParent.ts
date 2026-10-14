import type {
  CatalogReader,
  EditTarget,
  InstanceAddress,
  NodeEntry,
  NodeId,
  NodeParent,
} from "../../../../../packages/shared/src/catalog/document/types";

/** The template node at an instance address (a library template or a project template node). */
export function catalogTemplateNodeAt(
  graph: CatalogReader,
  address: InstanceAddress,
): { slot?: NodeEntry["slot"] } | undefined {
  const id = address.templatePath[address.templatePath.length - 1];
  if (!id) return undefined;
  if (id.startsWith("lib:"))
    return graph.library.templates.get(id as `lib:template:${string}`);
  const node = graph.getEntry(id);
  return node?.kind === "node" ? node : undefined;
}

/**
 * ADR-261 Decision 1: where a drop · paste · reorder into a drawn element writes — its edit target.
 * An owned node takes children itself (an instance of a project component or layout: its template
 * root's slot only); a template position of an instance takes them only when it declares a slot (they become the instance's `fillSlot` — pen.dev: content goes into slots only,
 * user decision 2). `undefined` = not a place to put nodes (the caller goes on to the parent).
 * Never the template node itself: that wrote an instance's edit into its origin or its layout.
 */
export function catalogInsertParent(
  graph: CatalogReader,
  target: EditTarget,
): NodeParent | undefined {
  if (target.kind === "node") {
    // An instance of a project component or layout shows its template: content goes into the
    // template root's slot when it declares one, never into the instance's own `children`
    // (a layout body's are emptied by `applyLayout`). Library composites keep their own rule.
    const node = graph.getEntry(target.id);
    const definition =
      node?.kind === "node" &&
      node.definitionId.startsWith("project:definition:")
        ? graph.getEntry(node.definitionId)
        : undefined;
    if (definition?.kind !== "definition" || !definition.templateRootId)
      return { kind: "node", id: target.id };
    const address = {
      instances: [target.id],
      templatePath: [definition.templateRootId],
    } as unknown as InstanceAddress;
    return catalogTemplateNodeAt(graph, address)?.slot
      ? { kind: "descendant", ownerId: target.id, address }
      : undefined;
  }
  return catalogTemplateNodeAt(graph, target.address)?.slot
    ? { kind: "descendant", ownerId: target.ownerId, address: target.address }
    : undefined;
}

/**
 * ADR-261 Decision 1: where an owned node lives in the document — the parent a paste after it or a
 * reorder writes to: its owner node's `children`, or the instance slot (`fillSlot`) holding it.
 * `undefined` = not movable (a template root, a replacement). Read from the document, not from the
 * drawn parent record: that record may be a template position projected from the origin.
 */
export function catalogParentOfNode(
  graph: CatalogReader,
  id: NodeId,
): NodeParent | undefined {
  const ownerId = graph.ownerOf(id);
  const owner = ownerId ? graph.getEntry(ownerId) : undefined;
  if (owner?.kind === "page") return { kind: "page", id: owner.id };
  if (owner?.kind !== "node") return undefined;
  if (owner.children.includes(id)) return { kind: "node", id: owner.id };
  for (const override of owner.descendantOverrides)
    if (override.kind === "fillSlot" && override.childIds.includes(id))
      return {
        kind: "descendant",
        ownerId: owner.id,
        address: override.address,
      };
  return undefined;
}
