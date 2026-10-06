import { resolveNestingViolation } from "../nesting/nestingRules";
import type {
  CatalogEntry,
  CatalogReader,
  DefinitionId,
  DescendantOverride,
  EntryId,
  InstanceAddress,
  NodeEntry,
  NodeId,
  PageEntry,
  ProjectEntry,
} from "../document/types";
import { CatalogValidationError } from "../document/validation";
import type { CatalogOperation } from "../transactions/transaction";

/**
 * ADR-248 Phase 4b command context. A command reads through a `CatalogReader` (the committed
 * graph or a stage) and edits a `CommandDraft`; the draft's records become the transaction's
 * `put` / `remove` operations. Invariants stay with `applyCatalogTransaction`; commands only run
 * product pre-checks (nesting, operable targets) and fail with a `CatalogValidationError` code.
 */

export type { EditTarget, NodeParent } from "../document/types";
import type { NodeParent } from "../document/types";

export const fail = (code: string, at: string): never => {
  throw new CatalogValidationError(code, at);
};

const sameAddress = (left: InstanceAddress, right: InstanceAddress): boolean =>
  left.instances.length === right.instances.length &&
  left.templatePath.length === right.templatePath.length &&
  left.instances.every((id, index) => id === right.instances[index]) &&
  left.templatePath.every((id, index) => id === right.templatePath[index]);
export { sameAddress };

/**
 * Records one command changes, over the reader. Reads see the command's own earlier writes;
 * `ops()` emits them in first-write order (puts, then removes).
 */
export class CommandDraft {
  private readonly written = new Map<string, CatalogEntry | null>();
  constructor(readonly reader: CatalogReader) {}
  read(id: string): CatalogEntry | undefined {
    if (this.written.has(id)) return this.written.get(id) ?? undefined;
    return this.reader.getEntry(id);
  }
  node(id: string): NodeEntry {
    const entry = this.read(id);
    return entry?.kind === "node" ? entry : fail("NODE_REQUIRED", id);
  }
  page(id: string): PageEntry {
    const entry = this.read(id);
    return entry?.kind === "page" ? entry : fail("PAGE_REQUIRED", id);
  }
  project(): ProjectEntry {
    return this.read(this.reader.projectId) as ProjectEntry;
  }
  write(entry: CatalogEntry): void {
    this.written.set(entry.id, entry);
  }
  /** A new record: its ID must be free in the graph and in this command. */
  create(entry: CatalogEntry): void {
    if (this.read(entry.id)) fail("ID_COLLISION", entry.id);
    this.write(entry);
  }
  remove(id: string): void {
    this.written.set(id, null);
  }
  removed(id: string): boolean {
    return this.written.has(id) && this.written.get(id) === null;
  }
  ops(): CatalogOperation[] {
    const puts: CatalogOperation[] = [];
    const removes: CatalogOperation[] = [];
    for (const [id, entry] of this.written) {
      if (entry) puts.push({ kind: "put", entry });
      else if (this.reader.getEntry(id))
        removes.push({ kind: "remove", id: id as EntryId });
    }
    return [...puts, ...removes];
  }
}

/**
 * A definition's element type: a composite (library or project) is its template root's type,
 * like the old ref chain end (an instance renders as its root element).
 */
export function definitionTypeName(
  reader: CatalogReader,
  definitionId: DefinitionId,
  seen: ReadonlySet<string> = new Set(),
): string {
  const definition = definitionId.startsWith("lib:")
    ? reader.library.definitions.get(definitionId as `lib:definition:${string}`)
    : reader.getEntry(definitionId);
  if (!definition || ("kind" in definition && definition.kind !== "definition"))
    return fail("DANGLING_DEFINITION", definitionId);
  const { name, mode, templateRootId } = definition as {
    name: string;
    mode: string;
    templateRootId?: string;
  };
  if (mode !== "composite" || !templateRootId || seen.has(definitionId))
    return name;
  return definitionTypeName(
    reader,
    templateDefinitionId(reader, templateRootId),
    new Set([...seen, definitionId]),
  );
}

/** Definition of a template position (a library template node or a project template node). */
export function templateDefinitionId(
  reader: CatalogReader,
  templateId: string,
): DefinitionId {
  if (templateId.startsWith("lib:")) {
    const template = reader.library.templates.get(
      templateId as `lib:template:${string}`,
    );
    return template?.definitionId ?? fail("DANGLING_TEMPLATE", templateId);
  }
  const node = reader.getEntry(templateId);
  return node?.kind === "node"
    ? node.definitionId
    : fail("DANGLING_TEMPLATE", templateId);
}

/** Type names from a node up to its page (nearest first); a template owner ends the chain. */
function nodeAncestorTypes(draft: CommandDraft, id: NodeId): string[] {
  const types: string[] = [];
  let cursor: string | undefined = id;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const entry = draft.read(cursor);
    if (entry?.kind !== "node") break;
    types.push(definitionTypeName(draft.reader, entry.definitionId));
    cursor = draft.reader.ownerOf(cursor);
  }
  return types;
}

/** Type names from the parent position up to the page (nearest first). */
export function parentAncestorTypes(
  draft: CommandDraft,
  parent: NodeParent,
): string[] {
  if (parent.kind === "page") return [];
  if (parent.kind === "node") return nodeAncestorTypes(draft, parent.id);
  const path = parent.address.templatePath;
  const templates = [...path]
    .reverse()
    .map((id) =>
      definitionTypeName(draft.reader, templateDefinitionId(draft.reader, id)),
    );
  // The instance collapses into its template root: continue from the instance's own parent.
  const owner = draft.reader.ownerOf(parent.ownerId);
  const above =
    owner && draft.read(owner)?.kind === "node"
      ? nodeAncestorTypes(draft, owner as NodeId)
      : [];
  return [...templates, ...above];
}

/** Product nesting pre-check (RAC composition · HTML content model · Pen structure). */
export function assertNestable(
  draft: CommandDraft,
  parent: NodeParent,
  definitionIds: readonly DefinitionId[],
): void {
  const ancestors = parentAncestorTypes(draft, parent);
  for (const definitionId of definitionIds) {
    const childType = definitionTypeName(draft.reader, definitionId);
    const violation = resolveNestingViolation({
      parentType: ancestors[0] ?? null,
      childType,
      ancestorTypes: ancestors,
    });
    if (violation)
      fail("NESTING_NOT_ALLOWED", `${violation.parentType}>${childType}`);
  }
}

/** The instance's override at an address, if any. */
export function overrideAt(
  node: NodeEntry,
  address: InstanceAddress,
): DescendantOverride | undefined {
  return node.descendantOverrides.find((item) =>
    sameAddress(item.address, address),
  );
}

/**
 * The position that holds a parent's child list. A library template position that fills the root
 * slot of the composite it instantiates (`slotFills`, ADR-253 — a Select's ListBox) shows that
 * slot's children as its own: its list is the composite's root at the nested instance level
 * (where an instance's `fillSlot` replaces the library fill). Every other parent holds its own.
 */
export function listParent(
  draft: CommandDraft,
  parent: NodeParent,
): NodeParent {
  if (parent.kind !== "descendant") return parent;
  const { instances, templatePath } = parent.address;
  const templateId = templatePath[templatePath.length - 1];
  if (!templateId?.startsWith("lib:")) return parent;
  const library = draft.reader.library;
  const template = library.templates.get(
    templateId as `lib:template:${string}`,
  );
  if (!template?.slotFills?.length) return parent;
  const definition = library.definitions.get(
    template.definitionId as `lib:definition:${string}`,
  );
  const rootId =
    definition?.mode === "composite" ? definition.templateRootId : undefined;
  if (
    !rootId ||
    !template.slotFills.some(
      (fill) =>
        fill.templatePath.length === 1 && fill.templatePath[0] === rootId,
    )
  )
    return parent;
  return {
    ...parent,
    address: { instances: [...instances, templateId], templatePath: [rootId] },
  };
}

/**
 * The child list a parent currently shows through its own record, or `undefined` for an instance
 * position that still shows its template children (no `fillSlot` yet).
 */
export function childList(
  draft: CommandDraft,
  at: NodeParent,
): readonly NodeId[] | undefined {
  const parent = listParent(draft, at);
  if (parent.kind === "page") return draft.page(parent.id).children;
  if (parent.kind === "node") return draft.node(parent.id).children;
  const override = overrideAt(draft.node(parent.ownerId), parent.address);
  return override?.kind === "fillSlot" ? override.childIds : undefined;
}

/** Replace a parent's child list (an instance position becomes / stays a `fillSlot`). */
export function setChildList(
  draft: CommandDraft,
  at: NodeParent,
  childIds: readonly NodeId[],
): void {
  const parent = listParent(draft, at);
  if (parent.kind === "page") {
    draft.write({ ...draft.page(parent.id), children: [...childIds] });
    return;
  }
  if (parent.kind === "node") {
    draft.write({ ...draft.node(parent.id), children: [...childIds] });
    return;
  }
  const owner = draft.node(parent.ownerId);
  const overrides = owner.descendantOverrides.filter(
    (item) => !sameAddress(item.address, parent.address),
  );
  overrides.push({
    kind: "fillSlot",
    address: parent.address,
    childIds: [...childIds],
  });
  draft.write({ ...owner, descendantOverrides: overrides });
}

/**
 * Where a node sits now: its parent and index. A replacement (`replace` override) and a template
 * root have no movable position.
 */
export function locate(
  draft: CommandDraft,
  id: NodeId,
  ownerId: string | undefined = draft.reader.ownerOf(id),
): { parent: NodeParent; index: number } {
  const owner = ownerId ? draft.read(ownerId) : undefined;
  if (owner?.kind === "page")
    return {
      parent: { kind: "page", id: owner.id },
      index: owner.children.indexOf(id),
    };
  if (owner?.kind === "node") {
    const index = owner.children.indexOf(id);
    if (index >= 0) return { parent: { kind: "node", id: owner.id }, index };
    for (const override of owner.descendantOverrides)
      if (override.kind === "fillSlot" && override.childIds.includes(id))
        return {
          parent: {
            kind: "descendant",
            ownerId: owner.id,
            address: override.address,
          },
          index: override.childIds.indexOf(id),
        };
    return fail("REPLACEMENT_NOT_MOVABLE", id);
  }
  if (owner?.kind === "definition") return fail("TEMPLATE_ROOT_FIXED", id);
  return fail("NODE_NOT_PLACED", id);
}

/** Whether `id` is `ancestorId` or lies under it (owner chain, committed/staged reader). */
export function isWithin(
  reader: CatalogReader,
  id: string,
  ancestorId: string,
): boolean {
  const seen = new Set<string>();
  for (
    let cursor: string | undefined = id;
    cursor && !seen.has(cursor);
    cursor = reader.ownerOf(cursor)
  ) {
    if (cursor === ancestorId) return true;
    seen.add(cursor);
  }
  return false;
}

/** The IDs of a selection that are not under another selected ID, in selection order. */
export function topLevel(
  reader: CatalogReader,
  ids: readonly NodeId[],
): NodeId[] {
  const selected = new Set(ids);
  return ids.filter((id, index) => {
    if (ids.indexOf(id) !== index) return false;
    for (
      let cursor = reader.ownerOf(id);
      cursor;
      cursor = reader.ownerOf(cursor)
    )
      if (selected.has(cursor as NodeId)) return false;
    return true;
  });
}
