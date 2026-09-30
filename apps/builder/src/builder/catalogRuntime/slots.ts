import {
  insertNodes,
  removeTargets,
  setSlotDeclaration,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import { overrideAt } from "../../../../../packages/shared/src/catalog/commands/context";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  CatalogReader,
  DefinitionId,
  EditTarget,
  InstanceAddress,
  NodeEntry,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";

/** The graph reads the slot section needs (`CatalogGraph` is one). */
export interface CatalogSlotReader extends CatalogReader {
  ownerOf(id: string): string | undefined;
}

export type CatalogSlot = NonNullable<NodeEntry["slot"]>;

/**
 * A node's slot declaration, when it can declare one: an owned node inside a project definition's
 * template (a component's or a layout's — instances fill it). Other nodes have none to edit.
 */
export function catalogSlotDeclaration(
  graph: CatalogSlotReader,
  nodeId: NodeId,
): { slot?: CatalogSlot } | undefined {
  const node = graph.getEntry(nodeId);
  if (node?.kind !== "node") return undefined;
  for (let id = graph.ownerOf(nodeId); id; id = graph.ownerOf(id)) {
    const owner = graph.getEntry(id);
    if (owner?.kind === "definition")
      return node.slot ? { slot: node.slot } : {};
    if (owner?.kind !== "node") return undefined;
  }
  return undefined;
}

/** The template node at an instance address (a library template or a project template node). */
function templateNodeAt(
  graph: CatalogReader,
  address: InstanceAddress,
): { slot?: CatalogSlot } | undefined {
  const id = address.templatePath[address.templatePath.length - 1];
  if (!id) return undefined;
  if (id.startsWith("lib:"))
    return graph.library.templates.get(id as `lib:template:${string}`);
  const node = graph.getEntry(id);
  return node?.kind === "node" ? node : undefined;
}

export interface CatalogSlotPosition {
  slot: CatalogSlot;
  /** The instance's content for the slot; absent = it shows the template's content. */
  fillIds?: readonly NodeId[];
}

/** An instance's slot position: the declared slot and what fills it. */
export function catalogSlotPosition(
  graph: CatalogReader,
  target: EditTarget,
): CatalogSlotPosition | undefined {
  if (target.kind !== "descendant") return undefined;
  const slot = templateNodeAt(graph, target.address)?.slot;
  if (!slot) return undefined;
  const owner = graph.getEntry(target.ownerId);
  if (owner?.kind !== "node") return undefined;
  const fill = overrideAt(owner, target.address);
  return fill?.kind === "fillSlot"
    ? { slot, fillIds: fill.childIds }
    : { slot };
}

/**
 * ADR-248 Phase 4e-4: the slot section's commands — each one history step. Declaring re-validates
 * the instances that fill the slot; filling appends a new node of a definition to the slot's
 * content; restoring drops the instance's content so the slot shows the template's again.
 */
export const catalogSlotCommands = {
  declare: (id: NodeId, slot: CatalogSlot | undefined): CatalogCommand =>
    setSlotDeclaration({ id, slot, label: slot ? "Edit slot" : "Remove slot" }),
  fill: (
    target: Extract<EditTarget, { kind: "descendant" }>,
    definitionId: DefinitionId,
    newId: NewId,
    props: NodeEntry["props"] = {},
  ): CatalogCommand => {
    const entry: NodeEntry = {
      kind: "node",
      id: newId("node") as NodeId,
      definitionId,
      children: [],
      props,
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    const insert = insertNodes({
      parent: {
        kind: "descendant",
        ownerId: target.ownerId,
        address: target.address,
      },
      entries: [entry],
      rootIds: [entry.id],
      newId,
      label: "Fill slot",
    });
    // The slot position stays selected (more content can follow); the palette selects new nodes.
    return (reader) => ({ label: "Fill slot", ops: insert(reader).ops });
  },
  restore:
    (target: Extract<EditTarget, { kind: "descendant" }>): CatalogCommand =>
    (reader) => {
      const position = catalogSlotPosition(reader, target);
      if (!position?.fillIds) throw new Error("SLOT_NOT_FILLED");
      const remove = position.fillIds.length
        ? removeTargets({
            targets: position.fillIds.map((id) => ({
              kind: "node" as const,
              id,
            })),
          })(reader).ops
        : [];
      return {
        label: "Restore slot content",
        ops: [
          ...remove,
          {
            kind: "removeDescendant",
            id: target.ownerId,
            address: target.address,
          },
        ],
      };
    },
};
