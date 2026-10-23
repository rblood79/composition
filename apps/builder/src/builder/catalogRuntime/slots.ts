import {
  COLLECTION_FAMILIES,
  GROUP_ITEM_TYPES,
  insertNodes,
  removeTargets,
  setSlotDeclaration,
} from "../../../../../packages/shared/src/catalog/commands";
import {
  stageOver,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import {
  assertNestable,
  CommandDraft,
  definitionTypeName,
  listParent,
  overrideAt,
  templateDefinitionId,
} from "../../../../../packages/shared/src/catalog/commands/context";
import {
  CATALOG_EMPTY_STATE_COLLECTIONS,
  CATALOG_EMPTY_STATE_TYPE,
  catalogChildKind,
} from "../../../../../packages/shared/src/catalog/nesting/nestingRules";
import {
  ownSlotContents,
  type NewId,
} from "../../../../../packages/shared/src/catalog/commands/materialize";
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
import { catalogTemplateNodeAt as templateNodeAt } from "./insertParent";

/** The graph reads the slot section needs (`CatalogGraph` is one). */
export interface CatalogSlotReader extends CatalogReader {
  ownerOf(id: string): string | undefined;
}

export type CatalogSlot = NonNullable<NodeEntry["slot"]>;

/**
 * A node's slot declaration, when it can declare one: an owned node inside a project definition's
 * template (a component's or a layout's — instances fill it), or inside a component's origin in
 * place (ADR-260). Other nodes have none to edit.
 */
export function catalogSlotDeclaration(
  graph: CatalogSlotReader,
  nodeId: NodeId,
): { slot?: CatalogSlot } | undefined {
  const node = graph.getEntry(nodeId);
  if (node?.kind !== "node") return undefined;
  // One walk up the owners (ADR-246 — a selection reads it): a template's node declares slots.
  for (let id: string = nodeId; ;) {
    const ownerId = graph.ownerOf(id);
    const owner = ownerId ? graph.getEntry(ownerId) : undefined;
    if (owner?.kind === "definition")
      return node.slot ? { slot: node.slot } : {};
    if (owner?.kind !== "node") return undefined;
    id = owner.id;
  }
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
  /**
   * ADR-256 Decision 4: put a new node of a definition at the end of a position that declares no
   * slot (its children kind takes it) — an instance's inner part or an owned node.
   */
  insert: (
    target: Extract<EditTarget, { kind: "descendant" | "node" }>,
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
    return insertNodes({
      parent:
        target.kind === "node"
          ? { kind: "node", id: target.id }
          : {
              kind: "descendant",
              ownerId: target.ownerId,
              address: target.address,
            },
      entries: [entry],
      rootIds: [entry.id],
      newId,
      label: "Add content",
    });
  },
  /**
   * The slot's content as the instance was placed with: its fill and the position's override go,
   * then a library origin's slot holds the template's default content again as the instance's own
   * nodes — as placing it does (`ownSlotContents`, user decision 2026-10-14). A project component's
   * slot shows its template's content (placing does not own it).
   */
  restore:
    (
      target: Extract<EditTarget, { kind: "descendant" }>,
      newId: NewId,
    ): CatalogCommand =>
    (reader) => {
      const position = catalogSlotPosition(reader, target);
      if (!position?.fillIds) throw new Error("SLOT_NOT_FILLED");
      const stage = stageOver(reader);
      const ops = [
        ...(position.fillIds.length
          ? removeTargets({
              targets: position.fillIds.map((id) => ({
                kind: "node" as const,
                id,
              })),
            })(stage).ops
          : []),
        {
          kind: "removeDescendant" as const,
          id: target.ownerId,
          address: target.address,
        },
      ];
      stage.apply(ops);
      const draft = new CommandDraft(stage);
      ownSlotContents(draft, [target.ownerId], newId);
      return { label: "Restore slot content", ops: [...ops, ...draft.ops()] };
    },
};

/**
 * The item origin a collection family's own origin uses for an item type (a ListBox origin's items
 * are ListBoxItem/Default instances) — for a position with no template item to read (a new
 * ListBoxSection, 2026-10-22 user report). Searched down the owner origin's template, else the
 * Library origin drawn by that type (a ListBoxSection origin — its header and items, user 「섹션도
 * 원본 instance · header 포함」); a state variant (`--hover`) is never the default.
 */
function familyItemOrigin(
  graph: CatalogReader,
  itemType: string,
): DefinitionId | undefined {
  const library = graph.library;
  const typeOf = (definitionId: string) => {
    try {
      return definitionTypeName(graph, definitionId as DefinitionId);
    } catch {
      return undefined;
    }
  };
  for (const family of COLLECTION_FAMILIES) {
    if (family.item !== itemType && family.section !== itemType) continue;
    const owner = library.definitions.get(
      catalogPaletteDefinitionId(library, family.owner),
    ) as { templateRootId?: string } | undefined;
    const queue = owner?.templateRootId ? [owner.templateRootId] : [];
    for (let at = 0; at < queue.length && at < 64; at += 1) {
      const template = library.templates.get(
        queue[at] as `lib:template:${string}`,
      );
      if (!template) continue;
      if (
        at > 0 &&
        template.definitionId.startsWith("lib:definition:origin-") &&
        typeOf(template.definitionId) === itemType
      )
        return template.definitionId as DefinitionId;
      queue.push(...template.children);
    }
  }
  if (
    !COLLECTION_FAMILIES.some(
      (family) => family.item === itemType || family.section === itemType,
    )
  )
    return undefined;
  for (const definition of library.definitions.values()) {
    const id = (definition as { id: string }).id;
    if (!id.startsWith("lib:definition:origin-") || id.includes("--")) continue;
    const root = (definition as { templateRootId?: string }).templateRootId;
    const template = root
      ? library.templates.get(root as `lib:template:${string}`)
      : undefined;
    if (template && typeOf(template.definitionId) === itemType)
      return id as DefinitionId;
  }
  return undefined;
}

/**
 * The item origin a position's template holds for an item type (a ListBox's Items hold
 * ListBoxItem/Default instances), else the one its collection family's origin uses: a new item
 * there is an instance of it, as the items it was placed with are — the palette's id for an item
 * type is the bare type (2026-10-22 user 「instance 객체가 아니다」). A root slot is read at its
 * instance's root position.
 */
export function catalogTemplateItemDefinition(
  graph: CatalogReader,
  target: EditTarget,
  itemType: string,
): DefinitionId | undefined {
  const at = catalogSlotTarget(graph, target);
  const node = at
    ? (templateNodeAt(graph, at.address) as
        { children?: readonly string[] } | undefined)
    : undefined;
  for (const childId of node?.children ?? []) {
    const template = childId.startsWith("lib:")
      ? graph.library.templates.get(childId as `lib:template:${string}`)
      : undefined;
    if (!template) continue;
    const definitionId = template.definitionId as DefinitionId;
    try {
      if (definitionTypeName(graph, definitionId) === itemType)
        return definitionId;
    } catch {
      // (A dangling template reference offers nothing.)
    }
  }
  return familyItemOrigin(graph, itemType);
}

/** One choice of the slot section's insert list. */
export interface CatalogSlotInsertOption {
  readonly definitionId: DefinitionId;
  readonly label: string;
  /** The palette type it was offered for (its creation props), when it is a palette type. */
  readonly type?: string;
  /** ADR-261 Decision 3: the slot's origin suggests it (listed first — a hint, not a limit). */
  readonly suggested?: true;
  /** A project component (the Local page's) — the list groups it apart from the Library's. */
  readonly local?: true;
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

/**
 * ADR-256 Phase 9 — the parts with no slot whose own parts the palette doesn't offer (a calendar
 * header's heading · month · year pickers): the slot section lists what goes in. Any other part
 * with no slot takes content from the palette — the list is not computed per selection (ADR-246
 * select counts).
 */
export const CATALOG_PART_INSERT_HOSTS: ReadonlySet<string> = new Set([
  "CalendarHeader",
]);

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
  const project = graph.getEntry(graph.projectId);
  const instanceDefinition =
    target.kind === "descendant"
      ? (
          graph.getEntry(target.ownerId) as
            { definitionId?: string } | undefined
        )?.definitionId
      : undefined;
  // The project's components (not a layout, not the instance's own): a free-content position
  // offers them all; a collection position offers them too — the nesting check below keeps the
  // ones whose root is an item (ADR-278: a MenuItem-rooted component for a Menu's `Items`;
  // before, the items branch listed the Library's item types only — review h2).
  const projectComponents = (): CatalogSlotInsertOption[] =>
    project?.kind === "project"
      ? project.definitionIds.flatMap((id) => {
          const definition = graph.getEntry(id);
          return definition?.kind === "definition" &&
            definition.usage !== "layout" &&
            id !== instanceDefinition
            ? [
                {
                  definitionId: id,
                  label: definition.name,
                  local: true as const,
                },
              ]
            : [];
        })
      : [];
  // A group's slot (ButtonGroup · AvatarGroup · Nav …) takes its items, like a collection's: the
  // children judgment calls a group free content (its nesting stays open), but the list offers
  // what the group's "+" adds, not the ~70 Library origins (2026-10-22 user report).
  const itemTypes = kind.kind === "items" ? kind.items : GROUP_ITEM_TYPES[type];
  if (itemTypes) {
    for (const itemType of itemTypes) {
      const origin = catalogTemplateItemDefinition(graph, target, itemType);
      const option = origin
        ? { definitionId: origin, label: itemType, type: itemType }
        : ofType(itemType);
      if (option) candidates.push(option);
    }
    // Its empty state (RAC `renderEmptyState`, 2026-10-23): an IllustratedMessage beside the items.
    if (CATALOG_EMPTY_STATE_COLLECTIONS.has(type)) {
      const option = ofType(CATALOG_EMPTY_STATE_TYPE);
      if (option) candidates.push(option);
    }
    // (A collection's nesting check keeps only item-rooted components; a group's nesting is open,
    // so its list keeps the components drawn by one of its item types here.)
    candidates.push(
      ...projectComponents().filter((option) => {
        if (kind.kind === "items") return true;
        try {
          return itemTypes.includes(
            definitionTypeName(graph, option.definitionId),
          );
        } catch {
          return false;
        }
      }),
    );
  } else {
    const origins = new Set<string>();
    // ADR-256 Phase 9: a calendar header's parts — RAC's heading and its month · year pickers (their
    // owners check keeps them to a position inside a Calendar · RangeCalendar). Listed first: where
    // they fit they are the position's own parts, not one of the 70 general choices below.
    for (const itemType of CALENDAR_HEADER_PARTS) {
      const option = ofType(itemType);
      if (!option || origins.has(option.definitionId)) continue;
      origins.add(option.definitionId);
      candidates.push(option);
    }
    for (const item of catalogBuiltinOrigins(library)) {
      if (origins.has(item.id)) continue;
      origins.add(item.id);
      candidates.push({
        definitionId: item.id,
        label: item.name,
        type: item.name,
      });
    }
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
    candidates.push(...projectComponents());
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
  // ADR-261 Decision 3: the origin's suggested components first (pen.dev — the instance's slot
  // shows them on top; everything else stays available).
  const suggested =
    target.kind === "descendant"
      ? (templateNodeAt(graph, target.address)?.slot?.suggested ?? [])
      : [];
  if (!suggested.length) return allowed;
  const rank = new Map(suggested.map((id, index) => [id as string, index]));
  return [
    ...allowed
      .filter((option) => rank.has(option.definitionId))
      .sort((a, b) => rank.get(a.definitionId)! - rank.get(b.definitionId)!)
      .map((option) => ({ ...option, suggested: true as const })),
    ...allowed.filter((option) => !rank.has(option.definitionId)),
  ];
}

/**
 * ADR-261 Decision 3: what a project component's slot can suggest — the project's components
 * (not layouts, not the one the slot belongs to: filling with it would nest it in itself) and the
 * built-in origins. Library slots keep the code's (user 2026-10-14) — the section asks only for a
 * slot it can declare.
 */
export function catalogSlotSuggestionChoices(
  graph: CatalogSlotReader,
  nodeId: NodeId,
): { definitionId: DefinitionId; label: string }[] {
  const own = new Set<string>();
  for (let id: string | undefined = nodeId; id; id = graph.ownerOf(id)) {
    const definitionId = graph.definitionOfTemplateRoot(id);
    if (definitionId) own.add(definitionId);
    const entry = graph.getEntry(id);
    if (entry?.kind === "definition") own.add(entry.id);
  }
  const choices: { definitionId: DefinitionId; label: string }[] = [];
  const project = graph.getEntry(graph.projectId);
  if (project?.kind === "project")
    for (const id of project.definitionIds) {
      const definition = graph.getEntry(id);
      if (
        definition?.kind === "definition" &&
        definition.usage !== "layout" &&
        !own.has(id)
      )
        choices.push({ definitionId: id, label: definition.name });
    }
  for (const item of catalogBuiltinOrigins(graph.library))
    choices.push({ definitionId: item.id as DefinitionId, label: item.name });
  return choices;
}
