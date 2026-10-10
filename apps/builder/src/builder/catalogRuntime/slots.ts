import {
  insertNodes,
  removeTargets,
  setSlotDeclaration,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import {
  assertNestable,
  CommandDraft,
  definitionTypeName,
  listParent,
  overrideAt,
  templateDefinitionId,
} from "../../../../../packages/shared/src/catalog/commands/context";
import { catalogChildKind } from "../../../../../packages/shared/src/catalog/nesting/nestingRules";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  CatalogReader,
  DefinitionId,
  NodeParent,
  EditTarget,
  InstanceAddress,
  NodeEntry,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import { getPaletteItems } from "../panels/components/paletteItems";
import { catalogBuiltinOrigins } from "./layouts";
import { catalogPaletteDefinitionId } from "./paletteInsert";

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

/**
 * The slot position an edit target stands for: a descendant position as is; an instance node whose
 * component's root template node declares a slot (a ListBox · Toolbar · Form … origin — ADR-256
 * F4) stands for that root position, so the instance fills it from its own selection.
 */
export function catalogSlotTarget(
  graph: CatalogReader,
  target: EditTarget,
): Extract<EditTarget, { kind: "descendant" }> | undefined {
  if (target.kind === "descendant") return target;
  if (target.kind !== "node") return undefined;
  const node = graph.getEntry(target.id);
  if (node?.kind !== "node") return undefined;
  const definition = node.definitionId.startsWith("lib:")
    ? graph.library.definitions.get(
        node.definitionId as `lib:definition:${string}`,
      )
    : graph.getEntry(node.definitionId);
  const rootId = (definition as { templateRootId?: string } | undefined)
    ?.templateRootId;
  if (!rootId) return undefined;
  const address = {
    instances: [target.id],
    templatePath: [rootId],
  } as unknown as InstanceAddress;
  return templateNodeAt(graph, address)?.slot
    ? { kind: "descendant", ownerId: target.id, address }
    : undefined;
}

/** An instance's slot position: the declared slot and what fills it. */
export function catalogSlotPosition(
  graph: CatalogReader,
  edit: EditTarget,
): CatalogSlotPosition | undefined {
  const target = catalogSlotTarget(graph, edit);
  if (!target) return undefined;
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

/** One choice of the slot section's insert list. */
export interface CatalogSlotInsertOption {
  readonly definitionId: DefinitionId;
  readonly label: string;
  /** The palette type it was offered for (its creation props), when it is a palette type. */
  readonly type?: string;
}

/** The type name a slot position draws (the template at the address, or the node itself). */
function positionTypeName(
  graph: CatalogReader,
  target: EditTarget,
): string | undefined {
  try {
    if (target.kind === "node") {
      const node = graph.getEntry(target.id);
      return node?.kind === "node"
        ? definitionTypeName(graph, node.definitionId)
        : undefined;
    }
    if (target.kind !== "descendant") return undefined;
    const id =
      target.address.templatePath[target.address.templatePath.length - 1];
    return id
      ? definitionTypeName(graph, templateDefinitionId(graph, id))
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * ADR-256 Decision 4 — what the slot section offers to put in a position, from the one children
 * judgment: a part that takes items (a RAC collection, or a family not converted yet) offers its
 * item types; a part that takes free content offers the built-in origins (Button · Heading · Tab
 * … — the Components page's), the free-content primitives and the project's components. Every
 * choice passes the same nesting check the insert command runs (`assertNestable` at the list
 * position), so what is listed goes in.
 */
/** ADR-256 Phase 9 — the parts a calendar's header takes beside its nav Buttons. */
const CALENDAR_HEADER_PARTS = [
  "CalendarHeading",
  "CalendarMonthPicker",
  "CalendarYearPicker",
] as const;

export function catalogSlotInsertOptions(
  graph: CatalogSlotReader,
  target: EditTarget,
): CatalogSlotInsertOption[] {
  if (target.kind !== "descendant" && target.kind !== "node") return [];
  // A root slot (ADR-256 F4) is filled at its instance's root position.
  if (target.kind === "node") {
    const root = catalogSlotTarget(graph, target);
    if (root) return catalogSlotInsertOptions(graph, root);
  }
  const type = positionTypeName(graph, target);
  if (!type) return [];
  const kind = catalogChildKind(type);
  if (kind.kind === "leaf") return [];
  const library = graph.library;
  const ofType = (itemType: string): CatalogSlotInsertOption | undefined => {
    const definitionId = catalogPaletteDefinitionId(library, itemType);
    return library.definitions.has(definitionId)
      ? { definitionId, label: itemType, type: itemType }
      : undefined;
  };
  const candidates: CatalogSlotInsertOption[] = [];
  if (kind.kind === "items") {
    for (const itemType of kind.items) {
      const option = ofType(itemType);
      if (option) candidates.push(option);
    }
  } else {
    const builtin = catalogBuiltinOrigins(library);
    const origins = new Set<string>(builtin.map((item) => item.id));
    candidates.push(
      ...builtin.map((item) => ({
        definitionId: item.id,
        label: item.name,
        type: item.name,
      })),
    );
    // The palette's primitives (Text · Icon · Image · Separator · Frame …): no origin of their own.
    for (const item of getPaletteItems()) {
      const itemType = item.componentType ?? item.type;
      const option = ofType(itemType);
      if (!option || origins.has(option.definitionId)) continue;
      origins.add(option.definitionId);
      // Named by type like the origins (the palette's labels are lowercase words).
      candidates.push({
        ...option,
        label: itemType === "frame" ? "Frame" : itemType,
      });
    }
    // ADR-256 Phase 9: a calendar header's parts — RAC's heading and its month · year pickers (their
    // owners check keeps them to a position inside a Calendar · RangeCalendar).
    for (const itemType of CALENDAR_HEADER_PARTS) {
      const option = ofType(itemType);
      if (!option || origins.has(option.definitionId)) continue;
      origins.add(option.definitionId);
      candidates.push(option);
    }
    const project = graph.getEntry(graph.projectId);
    const instanceDefinition =
      target.kind === "descendant"
        ? (
            graph.getEntry(target.ownerId) as
              { definitionId?: string } | undefined
          )?.definitionId
        : undefined;
    if (project?.kind === "project")
      for (const id of project.definitionIds) {
        const definition = graph.getEntry(id);
        if (
          definition?.kind === "definition" &&
          definition.usage !== "layout" &&
          id !== instanceDefinition
        )
          candidates.push({ definitionId: id, label: definition.name });
      }
  }
  const parent: NodeParent =
    target.kind === "node"
      ? { kind: "node", id: target.id }
      : {
          kind: "descendant",
          ownerId: target.ownerId,
          address: target.address,
        };
  const draft = new CommandDraft(graph);
  let list: NodeParent;
  try {
    list = listParent(draft, parent);
  } catch {
    return [];
  }
  const allowed = candidates.filter((option) => {
    try {
      assertNestable(draft, list, [option.definitionId]);
      return true;
    } catch {
      return false;
    }
  });
  // A position the insert cannot open at all (a template position whose content is bound to the
  // instance's props — the Card's header · content, ADR-256 F3) lists nothing: one dry run.
  if (allowed.length && target.kind === "descendant") {
    let probe = 0;
    const probeId = ((kind: string) =>
      `project:${kind}:__slot-probe-${(probe += 1)}`) as NewId;
    try {
      catalogSlotCommands.fill(target, allowed[0].definitionId, probeId)(graph);
    } catch {
      return [];
    }
  }
  return allowed;
}
