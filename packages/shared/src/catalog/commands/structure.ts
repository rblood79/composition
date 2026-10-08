import { cloneNodeSubgraph } from "../document/clone";
import { ownedChildren, referencedIds } from "../document/graph";
import {
  catalogShowWhenRefs,
  catalogStateKeysOf,
} from "../document/stateOwnerRefs";
import type {
  CatalogEntry,
  CatalogReader,
  DefinitionId,
  EntryId,
  InteractionEntry,
  NodeEntry,
  NodeId,
  NodePlacement,
  StateVariableEntry,
} from "../document/types";
import type { CatalogCommand } from "./compose";
import { CatalogStage } from "../transactions/transaction";
import { OWNER_DRAWN_PART_OWNERS } from "../resolvers/resolveDelegatedChildFontSize";
import {
  assertNestable,
  assertNestableUnder,
  childList,
  CommandDraft,
  definitionTypeName,
  fail,
  isWithin,
  locate,
  parentAncestorTypes,
  templateDefinitionId,
  overrideAt,
  sameAddress,
  setChildList,
  topLevel,
  type EditTarget,
  type NodeParent,
} from "./context";
import { ensureChildList, type NewId } from "./materialize";
import {
  tableAlignedIn,
  tableColumnCells,
  tableColumnOrder,
} from "./collections";
import {
  RAC_REQUIRED_PART_TYPES,
  RAC_REQUIRED_PARTS,
  requiredPartOwner,
} from "../nesting/requiredParts";

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
    assertTablesAligned(
      draft,
      input.parent.kind === "node"
        ? [input.parent.id]
        : input.parent.kind === "descendant"
          ? [input.parent.ownerId]
          : [],
    );
    // (Only entries that carry a condition can be unlinked by being placed.)
    if (input.entries.some((entry) => entry.showWhen))
      assertStateOwnersLinked(draft, input.rootIds);
    return {
      label: input.label ?? "Insert",
      ops: draft.ops(),
      selectAfter: input.rootIds,
    };
  };

/**
 * ADR-256 Decision 5 — refuse a command that takes a part RAC needs away from its owner. Judged on
 * the command's result: every owner above a node the command takes away (deleted, moved, released by
 * an ungroup) still holds a part of each kind it held before — in its own subtree, not under a nearer
 * owner of that kind. So a twin beside the part, a move inside the owner, wrapping or unwrapping it
 * stay allowed; deleting it (or every twin at once, or a wrapper around it), moving it to another
 * owner, or ungrouping the part itself are refused. Call after the command's writes.
 */
const carriedAnswers = new WeakMap<
  CatalogReader,
  { revision: number; answers: Map<NodeId, boolean> }
>();
function carriedMemo(reader: CatalogReader): Map<NodeId, boolean> {
  let memo = carriedAnswers.get(reader);
  if (!memo || memo.revision !== reader.revision) {
    memo = { revision: reader.revision, answers: new Map() };
    carriedAnswers.set(reader, memo);
  }
  return memo.answers;
}

function assertRequiredPartsKept(
  draft: CommandDraft,
  touched: readonly NodeId[],
): void {
  const reader = draft.reader;
  const typeOf = (definitionId: DefinitionId) =>
    definitionTypeName(reader, definitionId);
  // Types first (the canvas menu plans a delete on every selection, several times — ADR-246
  // counts): a node the command takes away can cost an owner a part only if it is one or holds
  // one. An owner inside it goes along with its own parts. The answer is the revision's (read
  // before the writes), remembered per revision; a composed command's stage changes within one.
  const carriesPart = (id: NodeId) => {
    const memo =
      reader instanceof CatalogStage ? undefined : carriedMemo(reader);
    const known = memo?.get(id);
    if (known !== undefined) return known;
    let found = false;
    const stack: NodeId[] = [id];
    while (stack.length && !found) {
      const entry = reader.getEntry(stack.pop()!);
      if (entry?.kind !== "node") continue;
      const type = typeOf(entry.definitionId);
      if (RAC_REQUIRED_PART_TYPES.has(type)) found = true;
      else if (!(type in RAC_REQUIRED_PARTS))
        stack.push(...ownedChildren(entry));
    }
    memo?.set(id, found);
    return found;
  };
  if (!touched.some(carriesPart)) return;
  const owners = new Set<NodeId>();
  for (const id of touched)
    for (
      let cursor = reader.ownerOf(id);
      cursor;
      cursor = reader.ownerOf(cursor)
    ) {
      const entry = reader.getEntry(cursor);
      if (entry?.kind !== "node") break;
      if (typeOf(entry.definitionId) in RAC_REQUIRED_PARTS)
        owners.add(entry.id);
    }
  const before = (id: string) => reader.getEntry(id);
  const after = (id: string) => draft.read(id);
  for (const ownerId of owners) {
    const owner = draft.read(ownerId);
    // The owner goes too (a whole Slider deleted): nothing is left without its part.
    if (owner?.kind !== "node") continue;
    const type = typeOf(owner.definitionId);
    for (const kinds of RAC_REQUIRED_PARTS[type] ?? [])
      if (
        !holdsPart(reader, after, ownerId, kinds, typeOf) &&
        holdsPart(reader, before, ownerId, kinds, typeOf)
      )
        fail("REQUIRED_PART_NOT_REMOVABLE", `${type}>${kinds.join("|")}`);
  }
}

/** RAC Table parts a command can misalign (G0 ⑨ — a row's cells against the header's columns). */
const TABLE_PART_TYPES: ReadonlySet<string> = new Set([
  "Table",
  "TableHeader",
  "TableBody",
  "Column",
  "Row",
  "Cell",
]);

/**
 * A node's type in the revision a command reads (before its writes), remembered per revision: the
 * canvas menu plans a delete on every selection, several times (ADR-246 counts) — the table checks
 * read each id's type once. Empty for an id the revision does not hold (a new node).
 */
const typeAnswers = new WeakMap<
  CatalogReader,
  { revision: number; answers: Map<string, string> }
>();
function revisionType(reader: CatalogReader, id: string): string {
  let memo =
    reader instanceof CatalogStage ? undefined : typeAnswers.get(reader);
  if (
    !(reader instanceof CatalogStage) &&
    (!memo || memo.revision !== reader.revision)
  ) {
    memo = { revision: reader.revision, answers: new Map() };
    typeAnswers.set(reader, memo);
  }
  const known = memo?.answers.get(id);
  if (known !== undefined) return known;
  const entry = reader.getEntry(id);
  const type =
    entry?.kind === "node"
      ? definitionTypeName(reader, entry.definitionId)
      : "";
  memo?.answers.set(id, type);
  return type;
}

/**
 * Whether the revision holds a RAC Table at all (an owned `Table`, or an instance of the palette's
 * Table origin) — a document without one skips the table checks without reading a node.
 */
const TABLE_DEFINITIONS = [
  "lib:definition:type-Table",
  "lib:definition:origin-component-table",
] as const;
const tableAnswers = new WeakMap<
  CatalogReader,
  { revision: number; has: boolean }
>();
function holdsRacTable(reader: CatalogReader): boolean {
  const known = tableAnswers.get(reader);
  if (known && known.revision === reader.revision) return known.has;
  const has = TABLE_DEFINITIONS.some(
    (definitionId) => reader.instancesOf(definitionId).size > 0,
  );
  if (!(reader instanceof CatalogStage))
    tableAnswers.set(reader, { revision: reader.revision, has });
  return has;
}

/**
 * ADR-256 Phase 5i-3 — refuse a command whose result leaves a RAC Table with a row whose cell count
 * differs from its column count (RAC throws — G0 ⑨) when the table was aligned before. `near`: the
 * nodes the command took away, moved or released, and the parents it placed under — their Table
 * ancestors are judged. A command that touches no table part pays one type read per id.
 */
export function assertTablesAligned(
  draft: CommandDraft,
  near: readonly string[],
): void {
  const reader = draft.reader;
  // (A Table the command adds is not one the revision held — its rows are its own, built aligned.)
  if (!holdsRacTable(reader)) return;
  const tables = new Set<NodeId>();
  for (const id of near) {
    if (!TABLE_PART_TYPES.has(revisionType(reader, id))) continue;
    for (
      let cursor: string | undefined = id;
      cursor;
      cursor = reader.ownerOf(cursor) ?? undefined
    ) {
      const type = revisionType(reader, cursor);
      if (type === "Table") tables.add(cursor as NodeId);
      if (!TABLE_PART_TYPES.has(type)) break;
    }
  }
  for (const tableId of tables) {
    if (tableAlignedIn(draft, tableId) !== false) continue;
    if (tableAlignedIn(new CommandDraft(reader), tableId) === false) continue;
    fail("TABLE_CELLS_NOT_ALIGNED", tableId);
  }
}

/**
 * The cells the RAC Table columns among `targets` take along (deleted or hidden with them — G0 ⑨),
 * not already targets. A command without a Column pays one type read per owned target.
 */
function tableColumnCellTargets(
  reader: CatalogReader,
  draft: CommandDraft,
  targets: readonly EditTarget[],
): EditTarget[] {
  if (!holdsRacTable(reader)) return [];
  const key = (target: EditTarget) =>
    target.kind === "node"
      ? target.id
      : `${target.ownerId}|${target.address.instances.join(",")}|${target.address.templatePath.join(",")}`;
  const taken = new Set(targets.map(key));
  const cells: EditTarget[] = [];
  for (const target of targets) {
    if (target.kind === "node" && revisionType(reader, target.id) !== "Column")
      continue;
    for (const cell of tableColumnCells(draft, target)) {
      if (cell.kind === "page" || taken.has(key(cell))) continue;
      taken.add(key(cell));
      cells.push(cell);
    }
  }
  return cells;
}

/**
 * ADR-256 Phase 5 Round 12 — the targets of a hiding edit (`enabled` · responsive `visibility`) in
 * a RAC Table: a column's cells are hidden and shown with it, and an edit that leaves a row with
 * a cell count other than the column count at some breakpoint is refused (RAC throws — G0 ⑨).
 */
export function tableHidingTargets(
  reader: CatalogReader,
  targets: readonly EditTarget[],
  field: "enabled" | "visibility",
  value: NodeEntry["enabled"] | NodeEntry["visibility"],
): readonly EditTarget[] {
  if (!holdsRacTable(reader)) return targets;
  const draft = new CommandDraft(reader);
  const all = [...targets, ...tableColumnCellTargets(reader, draft, targets)];
  for (const target of all) {
    if (target.kind === "node") {
      const { [field]: _old, ...rest } = draft.node(target.id);
      draft.write(
        value === undefined ? (rest as NodeEntry) : { ...rest, [field]: value },
      );
      continue;
    }
    const owner = draft.node(target.ownerId);
    const current = overrideAt(owner, target.address);
    const patch =
      current?.kind === "patch"
        ? current
        : { kind: "patch" as const, address: target.address };
    const { [field]: _old, ...rest } = patch;
    draft.write({
      ...owner,
      descendantOverrides: [
        ...owner.descendantOverrides.filter(
          (item) => !sameAddress(item.address, target.address),
        ),
        value === undefined ? rest : { ...rest, [field]: value },
      ] as NodeEntry["descendantOverrides"],
    });
  }
  assertTablesAligned(
    draft,
    all.map((target) => (target.kind === "node" ? target.id : target.ownerId)),
  );
  return all;
}

/**
 * ADR-256 Decision 7 · breakdown §1-1 — refuse a command that unlinks a stored state owner: after
 * the command's writes, every `showWhen` reference by address (`{ ancestor: nodeId | address }`) in
 * the nodes the command placed, moved or released must still name an ancestor that gives the key
 * (an instance's address: the instance holds the node). A reference by type or the nearest owner
 * is never refused. Call after the command's writes.
 */
export function assertStateOwnersLinked(
  draft: CommandDraft,
  touched: readonly NodeId[],
): void {
  const reader = draft.reader;
  /** Whether `nodeId` is in the subtrees of `ids` (owned children, fill-slot children). */
  const within = (ids: readonly string[], nodeId: string): boolean => {
    const stack = [...ids];
    while (stack.length) {
      const id = stack.pop()!;
      if (id === nodeId) return true;
      const entry = draft.read(id);
      if (entry?.kind === "node") stack.push(...ownedChildren(entry));
    }
    return false;
  };
  const holds = (ownerId: string, nodeId: string): boolean => {
    const owner = draft.read(ownerId);
    return owner?.kind === "node" && within(ownedChildren(owner), nodeId);
  };
  /** A template's subtree positions (root first), or none. */
  const templateIds = (rootId: string): Set<string> => {
    const ids = new Set<string>();
    const stack = [rootId];
    while (stack.length) {
      const id = stack.pop()!;
      if (ids.has(id)) continue;
      ids.add(id);
      stack.push(...templateChildren(reader, id));
    }
    return ids;
  };
  /**
   * The type at an instance address's target, if the address exists: each nested instance step is
   * a position of the previous definition's template, and the path is root-to-target in the last.
   */
  const addressTarget = (
    instance: NodeEntry,
    address: { instances: readonly string[]; templatePath: readonly string[] },
  ): string | undefined => {
    let definitionId: DefinitionId = instance.definitionId;
    for (const step of address.instances.slice(1)) {
      const rootId = definitionTemplateRoot(reader, definitionId);
      if (!rootId || !templateIds(rootId).has(step)) return undefined;
      definitionId = templateDefinitionId(reader, step);
    }
    const rootId = definitionTemplateRoot(reader, definitionId);
    const path = address.templatePath;
    if (!rootId || path[0] !== rootId) return undefined;
    for (let index = 1; index < path.length; index += 1)
      if (!templateChildren(reader, path[index - 1]!).includes(path[index]!))
        return undefined;
    return definitionTypeName(
      reader,
      templateDefinitionId(reader, path[path.length - 1]!),
    );
  };
  /**
   * Whether a node stands under an instance's template position: it is in a slot the instance
   * fills (at the same nested step) at or below that position.
   */
  const underPosition = (
    instance: NodeEntry,
    address: { instances: readonly string[]; templatePath: readonly string[] },
    nodeId: string,
  ): boolean =>
    instance.descendantOverrides.some(
      (item) =>
        item.kind === "fillSlot" &&
        item.address.instances.length === address.instances.length &&
        item.address.instances.every(
          (id, at) => id === address.instances[at],
        ) &&
        address.templatePath.every(
          (id, at) => item.address.templatePath[at] === id,
        ) &&
        within(item.childIds, nodeId),
    );
  /** `node`'s references, judged as standing at `holder` (itself, or the instance showing it). */
  const check = (
    node: NodeEntry,
    holder: NodeId,
    inside?: ReadonlySet<string>,
  ) => {
    for (const { key, from } of catalogShowWhenRefs(node.showWhen!)) {
      if (!from || !("ancestor" in from) || "local" in from.ancestor) continue;
      const ancestor = from.ancestor;
      // (A template's reference to a position of its own templates follows its instance.)
      if ("nodeId" in ancestor && inside?.has(ancestor.nodeId)) continue;
      const ownerId =
        "nodeId" in ancestor ? ancestor.nodeId : ancestor.address.instances[0]!;
      const owner = draft.read(ownerId);
      let linked = owner?.kind === "node" && holds(ownerId, holder);
      if (linked && "address" in ancestor) {
        const type = addressTarget(owner as NodeEntry, ancestor.address);
        linked =
          !!type &&
          catalogStateKeysOf(type).includes(key) &&
          underPosition(owner as NodeEntry, ancestor.address, holder);
      } else if (linked)
        linked = catalogStateKeysOf(
          definitionTypeName(reader, (owner as NodeEntry).definitionId),
        ).includes(key);
      if (!linked) fail("STATE_OWNER_UNLINKED", `${node.id}>${key}`);
    }
  };
  /**
   * A project component's template nodes (and the templates of project components nested in it)
   * reading an owner outside them: judged at `instance`.
   */
  const checkTemplate = (instance: NodeEntry) => {
    const template = new Set<string>();
    const nodes: NodeEntry[] = [];
    const seen = new Set<string>();
    const collect = (definitionId: DefinitionId) => {
      if (definitionId.startsWith("lib:") || seen.has(definitionId)) return;
      seen.add(definitionId);
      const rootId = definitionTemplateRoot(reader, definitionId);
      if (!rootId) return;
      const stack = [rootId];
      while (stack.length) {
        const entry = draft.read(stack.pop()!);
        if (entry?.kind !== "node" || template.has(entry.id)) continue;
        template.add(entry.id);
        nodes.push(entry);
        collect(entry.definitionId);
        stack.push(...ownedChildren(entry));
      }
    };
    collect(instance.definitionId);
    for (const node of nodes)
      if (node.showWhen) check(node, instance.id, template);
  };
  const stack = [...touched];
  while (stack.length) {
    const entry = draft.read(stack.pop()!);
    if (entry?.kind !== "node") continue;
    if (entry.showWhen) check(entry, entry.id);
    checkTemplate(entry);
    stack.push(...ownedChildren(entry));
  }
}

/** Whether the owner holds a node of one of `kinds` (not under a nearer owner of that kind). */
function holdsPart(
  reader: CatalogReader,
  read: (id: string) => CatalogEntry | undefined,
  ownerId: NodeId,
  kinds: readonly string[],
  typeOf: (definitionId: DefinitionId) => string,
): boolean {
  const owner = read(ownerId);
  if (owner?.kind !== "node") return false;
  // A nearer owner of the same kind keeps what it holds.
  const nearer = (type: string) =>
    RAC_REQUIRED_PARTS[type]?.some((alternatives) =>
      alternatives.some((kind) => kinds.includes(kind)),
    ) ?? false;
  // Its own nodes (children, fill-slot children, replacements) …
  const stack = ownedChildren(owner);
  while (stack.length) {
    const entry = read(stack.pop()!);
    if (entry?.kind !== "node") continue;
    const type = typeOf(entry.definitionId);
    if (kinds.includes(type)) return true;
    if (!nearer(type)) stack.push(...ownedChildren(entry));
  }
  // … and, for an instance, the template positions it still shows (not hidden, not replaced).
  const rootId = definitionTemplateRoot(reader, owner.definitionId);
  if (!rootId) return false;
  const gone = owner.descendantOverrides
    .filter(
      (item) =>
        item.address.instances.length === 1 &&
        (item.kind === "replace" ||
          (item.kind === "patch" && item.enabled === false)),
    )
    .map((item) => item.address.templatePath.join("\n"));
  const positions: string[][] = templateChildren(reader, rootId).map(
    (child) => [rootId, child],
  );
  while (positions.length) {
    const path = positions.pop()!;
    const key = path.join("\n");
    if (gone.some((hidden) => key === hidden || key.startsWith(`${hidden}\n`)))
      continue;
    const id = path[path.length - 1]!;
    const type = definitionTypeName(reader, templateDefinitionId(reader, id));
    if (kinds.includes(type)) return true;
    if (!nearer(type))
      positions.push(
        ...templateChildren(reader, id).map((child) => [...path, child]),
      );
  }
  return false;
}

/** A composite definition's template root (library or project), if any. */
function definitionTemplateRoot(
  reader: CatalogReader,
  definitionId: DefinitionId,
): string | undefined {
  const definition = definitionId.startsWith("lib:")
    ? reader.library.definitions.get(definitionId as `lib:definition:${string}`)
    : reader.getEntry(definitionId);
  if (!definition || ("kind" in definition && definition.kind !== "definition"))
    return undefined;
  const { mode, templateRootId } = definition as {
    mode?: string;
    templateRootId?: string;
  };
  return mode === "composite" ? templateRootId : undefined;
}

/** A template position's children: a library template node's, or a project template node's own. */
function templateChildren(reader: CatalogReader, id: string): string[] {
  if (id.startsWith("lib:"))
    return [
      ...(reader.library.templates.get(id as `lib:template:${string}`)
        ?.children ?? []),
    ];
  const entry = reader.getEntry(id);
  return entry?.kind === "node" ? ownedChildren(entry) : [];
}

/**
 * ADR-256 Decision 5 for an instance's template position: hiding it takes away every part in its
 * template subtree. Refused when one of them is a part whose nearest owner sits above the position.
 */
function assertTemplatePartsKept(
  draft: CommandDraft,
  target: Extract<EditTarget, { kind: "descendant" }>,
  templateId: string,
): void {
  const reader = draft.reader;
  const typeOfTemplate = (id: string) =>
    definitionTypeName(reader, templateDefinitionId(reader, id));
  const carried: { type: string; inner: string[] }[] = [];
  const walk = (id: string, inner: string[]) => {
    const type = typeOfTemplate(id);
    if (RAC_REQUIRED_PART_TYPES.has(type)) carried.push({ type, inner });
    for (const child of templateChildren(reader, id))
      walk(child, [type, ...inner]);
  };
  walk(templateId, []);
  if (!carried.length) return;
  const above = parentAncestorTypes(draft, {
    kind: "descendant",
    ownerId: target.ownerId,
    address: {
      ...target.address,
      templatePath: target.address.templatePath.slice(0, -1),
    },
  });
  for (const part of carried) {
    if (requiredPartOwner(part.type, part.inner)) continue;
    const owner = requiredPartOwner(part.type, above);
    if (owner) fail("REQUIRED_PART_NOT_REMOVABLE", `${owner}>${part.type}`);
  }
}

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
    // ADR-256 Phase 5i-3: a RAC Table column moved within its header takes its cells along.
    const columnOrders = roots.flatMap((id) => {
      const order =
        holdsRacTable(reader) && revisionType(reader, id) === "Column"
          ? tableColumnOrder(draft, id)
          : undefined;
      return order ? [order] : [];
    });
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
    for (const order of columnOrders) order.follow();
    assertRequiredPartsKept(draft, roots);
    assertTablesAligned(draft, [
      ...roots,
      ...(input.parent.kind === "node"
        ? [input.parent.id]
        : input.parent.kind === "descendant"
          ? [input.parent.ownerId]
          : []),
    ]);
    // (A reorder among the same siblings keeps every ancestor: nothing to unlink. Another slot of
    // the same instance is another parent.)
    assertStateOwnersLinked(
      draft,
      input.parent.kind === "descendant"
        ? roots
        : roots.filter(
            (id) =>
              owners.get(id) !==
              (input.parent as Exclude<NodeParent, { kind: "descendant" }>).id,
          ),
    );
    return {
      label: input.label ?? "Move",
      ops: draft.ops(),
      selectAfter: roots,
    };
  };

/** Owned subtree of a node (children, fill-slot children and replacements), node first. */
export function subtree(draft: CommandDraft, id: NodeId): NodeId[] {
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
export function removeWithReferrers(
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
    // ADR-256 Phase 5i-3: a RAC Table column takes its cell in every aligned row along (G0 ⑨ —
    // one transaction, as a new column gives every row a cell). A reusable row's template cell is
    // hidden there, as a deleted template position is (Round 12).
    const targets = [
      ...input.targets,
      ...tableColumnCellTargets(reader, draft, input.targets),
    ];
    const picked = targets.flatMap((target) =>
      target.kind === "node" ? [target.id] : [],
    );
    const nodeIds = topLevel(reader, picked);
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
    for (const target of targets) {
      if (target.kind !== "descendant") continue;
      if (removed.includes(target.ownerId)) continue;
      // A part the owner draws (a toggle's indicator, a TreeItem's chevron) is the owner RAC
      // component's own element (the DOM always draws it): hiding the position would change the
      // Canvas alone.
      const templateId = target.address.templatePath.at(-1);
      const template = templateId
        ? reader.library.templates.get(templateId as `lib:template:${string}`)
        : undefined;
      if (
        template &&
        OWNER_DRAWN_PART_OWNERS[
          definitionTypeName(reader, template.definitionId)
        ]
      )
        fail("OWNER_DRAWN_PART_NOT_REMOVABLE", templateId!);
      // ADR-256 Decision 5: a template position holding a part RAC needs (a Select's trigger …).
      if (templateId && target.address.templatePath.length > 1)
        assertTemplatePartsKept(draft, target, templateId);
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
    assertRequiredPartsKept(draft, nodeIds);
    assertTablesAligned(draft, [
      ...nodeIds,
      ...targets.flatMap((target) =>
        target.kind === "descendant" ? [target.ownerId] : [],
      ),
    ]);
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

/**
 * Where absolutely placed copies land (nodes with a `placement`; in-flow nodes are unaffected):
 * `offset` moves each copy from its source (the old paste's +10 px, so a copy is not hidden under
 * its source), `at` puts the first root at that parent-relative point and keeps the others'
 * distances to it ("Paste here" at the pointer).
 */
export type CopyPlacement =
  { offset: { x: number; y: number } } | { at: { x: number; y: number } };

function placeCopies(
  roots: readonly NodeEntry[],
  placement: CopyPlacement | undefined,
): void {
  if (!placement) return;
  const placed = roots.filter((root) => root.placement?.kind === "absolute");
  const first = placed[0]?.placement;
  if (!first) return;
  const offset =
    "offset" in placement
      ? placement.offset
      : { x: placement.at.x - first.x, y: placement.at.y - first.y };
  for (const root of placed) {
    const current = root.placement!;
    (root as { placement: NodePlacement }).placement = {
      ...current,
      x: current.x + offset.x,
      y: current.y + offset.y,
    };
  }
}

export interface DuplicateNodesInput {
  ids: readonly NodeId[];
  newId: NewId;
  placement?: CopyPlacement;
  label?: string;
}
/** Duplicate each top-level node right after itself, with its owned records. */
export const duplicateNodes =
  (input: DuplicateNodesInput): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const copies: NodeId[] = [];
    const roots: NodeEntry[] = [];
    const clones: {
      clone: ReturnType<typeof cloneNodeSubgraph>;
      parent: NodeParent;
      index: number;
    }[] = [];
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
      clones.push({ clone, parent, index });
      roots.push(clone.entries.find((entry) => entry.id === clone.rootId)!);
    }
    placeCopies(roots, input.placement);
    for (const { clone, parent, index } of clones) {
      for (const entry of clone.entries) draft.create(entry);
      addRelated(draft, clone.relatedEntries);
      placeAt(draft, parent, index + 1, [clone.rootId], input.newId);
      copies.push(clone.rootId);
    }
    // (A duplicate needs no check: it sits beside its original — the same ancestors — and an owner
    // inside the copy is the copy's.)
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
  placement?: CopyPlacement;
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
    placeCopies(
      rootIds.map((id) => entries.find((entry) => entry.id === id)!),
      input.placement,
    );
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

export interface GroupNodesInput {
  ids: readonly NodeId[];
  /** The new group node (a container definition, new ID, no children yet). */
  group: NodeEntry;
  newId: NewId;
  label?: string;
}
/**
 * Wrap sibling nodes in a new group node at the first one's position, keeping their order. The
 * caller supplies the group record (its definition and any geometry the product computes).
 */
export const groupNodes =
  (input: GroupNodesInput): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const roots = topLevel(reader, input.ids);
    if (!roots.length) return fail("EMPTY_SELECTION", "ids");
    if (input.group.children.length)
      fail("GROUP_MUST_BE_EMPTY", input.group.id);
    const located = roots.map((id) => ({ id, ...locate(draft, id) }));
    const parent = located[0].parent;
    const key = (item: NodeParent) => JSON.stringify(item);
    if (located.some((item) => key(item.parent) !== key(parent)))
      fail("GROUP_PARENTS_DIFFER", roots[0]);
    assertNestable(draft, parent, [input.group.definitionId]);
    const list = childList(draft, parent) ?? [];
    const members = list.filter((id) => roots.includes(id));
    const at = Math.min(...located.map((item) => item.index));
    // (The members sit under the group and the group's parent chain: a member that needs an owner —
    // a TabList in Tabs, ADR-256 Phase 5e-2 — finds it above the group.)
    assertNestableUnder(
      draft,
      [
        definitionTypeName(reader, input.group.definitionId),
        ...parentAncestorTypes(draft, parent),
      ],
      members.map((id) => draft.node(id).definitionId),
    );
    draft.create({ ...input.group, children: members });
    const rest = list.filter((id) => !roots.includes(id));
    const index = list.slice(0, at).filter((id) => !roots.includes(id)).length;
    setChildList(draft, parent, [
      ...rest.slice(0, index),
      input.group.id,
      ...rest.slice(index),
    ]);
    return {
      label: input.label ?? "Group",
      ops: draft.ops(),
      selectAfter: [input.group.id],
    };
  };

/** Replace each owned group node by its children, in place; the group record is removed. */
export const ungroupNodes =
  (input: {
    ids: readonly NodeId[];
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const released: NodeId[] = [];
    for (const id of topLevel(reader, input.ids)) {
      const group = draft.node(id);
      const definition = group.definitionId.startsWith("lib:")
        ? reader.library.definitions.get(
            group.definitionId as `lib:definition:${string}`,
          )
        : reader.getEntry(group.definitionId);
      if (definition && "mode" in definition && definition.mode === "composite")
        fail("UNGROUP_INSTANCE", id);
      const { parent } = locate(draft, id);
      const list = childList(draft, parent) ?? [];
      assertNestable(
        draft,
        parent,
        group.children.map((child) => draft.node(child).definitionId),
      );
      const at = list.indexOf(id);
      setChildList(draft, parent, [
        ...list.slice(0, at),
        ...group.children,
        ...list.slice(at + 1),
      ]);
      released.push(...group.children);
      draft.write({ ...group, children: [] });
      removeWithReferrers(draft, [id]);
    }
    assertRequiredPartsKept(draft, topLevel(reader, input.ids));
    assertTablesAligned(draft, [...topLevel(reader, input.ids), ...released]);
    assertStateOwnersLinked(draft, released);
    return {
      label: input.label ?? "Ungroup",
      ops: draft.ops(),
      selectAfter: released,
    };
  };
