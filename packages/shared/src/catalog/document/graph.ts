import { LIBRARY_CONTRACT_VERSION } from "./types";
import { catalogPropValueFits } from "./valueType";
import type {
  CatalogDocument,
  CatalogEntry,
  CatalogLibrary,
  DefinitionEntry,
  DefinitionId,
  EntryId,
  LibraryDefinition,
  LibraryDefinitionId,
  DefinitionOverrideEntry,
  NodeEntry,
  NodeId,
  TokenId,
  TokenType,
  AuthoredValue,
} from "./types";
import {
  validateCatalogDocument,
  validateCatalogEntry,
  CatalogValidationError,
} from "./validation";
import { validateInstanceAddress } from "../resolution/address";
import {
  migrateCatalogEntriesS2,
  migrateCatalogTableColumns,
} from "./s2PropAlignment";
import { assertCatalogLibrary, instanceContract } from "./library";
import { catalogChildKind } from "../nesting/nestingRules";

export interface GraphIndexes {
  definitionToInstances: ReadonlyMap<DefinitionId, ReadonlySet<NodeId>>;
  ownerToChildren: ReadonlyMap<string, ReadonlySet<NodeId>>;
  childToOwner: ReadonlyMap<NodeId, string>;
  tokenToConsumers: ReadonlyMap<TokenId, ReadonlySet<string>>;
  collectionToBindings: ReadonlyMap<string, ReadonlySet<NodeId>>;
}
export interface GraphMetrics {
  transactionEntryReads: number;
  transactionEntriesTraversed: number;
  transactionRecordReplacements: number;
  transactionIndexEdgesUpdated: number;
  transactionEntryTableClones: number;
}
export interface CatalogHistoryRecord {
  label: string;
  revision: number;
  changedIds: readonly string[];
  removedIds: readonly string[];
}
type MutableIndex = Map<string, Set<string>>;
/** `ref`: any other by-ID reference (addresses, interaction/state owners and targets, theme tokens). */
type EdgeType =
  "definition" | "owner" | "token" | "collection" | "ref" | "htmlId";
interface Edge {
  type: EdgeType;
  key: string;
  target: string;
}

function tokenRefs(value: unknown, target: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) tokenRefs(item, target);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (record.kind === "token" && typeof record.tokenId === "string") {
    target.add(record.tokenId);
    return;
  }
  for (const item of Object.values(record)) tokenRefs(item, target);
}
export function ownedChildren(entry: CatalogEntry): NodeId[] {
  if (entry.kind === "page") return [...entry.children];
  if (entry.kind === "definition")
    return entry.templateRootId ? [entry.templateRootId] : [];
  if (entry.kind !== "node") return [];
  const ids = [...entry.children];
  for (const override of entry.descendantOverrides) {
    if (override.kind === "replace") ids.push(override.replacementId);
    if (override.kind === "fillSlot") ids.push(...override.childIds);
  }
  return ids;
}
/** By-ID references not carried by the owner, definition, token or collection edges. */
export function referencedIds(entry: CatalogEntry): string[] {
  const ids: string[] = [];
  const address = (value: {
    instances: readonly string[];
    templatePath: readonly string[];
  }) => {
    for (const id of [...value.instances, ...value.templatePath])
      if (id.startsWith("project:")) ids.push(id);
  };
  if (entry.kind === "node")
    for (const override of entry.descendantOverrides) address(override.address);
  if (entry.kind === "interaction") {
    ids.push(entry.ownerId);
    if (entry.address) address(entry.address);
    if (entry.action.opcode === "navigate") ids.push(entry.action.pageId);
    if (entry.action.opcode === "capability") ids.push(entry.action.targetId);
    if (
      entry.action.opcode === "setState" &&
      entry.action.variableId.startsWith("project:")
    )
      ids.push(entry.action.variableId);
  }
  if (entry.kind === "stateVariable") ids.push(entry.ownerId);
  if (entry.kind === "theme") ids.push(...entry.tokenIds);
  if (entry.kind === "page" && entry.parentId) ids.push(entry.parentId);
  return ids;
}
function edgesOf(entry: CatalogEntry): Edge[] {
  const edges: Edge[] = [];
  if (entry.kind === "node") {
    edges.push({
      type: "definition",
      key: entry.definitionId,
      target: entry.id,
    });
    if (entry.binding)
      edges.push({
        type: "collection",
        key: entry.binding.collectionId,
        target: entry.id,
      });
    if (entry.metadata?.htmlId)
      edges.push({
        type: "htmlId",
        key: entry.metadata.htmlId,
        target: entry.id,
      });
  }
  for (const child of ownedChildren(entry))
    edges.push({ type: "owner", key: entry.id, target: child });
  for (const id of new Set(referencedIds(entry)))
    edges.push({ type: "ref", key: id, target: entry.id });
  const refs = new Set<string>();
  if (entry.kind === "node") {
    tokenRefs(entry.props, refs);
    tokenRefs(entry.visual, refs);
    tokenRefs(entry.stateRules, refs);
    tokenRefs(entry.descendantOverrides, refs);
    tokenRefs(entry.responsive, refs);
  } else if (
    entry.kind === "definition" ||
    entry.kind === "definitionOverride"
  ) {
    tokenRefs(entry.defaults, refs);
    tokenRefs(entry.visual, refs);
    tokenRefs(entry.stateRules, refs);
  }
  for (const token of refs)
    edges.push({ type: "token", key: token, target: entry.id });
  return edges;
}
/** A prop value against its declared type — the shared rule (`catalogPropValueFits`). */
const propValueMatches = catalogPropValueFits;
function edgeKey(edge: Edge): string {
  return `${edge.type}\0${edge.key}\0${edge.target}`;
}
function add(index: MutableIndex, key: string, target: string): void {
  let targets = index.get(key);
  if (!targets) {
    targets = new Set();
    index.set(key, targets);
  }
  targets.add(target);
}
function remove(index: MutableIndex, key: string, target: string): void {
  const targets = index.get(key);
  if (!targets) return;
  targets.delete(target);
  if (targets.size === 0) index.delete(key);
}
function ownedRecord<T>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (item: unknown): void => {
    if (!item || typeof item !== "object" || Object.isFrozen(item)) return;
    for (const child of Object.values(item)) freeze(child);
    Object.freeze(item);
  };
  freeze(copy);
  return copy;
}

/** One private mutable table with atomic commits; no product singleton or subscription. */
export class CatalogGraph {
  private readonly table = new Map<string, CatalogEntry>();
  private readonly viewEntries = new Map<string, () => NodeEntry>();
  private readonly definitionIndex: MutableIndex = new Map();
  private readonly ownerIndex: MutableIndex = new Map();
  private readonly ownerByChild = new Map<string, string>();
  private readonly tokenIndex: MutableIndex = new Map();
  private readonly collectionIndex: MutableIndex = new Map();
  private readonly refIndex: MutableIndex = new Map();
  private readonly htmlIdIndex: MutableIndex = new Map();
  private readonly libraryDependents: MutableIndex = new Map();
  private readonly overrideIndex = new Map<
    LibraryDefinitionId,
    EntryId<"definitionOverride">
  >();
  private readonly overrideTarget = new Map<
    EntryId<"definitionOverride">,
    LibraryDefinitionId
  >();
  private readonly historyRecords: CatalogHistoryRecord[] = [];
  private readonly dirty = new Set<string>();
  private currentRevision: number;
  private lastCommit:
    | {
        revision: number;
        previous: ReadonlyMap<string, CatalogEntry | null>;
        newlyDirty: readonly string[];
        recorded: boolean;
        previousMetrics: GraphMetrics;
      }
    | undefined;
  private lastMetrics: GraphMetrics = {
    transactionEntryReads: 0,
    transactionEntriesTraversed: 0,
    transactionRecordReplacements: 0,
    transactionIndexEdgesUpdated: 0,
    transactionEntryTableClones: 0,
  };
  readonly projectId: EntryId<"project">;
  readonly library: CatalogLibrary;

  constructor(document: CatalogDocument, library: CatalogLibrary) {
    validateCatalogDocument(document);
    assertCatalogLibrary(library);
    if (document.libraryContractVersion !== library.contractVersion)
      throw new CatalogValidationError(
        "UNSUPPORTED_LIBRARY_CONTRACT",
        "document.libraryContractVersion",
      );
    this.projectId = document.projectId;
    this.library = library;
    this.currentRevision = document.revision;
    for (const entry of Object.values(document.entries))
      this.table.set(entry.id, ownedRecord(entry));
    this.validateView((id) => this.table.get(id), [...this.table.values()]);
    for (const entry of this.table.values()) {
      for (const edge of edgesOf(entry)) this.addEdge(edge);
      if (entry.kind === "definitionOverride") {
        this.overrideIndex.set(entry.targetId, entry.id);
        this.overrideTarget.set(entry.id, entry.targetId);
      }
    }
    for (const definition of library.definitions.values()) {
      if (!definition.templateRootId) continue;
      const stack = [definition.templateRootId];
      const seen = new Set<string>();
      while (stack.length) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        const template = library.templates.get(id as `lib:template:${string}`);
        if (!template) continue;
        add(this.libraryDependents, template.definitionId, definition.id);
        stack.push(...template.children);
      }
    }
  }

  get revision(): number {
    return this.currentRevision;
  }
  get size(): number {
    return this.table.size;
  }
  get history(): readonly CatalogHistoryRecord[] {
    return [...this.historyRecords];
  }
  get dirtyIds(): ReadonlySet<string> {
    return new Set(this.dirty);
  }
  get metrics(): GraphMetrics {
    return { ...this.lastMetrics };
  }
  getEntry(id: string): CatalogEntry | undefined {
    return this.table.get(id) ?? this.viewEntries.get(id)?.();
  }
  /**
   * Derived view entries (HC2 — a derived view is never a write source): a node read like an
   * entry (the Builder's library origin view draws one) but never part of the document — not in
   * the table, the indexes, exports, saves or transactions. Its value is computed on each read
   * (it follows the entries it is derived from). `undefined` removes it.
   */
  setViewEntry(id: NodeId, compute: (() => NodeEntry) | undefined): void {
    if (this.table.has(id)) throw new Error(`VIEW_ENTRY_ID_TAKEN:${id}`);
    if (compute) this.viewEntries.set(id, compute);
    else this.viewEntries.delete(id);
  }
  /** The ids of the derived view entries (none, or the one the open view draws). */
  viewEntryIds(): readonly string[] {
    return [...this.viewEntries.keys()];
  }
  isViewEntry(id: string): boolean {
    return this.viewEntries.has(id);
  }
  getDefinition(
    id: DefinitionId,
  ): DefinitionEntry | LibraryDefinition | undefined {
    return id.startsWith("lib:")
      ? this.library.definitions.get(id as `lib:definition:${string}`)
      : (this.table.get(id) as DefinitionEntry | undefined);
  }
  getToken(id: TokenId):
    | {
        tokenType: string;
        value: string | number | boolean;
        ref?: `{${string}}`;
      }
    | undefined {
    return id.startsWith("lib:")
      ? this.library.tokens.get(id as `lib:token:${string}`)
      : (this.table.get(id) as ReturnType<CatalogGraph["getToken"]>);
  }
  getDefinitionOverride(id: DefinitionId): DefinitionOverrideEntry | undefined {
    if (!id.startsWith("lib:")) return undefined;
    const overrideId = this.overrideIndex.get(id as LibraryDefinitionId);
    return overrideId
      ? (this.table.get(overrideId) as DefinitionOverrideEntry)
      : undefined;
  }
  get indexes(): GraphIndexes {
    const copy = (source: MutableIndex) =>
      new Map([...source].map(([key, value]) => [key, new Set(value)]));
    return {
      definitionToInstances: copy(
        this.definitionIndex,
      ) as GraphIndexes["definitionToInstances"],
      ownerToChildren: copy(this.ownerIndex) as GraphIndexes["ownerToChildren"],
      childToOwner: new Map(this.ownerByChild) as GraphIndexes["childToOwner"],
      tokenToConsumers: copy(
        this.tokenIndex,
      ) as GraphIndexes["tokenToConsumers"],
      collectionToBindings: copy(
        this.collectionIndex,
      ) as GraphIndexes["collectionToBindings"],
    };
  }
  /** Called by the transaction reducer after all validation succeeds. */
  commit(
    staged: ReadonlyMap<string, CatalogEntry | null>,
    label: string | null,
    metrics: GraphMetrics,
  ): void {
    // Materialize caller-owned records before the first index or history mutation.
    const prepared = new Map<string, CatalogEntry | null>();
    for (const [id, entry] of staged)
      prepared.set(id, entry === null ? null : ownedRecord(entry));
    const previous = new Map<string, CatalogEntry | null>();
    for (const id of staged.keys())
      previous.set(id, this.table.get(id) ?? null);
    const newlyDirty = [...staged.keys()].filter((id) => !this.dirty.has(id));
    const previousMetrics = this.lastMetrics;
    metrics.transactionIndexEdgesUpdated += this.replace(prepared);
    metrics.transactionRecordReplacements = staged.size;
    this.currentRevision++;
    if (label !== null)
      this.historyRecords.push({
        label,
        revision: this.currentRevision,
        changedIds: [...staged]
          .filter(([, value]) => value !== null)
          .map(([id]) => id),
        removedIds: [...staged]
          .filter(([, value]) => value === null)
          .map(([id]) => id),
      });
    this.lastMetrics = metrics;
    this.lastCommit = {
      revision: this.currentRevision,
      previous,
      newlyDirty,
      recorded: label !== null,
      previousMetrics,
    };
  }
  /**
   * Undo the most recent commit exactly — records, indexes, dirty set, history record, metrics
   * and revision — in O(changed entries). Only the latest commit, and only before the next one.
   */
  revertCommit(revision: number): void {
    const last = this.lastCommit;
    if (
      !last ||
      last.revision !== revision ||
      revision !== this.currentRevision
    )
      throw new Error("CATALOG_REVERT_UNAVAILABLE");
    this.lastCommit = undefined;
    this.replace(last.previous);
    for (const id of last.newlyDirty) this.dirty.delete(id);
    if (last.recorded) this.historyRecords.pop();
    this.currentRevision--;
    this.lastMetrics = last.previousMetrics;
  }
  /** Swap records in (null removes), keeping every index in step. Returns edges updated. */
  private replace(next: ReadonlyMap<string, CatalogEntry | null>): number {
    let edgesUpdated = 0;
    const oldEdges = new Map<string, Edge>();
    const nextEdges = new Map<string, Edge>();
    for (const id of next.keys()) {
      const entry = this.table.get(id);
      if (entry)
        for (const edge of edgesOf(entry)) oldEdges.set(edgeKey(edge), edge);
    }
    for (const entry of next.values())
      if (entry)
        for (const edge of edgesOf(entry)) nextEdges.set(edgeKey(edge), edge);
    for (const [key, edge] of oldEdges)
      if (!nextEdges.has(key)) {
        this.removeEdge(edge);
        edgesUpdated++;
      }
    for (const [key, edge] of nextEdges)
      if (!oldEdges.has(key)) {
        this.addEdge(edge);
        edgesUpdated++;
      }
    for (const [id, entry] of next) {
      const old = this.table.get(id);
      if (old?.kind === "definitionOverride") {
        this.overrideIndex.delete(old.targetId);
        this.overrideTarget.delete(old.id);
      }
      if (entry === null) this.table.delete(id);
      else this.table.set(id, entry);
      if (entry?.kind === "definitionOverride") {
        this.overrideIndex.set(entry.targetId, entry.id);
        this.overrideTarget.set(entry.id, entry.targetId);
      }
      this.dirty.add(id);
    }
    return edgesUpdated;
  }

  /** Committed owner of a node (page, node or definition), from the owner index. */
  ownerOf(id: string): string | undefined {
    return this.ownerByChild.get(id);
  }
  /**
   * Committed entries that name `id` by reference (descendant addresses, interaction owner /
   * target / page / variable, state variable owner, theme tokens, page parent) — the reverse
   * `ref` index, so a caller never scans the document for them.
   */
  referrersOf(id: string): ReadonlySet<string> {
    return this.refIndex.get(id) ?? new Set();
  }
  /** Committed nodes bound to a data collection (the Data panel's usage, no scan). */
  bindingsOf(collectionId: string): ReadonlySet<string> {
    return this.collectionIndex.get(collectionId) ?? new Set();
  }
  /** Committed nodes whose author DOM id (`metadata.htmlId`) is `htmlId` (duplicate check). */
  nodesWithHtmlId(htmlId: string): ReadonlySet<string> {
    return this.htmlIdIndex.get(htmlId) ?? new Set();
  }
  /** Committed instances of a definition (definition → node index). */
  instancesOf(definitionId: string): ReadonlySet<string> {
    return this.definitionIndex.get(definitionId) ?? new Set();
  }
  /**
   * Structural transaction check against the committed indexes: the same invariants as
   * `validateView`, evaluated only for the staged entries, the children they claim or release,
   * and the committed entries that reference a staged ID. Cost scales with the staged records,
   * their owned-child lists and their referrers — never with the graph (ADR-248 §4.1).
   */
  validateStructuralDelta(
    staged: ReadonlyMap<string, CatalogEntry | null>,
    get: (id: string) => CatalogEntry | undefined,
  ): void {
    const root = get(this.projectId);
    if (root?.kind !== "project")
      throw new CatalogValidationError("PROJECT_ROOT_REQUIRED", this.projectId);
    const listedIds = (): Set<string> => {
      const listed = new Set<string>();
      for (const ids of [
        root.pageIds,
        root.definitionIds,
        root.overrideIds,
        root.themeIds,
        root.tokenIds,
        root.stateVariableIds,
        root.interactionIds,
        root.assetIds,
      ])
        for (const id of ids) {
          if (listed.has(id) || (id as string) === root.id)
            throw new CatalogValidationError("DUPLICATE_OWNERSHIP", id);
          listed.add(id);
        }
      return listed;
    };
    let listed: Set<string> | undefined;
    if (staged.has(this.projectId)) {
      listed = listedIds();
      for (const id of listed) {
        const entry = get(id);
        if (!entry || entry.kind === "project")
          throw new CatalogValidationError("DANGLING_PROJECT_ENTRY", id);
      }
      if (root.activeThemeId && !root.themeIds.includes(root.activeThemeId))
        throw new CatalogValidationError("DANGLING_THEME", root.activeThemeId);
    }
    const isListed = (id: string): boolean => (listed ??= listedIds()).has(id);
    // Claims after the change: staged owners claim their owned children; an unstaged owner
    // keeps its committed claims.
    const claims = new Map<string, string>();
    /** Claims that did not exist before: only these can close a cycle or enter a template. */
    const newClaims = new Map<string, string>();
    const overrideTargets = new Map<string, string>();
    let definitionsChanged = false;
    for (const [id, entry] of staged) {
      if (entry === null) {
        if (isListed(id))
          throw new CatalogValidationError("DANGLING_PROJECT_ENTRY", id);
        continue;
      }
      if (entry.kind === "project" && entry.id !== this.projectId)
        throw new CatalogValidationError("MULTIPLE_PROJECT_ROOTS", entry.id);
      if (entry.kind !== "node" && entry.kind !== "project" && !isListed(id))
        throw new CatalogValidationError("UNOWNED_ENTRY", id);
      if (entry.kind === "definitionOverride") {
        const other = overrideTargets.get(entry.targetId);
        const committed = this.overrideIndex.get(entry.targetId);
        if (
          other ||
          (committed &&
            committed !== id &&
            (!staged.has(committed) ||
              (staged.get(committed) as DefinitionOverrideEntry | null)
                ?.targetId === entry.targetId))
        )
          throw new CatalogValidationError(
            "DUPLICATE_DEFINITION_OVERRIDE",
            entry.targetId,
          );
        overrideTargets.set(entry.targetId, id);
      }
      for (const child of ownedChildren(entry)) {
        if (claims.has(child))
          throw new CatalogValidationError("DUPLICATE_OWNERSHIP", child);
        claims.set(child, id);
        // A child this owner already owned, and that is not itself staged, stays valid.
        if (this.ownerByChild.get(child) === id && !staged.has(child)) continue;
        if (this.ownerByChild.get(child) !== id) newClaims.set(child, id);
        const committedOwner = this.ownerByChild.get(child);
        if (
          committedOwner &&
          committedOwner !== id &&
          !staged.has(committedOwner)
        )
          throw new CatalogValidationError("DUPLICATE_OWNERSHIP", child);
        const claimed = get(child);
        if (claimed?.kind !== "node")
          throw new CatalogValidationError("DANGLING_CHILD", child);
        // A newly placed instance of a user definition may close a definition cycle.
        if (claimed.definitionId.startsWith("project:definition:"))
          definitionsChanged = true;
      }
    }
    const ownerAfter = (id: string): string | undefined => {
      const claimed = claims.get(id);
      if (claimed) return claimed;
      const committed = this.ownerByChild.get(id);
      return committed && !staged.has(committed) ? committed : undefined;
    };
    // A new claim creates a cycle only if the claimed child is an ancestor of its new owner.
    for (const [child, owner] of newClaims) {
      const seen = new Set<string>();
      let top = owner;
      for (
        let cursor: string | undefined = owner;
        cursor;
        cursor = ownerAfter(cursor)
      ) {
        if (cursor === child || seen.has(cursor))
          throw new CatalogValidationError("OWNERSHIP_CYCLE", child);
        seen.add(cursor);
        top = cursor;
      }
      // A subtree placed inside a template may contain an instance of that template.
      if (get(top)?.kind === "definition") definitionsChanged = true;
    }
    // Committed entries whose references read a staged record are re-validated.
    const referrers = new Set<string>();
    for (const [id, entry] of staged) {
      for (const index of [
        this.definitionIndex,
        this.tokenIndex,
        this.refIndex,
      ])
        for (const referrer of index.get(id) ?? []) referrers.add(referrer);
      const before = this.table.get(id);
      if (entry?.kind === "definition" || before?.kind === "definition")
        definitionsChanged = true;
      // A template root carries its definition's instance contract.
      for (const owner of [ownerAfter(id), this.ownerByChild.get(id)])
        if (owner && get(owner)?.kind === "definition") {
          definitionsChanged = true;
          for (const instance of this.instancesOf(owner))
            referrers.add(instance);
        }
      if (
        (entry?.kind === "node" &&
          entry.definitionId.startsWith("project:definition:")) ||
        (before?.kind === "node" &&
          before.definitionId.startsWith("project:definition:"))
      )
        definitionsChanged = true;
    }
    for (const referrer of referrers) {
      if (staged.has(referrer)) continue;
      const entry = get(referrer);
      if (entry) this.validateEntryReferences(entry, get);
    }
    const released = new Set<string>();
    for (const [id, entry] of staged) {
      const before = this.table.get(id);
      if (before)
        for (const child of ownedChildren(before))
          if (claims.get(child) !== id) released.add(child);
      if (entry?.kind === "node" && !ownerAfter(id))
        throw new CatalogValidationError("UNOWNED_NODE", id);
      if (entry === null && ownerAfter(id))
        throw new CatalogValidationError("DANGLING_CHILD", id);
    }
    for (const child of released)
      if (get(child) && !ownerAfter(child))
        throw new CatalogValidationError("UNOWNED_NODE", child);
    if (definitionsChanged) {
      const definitions = root.definitionIds
        .map((id) => get(id))
        .filter((entry): entry is CatalogEntry => !!entry);
      this.validateDefinitionCycles(get, definitions);
    }
  }

  validateView(
    get: (id: string) => CatalogEntry | undefined,
    entries: readonly CatalogEntry[],
  ): void {
    const root = get(this.projectId);
    if (root?.kind !== "project")
      throw new CatalogValidationError("PROJECT_ROOT_REQUIRED", this.projectId);
    const listed = new Set<string>([root.id]);
    for (const ids of [
      root.pageIds,
      root.definitionIds,
      root.overrideIds,
      root.themeIds,
      root.tokenIds,
      root.stateVariableIds,
      root.interactionIds,
      root.assetIds,
    ])
      for (const id of ids) {
        if (listed.has(id))
          throw new CatalogValidationError("DUPLICATE_OWNERSHIP", id);
        listed.add(id);
      }
    for (const id of listed) {
      const entry = get(id);
      if (!entry || (id !== root.id && entry.kind === "project"))
        throw new CatalogValidationError("DANGLING_PROJECT_ENTRY", id);
    }
    if (root.activeThemeId && !root.themeIds.includes(root.activeThemeId))
      throw new CatalogValidationError("DANGLING_THEME", root.activeThemeId);
    const owners = new Map<string, string>();
    const overrides = new Set<string>();
    const entryIds = new Set(entries.map((entry) => entry.id));
    if (entries.length !== entryIds.size)
      throw new CatalogValidationError("DUPLICATE_ID", "entries");
    for (const entry of entries) {
      validateCatalogEntry(entry);
      if (entry.kind === "project" && entry.id !== this.projectId)
        throw new CatalogValidationError("MULTIPLE_PROJECT_ROOTS", entry.id);
      if (entry.kind === "definitionOverride") {
        if (overrides.has(entry.targetId))
          throw new CatalogValidationError(
            "DUPLICATE_DEFINITION_OVERRIDE",
            entry.targetId,
          );
        overrides.add(entry.targetId);
      }
      if (
        entry.kind !== "node" &&
        entry.kind !== "project" &&
        !listed.has(entry.id)
      )
        throw new CatalogValidationError("UNOWNED_ENTRY", entry.id);
      const children = ownedChildren(entry);
      for (const child of children) {
        if (owners.has(child))
          throw new CatalogValidationError("DUPLICATE_OWNERSHIP", child);
        owners.set(child, entry.id);
        if (get(child)?.kind !== "node")
          throw new CatalogValidationError("DANGLING_CHILD", child);
      }
      this.validateEntryReferences(entry, get);
    }
    for (const entry of entries)
      if (entry.kind === "node" && !owners.has(entry.id))
        throw new CatalogValidationError("UNOWNED_NODE", entry.id);
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visitOwner = (id: string): void => {
      if (visiting.has(id))
        throw new CatalogValidationError("OWNERSHIP_CYCLE", id);
      if (visited.has(id)) return;
      visiting.add(id);
      const entry = get(id);
      if (entry) for (const child of ownedChildren(entry)) visitOwner(child);
      visiting.delete(id);
      visited.add(id);
    };
    for (const entry of entries) visitOwner(entry.id);
    this.validateDefinitionCycles(get, entries);
  }

  validateEntryReferences(
    entry: CatalogEntry,
    get: (id: string) => CatalogEntry | undefined,
  ): void {
    const lookupDefinition = (id: DefinitionId) =>
      id.startsWith("lib:")
        ? this.library.definitions.get(id as `lib:definition:${string}`)
        : (get(id) as DefinitionEntry | undefined);
    // A composite instance is its template root: it takes the root's props plus its schema.
    const contractOf = (definition: DefinitionEntry | LibraryDefinition) =>
      instanceContract(
        definition as LibraryDefinition,
        (id) => lookupDefinition(id as DefinitionId) as LibraryDefinition,
        (id) =>
          id.startsWith("lib:")
            ? this.library.templates.get(id as `lib:template:${string}`)
            : (get(id) as { definitionId: string } | undefined),
      );
    if (entry.kind === "node") {
      const found = lookupDefinition(entry.definitionId);
      if (!found)
        throw new CatalogValidationError(
          "DANGLING_DEFINITION",
          entry.definitionId,
        );
      const definition = { ...found, ...contractOf(found) };
      this.validatePropWrites(entry.props, definition.accepts, entry.id);
      this.validatePropChoices(entry.props, definition, get, entry.id);
      this.validateTokenFields(entry.props, definition.accepts, get, entry.id);
      this.validateTokenFields(entry.visual, undefined, get, entry.id);
      this.validateStateTokenRules(entry.stateRules, get, entry.id);
      for (const override of entry.descendantOverrides) {
        const target = validateInstanceAddress(
          entry,
          override.address,
          get,
          this.library,
        );
        // Filling a template position with instance-owned children: a declared slot, or a part
        // that takes children (ADR-256 Decision 4 — its RAC children kind is items or free content;
        // what may go in is the nesting check's, `catalogChildKind`). Leaf positions are refused.
        const targetType = lookupDefinition(target.definitionId)?.name.split(
          "/",
        )[0];
        if (
          override.kind === "fillSlot" &&
          !target.slot &&
          (!targetType || catalogChildKind(targetType).kind === "leaf")
        )
          throw new CatalogValidationError("TARGET_NOT_SLOT", entry.id);
        if (override.kind === "patch") {
          const foundTarget = lookupDefinition(target.definitionId);
          if (!foundTarget)
            throw new CatalogValidationError(
              "DANGLING_DEFINITION",
              target.definitionId,
            );
          const targetDef = { ...foundTarget, ...contractOf(foundTarget) };
          if (override.props)
            this.validatePropWrites(
              override.props,
              targetDef.accepts,
              entry.id,
            );
          if (override.props)
            this.validatePropChoices(override.props, targetDef, get, entry.id);
          if (override.props)
            this.validateTokenFields(
              override.props,
              targetDef.accepts,
              get,
              entry.id,
            );
          if (override.visual)
            this.validateTokenFields(override.visual, undefined, get, entry.id);
          if (override.stateRules)
            this.validateStateTokenRules(override.stateRules, get, entry.id);
        }
      }
      if (
        entry.binding &&
        !entry.binding.collectionId.startsWith("data:collection:")
      )
        throw new CatalogValidationError("INVALID_COLLECTION_REF", entry.id);
    }
    if (entry.kind === "definition" || entry.kind === "definitionOverride") {
      if (
        entry.kind === "definition" &&
        entry.bindingId &&
        !this.library.execution.bindingIds.has(entry.bindingId)
      )
        throw new CatalogValidationError("UNKNOWN_BINDING_ID", entry.bindingId);
      if (entry.kind === "definitionOverride") {
        const target = this.library.definitions.get(entry.targetId);
        if (!target)
          throw new CatalogValidationError(
            "DANGLING_DEFINITION",
            entry.targetId,
          );
        this.validatePropWrites(entry.defaults, target.accepts, entry.id);
        this.validatePropChoices(entry.defaults, target, get, entry.id);
        this.validateTokenFields(entry.defaults, target.accepts, get, entry.id);
        this.validateTokenFields(entry.visual, undefined, get, entry.id);
        this.validateStateTokenRules(entry.stateRules, get, entry.id);
      }
      if (entry.kind === "definition") {
        this.validatePropValues(entry.defaults, entry.accepts, entry.id);
        this.validateTokenFields(entry.defaults, entry.accepts, get, entry.id);
        this.validateTokenFields(entry.visual, undefined, get, entry.id);
        this.validateStateTokenRules(entry.stateRules, get, entry.id);
      }
    }
    if (entry.kind === "interaction") {
      const owner = get(entry.ownerId);
      if (owner?.kind !== "node")
        throw new CatalogValidationError("DANGLING_OWNER", entry.ownerId);
      if (entry.address)
        validateInstanceAddress(owner, entry.address, get, this.library);
      if (!this.library.execution.triggerIds.has(entry.trigger))
        throw new CatalogValidationError("UNKNOWN_TRIGGER_ID", entry.trigger);
      if (!this.library.execution.actionOpCodes.has(entry.action.opcode))
        throw new CatalogValidationError(
          "UNKNOWN_ACTION_OPCODE",
          entry.action.opcode,
        );
      if (
        entry.action.opcode === "navigate" &&
        get(entry.action.pageId)?.kind !== "page"
      )
        throw new CatalogValidationError("DANGLING_PAGE", entry.action.pageId);
      if (entry.action.opcode === "capability") {
        if (get(entry.action.targetId)?.kind !== "node")
          throw new CatalogValidationError(
            "DANGLING_TARGET",
            entry.action.targetId,
          );
        if (
          !this.library.execution.capabilityIds.has(entry.action.capabilityId)
        )
          throw new CatalogValidationError(
            "UNKNOWN_CAPABILITY_ID",
            entry.action.capabilityId,
          );
      }
      if (
        entry.action.opcode === "setState" &&
        entry.action.variableId.startsWith("project:") &&
        get(entry.action.variableId)?.kind !== "stateVariable"
      )
        throw new CatalogValidationError(
          "DANGLING_VARIABLE",
          entry.action.variableId,
        );
      if (
        entry.action.opcode === "setState" &&
        entry.action.variableId.startsWith("project:")
      ) {
        const variable = get(entry.action.variableId);
        if (variable?.kind === "stateVariable") {
          if (
            entry.action.op === "set" &&
            typeof entry.action.value !== variable.valueType
          )
            throw new CatalogValidationError(
              "STATE_VALUE_TYPE",
              entry.action.variableId,
            );
          if (entry.action.op === "toggle" && variable.valueType !== "boolean")
            throw new CatalogValidationError(
              "STATE_OP_TYPE",
              entry.action.variableId,
            );
          if (
            entry.action.op === "increment" &&
            variable.valueType !== "number"
          )
            throw new CatalogValidationError(
              "STATE_OP_TYPE",
              entry.action.variableId,
            );
        }
      }
    }
    if (entry.kind === "page" && entry.parentId) {
      const seen = new Set<string>([entry.id]);
      for (
        let cursor: string | undefined = entry.parentId;
        cursor;
        cursor = (get(cursor) as { parentId?: string } | undefined)?.parentId
      ) {
        if (seen.has(cursor))
          throw new CatalogValidationError("PAGE_PARENT_CYCLE", entry.id);
        seen.add(cursor);
        if (get(cursor)?.kind !== "page")
          throw new CatalogValidationError("DANGLING_PARENT_PAGE", cursor);
      }
    }
    if (entry.kind === "stateVariable") {
      const owner = get(entry.ownerId);
      if (!owner || (owner.kind !== "page" && owner.kind !== "node"))
        throw new CatalogValidationError("DANGLING_OWNER", entry.ownerId);
    }
    if (entry.kind === "theme")
      for (const tokenId of entry.tokenIds)
        if (get(tokenId)?.kind !== "token")
          throw new CatalogValidationError("DANGLING_TOKEN", tokenId);
    const tokenIds = new Set<string>();
    tokenRefs(entry, tokenIds);
    for (const token of tokenIds) {
      const found = token.startsWith("lib:")
        ? this.library.tokens.get(token as `lib:token:${string}`)
        : (get(token) as { kind: string } | undefined);
      if (!found || ("kind" in found && found.kind !== "token"))
        throw new CatalogValidationError("DANGLING_TOKEN", token);
    }
  }

  private validatePropWrites(
    props: Readonly<Record<string, { kind: string; value?: unknown }>>,
    accepts: Readonly<Record<string, string>>,
    at: string,
  ): void {
    for (const [key, write] of Object.entries(props)) {
      const type = accepts[key];
      if (!type)
        throw new CatalogValidationError("PROP_NOT_ACCEPTED", `${at}.${key}`);
      if (write.kind === "set" && !propValueMatches(write.value, type))
        throw new CatalogValidationError("PROP_TYPE_MISMATCH", `${at}.${key}`);
    }
  }
  private validatePropChoices(
    props: Readonly<Record<string, { kind: string; value?: unknown }>>,
    definition: DefinitionEntry | LibraryDefinition,
    get: (id: string) => CatalogEntry | undefined,
    at: string,
  ): void {
    if (!("propChoices" in definition) || !definition.propChoices) return;
    for (const [key, choices] of Object.entries(definition.propChoices)) {
      const write = props[key];
      if (write?.kind !== "set") continue;
      const raw = write.value;
      const value =
        raw && typeof raw === "object" && "tokenId" in raw
          ? (raw.tokenId as string).startsWith("lib:")
            ? this.library.tokens.get(raw.tokenId as `lib:token:${string}`)
                ?.value
            : (get(raw.tokenId as string) as { value?: unknown } | undefined)
                ?.value
          : raw;
      if (!choices.includes(value as never))
        throw new CatalogValidationError(
          "PROP_CHOICE_MISMATCH",
          `${at}.${key}`,
        );
    }
  }
  private validatePropValues(
    props: Readonly<Record<string, unknown>>,
    accepts: Readonly<Record<string, string>>,
    at: string,
  ): void {
    for (const [key, value] of Object.entries(props)) {
      const type = accepts[key];
      if (!type)
        throw new CatalogValidationError("PROP_NOT_ACCEPTED", `${at}.${key}`);
      if (!propValueMatches(value, type))
        throw new CatalogValidationError("PROP_TYPE_MISMATCH", `${at}.${key}`);
    }
  }
  private validateTokenFields(
    fields: Readonly<Record<string, unknown>>,
    accepts: Readonly<Record<string, string>> | undefined,
    get: (id: string) => CatalogEntry | undefined,
    at: string,
  ): void {
    for (const [key, raw] of Object.entries(fields)) {
      const write = raw as { kind?: string; value?: AuthoredValue };
      const value = write?.kind === "set" ? write.value : raw;
      if (
        !value ||
        typeof value !== "object" ||
        (value as { kind?: string }).kind !== "token"
      )
        continue;
      const tokenId = (value as { tokenId: TokenId }).tokenId;
      const token = tokenId.startsWith("lib:")
        ? this.library.tokens.get(tokenId as `lib:token:${string}`)
        : get(tokenId);
      if (!token || !("tokenType" in token))
        throw new CatalogValidationError("DANGLING_TOKEN", tokenId);
      const actual = token.tokenType as TokenType;
      const allowed: readonly TokenType[] = accepts
        ? accepts[key] === "number"
          ? ["number"]
          : accepts[key] === "boolean"
            ? ["boolean"]
            : ["string"]
        : ["color", "backgroundColor", "borderColor", "fill"].includes(key)
          ? ["color"]
          : ["opacity", "fontWeight"].includes(key)
            ? ["number"]
            : [
                  "width",
                  "height",
                  "fontSize",
                  "radius",
                  "gap",
                  "padding",
                  "borderWidth",
                  "thumbSize",
                  "indentPerLevel",
                  "iconGap",
                ].includes(key)
              ? ["length", "number"]
              : ["string"];
      if (!allowed.includes(actual))
        throw new CatalogValidationError("TOKEN_TYPE_MISMATCH", `${at}.${key}`);
    }
  }
  private validateStateTokenRules(
    stateRules: Readonly<Record<string, unknown>> | undefined,
    get: (id: string) => CatalogEntry | undefined,
    at: string,
  ): void {
    if (!stateRules) return;
    for (const [state, fields] of Object.entries(stateRules))
      this.validateTokenFields(
        fields as Readonly<Record<string, unknown>>,
        undefined,
        get,
        `${at}.${state}`,
      );
  }
  private validateDefinitionCycles(
    get: (id: string) => CatalogEntry | undefined,
    entries: readonly CatalogEntry[],
  ): void {
    const definitions = entries.filter(
      (item): item is DefinitionEntry => item.kind === "definition",
    );
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string): void => {
      if (visiting.has(id))
        throw new CatalogValidationError("DEFINITION_CYCLE", id);
      if (visited.has(id)) return;
      visiting.add(id);
      const definition = get(id) as DefinitionEntry | undefined;
      if (definition?.templateRootId) {
        const walk = (nodeId: NodeId, seen: Set<NodeId>): void => {
          if (seen.has(nodeId)) return;
          seen.add(nodeId);
          const node = get(nodeId) as NodeEntry | undefined;
          if (!node) return;
          if (node.definitionId.startsWith("project:definition:"))
            visit(node.definitionId);
          for (const child of node.children) walk(child, seen);
        };
        walk(definition.templateRootId, new Set());
      }
      visiting.delete(id);
      visited.add(id);
    };
    for (const definition of definitions) visit(definition.id);
  }
  private indexFor(type: EdgeType): MutableIndex {
    if (type === "definition") return this.definitionIndex;
    if (type === "owner") return this.ownerIndex;
    if (type === "token") return this.tokenIndex;
    if (type === "ref") return this.refIndex;
    if (type === "htmlId") return this.htmlIdIndex;
    return this.collectionIndex;
  }
  private addEdge(edge: Edge): void {
    add(this.indexFor(edge.type), edge.key, edge.target);
    if (edge.type === "owner") this.ownerByChild.set(edge.target, edge.key);
  }
  private removeEdge(edge: Edge): void {
    remove(this.indexFor(edge.type), edge.key, edge.target);
    if (edge.type === "owner") this.ownerByChild.delete(edge.target);
  }
  collectAffectedIds(changedIds: readonly string[]): ReadonlySet<string> {
    const affected = new Set<string>();
    const queue = changedIds.map((id) => ({ id, expandChildren: true }));
    while (queue.length) {
      const { id, expandChildren } = queue.shift()!;
      if (affected.has(id)) continue;
      affected.add(id);
      for (const index of [
        this.definitionIndex,
        this.libraryDependents,
        this.tokenIndex,
        this.collectionIndex,
      ])
        for (const next of index.get(id) ?? [])
          if (!affected.has(next))
            queue.push({ id: next, expandChildren: false });
      if (expandChildren)
        for (const next of this.ownerIndex.get(id) ?? [])
          if (!affected.has(next))
            queue.push({ id: next, expandChildren: true });
      const overrideTarget = this.overrideTarget.get(
        id as EntryId<"definitionOverride">,
      );
      if (overrideTarget && !affected.has(overrideTarget))
        queue.push({ id: overrideTarget, expandChildren: false });
      const owner = this.ownerByChild.get(id);
      if (owner && !affected.has(owner))
        queue.push({ id: owner, expandChildren: false });
    }
    return affected;
  }
  /** Explicit cold path for export, never used by leaf mutation. */
  exportDocument(): CatalogDocument {
    return {
      format: "composition-catalog",
      schemaVersion: 1,
      libraryContractVersion: LIBRARY_CONTRACT_VERSION,
      revision: this.currentRevision,
      projectId: this.projectId,
      rootId: this.projectId,
      entries: Object.fromEntries(this.table),
    };
  }
  static emptyMetrics(): GraphMetrics {
    return {
      transactionEntryReads: 0,
      transactionEntriesTraversed: 0,
      transactionRecordReplacements: 0,
      transactionIndexEdgesUpdated: 0,
      transactionEntryTableClones: 0,
    };
  }
}

export function createCatalogGraph(
  value: unknown,
  library: CatalogLibrary,
): CatalogGraph {
  const document = validateCatalogDocument(value);
  // 로드 시 1회 S2 prop 전환 (2026-10-10) — storage 로드 · import · publish · preview snapshot 이
  // 전부 이 길을 지난다. 다음 변경의 autosave 가 전환된 형태를 저장한다.
  migrateCatalogEntriesS2(
    document.entries as Record<string, CatalogEntry>,
    library,
  );
  // ADR-257: a table Column's Styles width → its S2 width prop, a Cell's dropped.
  migrateCatalogTableColumns(
    document.entries as Record<string, CatalogEntry>,
    library,
  );
  return new CatalogGraph(document, library);
}
