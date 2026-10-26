import { catalogColorControlPropsError } from "./colorValue";
import { LIBRARY_CONTRACT_VERSION } from "./types";
import { catalogPropValueFits } from "./valueType";
import type {
  CatalogDocument,
  DataCollectionId,
  CatalogEntry,
  CatalogLibrary,
  DefinitionEntry,
  DefinitionId,
  EntryId,
  LibraryDefinition,
  LibraryDefinitionId,
  DefinitionOverrideEntry,
  InteractionEntry,
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
import { docCounters } from "../docCounters";
import { componentPropertiesOf } from "./componentProperties";
import { catalogChildKind } from "../nesting/nestingRules";
import {
  catalogBaseLibrary,
  forkedCatalogLibrary,
  originForksOf,
} from "./originFork";
import { parseRuleValueRef } from "../../interactions/valueRef";

export interface GraphIndexes {
  definitionToInstances: ReadonlyMap<DefinitionId, ReadonlySet<NodeId>>;
  ownerToChildren: ReadonlyMap<string, ReadonlySet<NodeId>>;
  childToOwner: ReadonlyMap<NodeId, string>;
  tokenToConsumers: ReadonlyMap<TokenId, ReadonlySet<string>>;
  collectionToBindings: ReadonlyMap<string, ReadonlySet<NodeId>>;
}
export interface GraphMetrics {
  transactionEntryReads: number;
  /**
   * Entries the transaction iterated beyond its direct reads (ADR-265 Phase 0 — this field was
   * declared and asserted 0 but never incremented): the stage's owner scans over the staged
   * records and the commit's swap loop. O(changed entries) — never the document.
   */
  transactionEntriesTraversed: number;
  transactionRecordReplacements: number;
  transactionIndexEdgesUpdated: number;
}
export interface CatalogHistoryRecord {
  label: string;
  revision: number;
  changedIds: readonly string[];
  removedIds: readonly string[];
}
type MutableIndex = Map<string, Set<string>>;
/** `ref`: any other by-ID reference (addresses, interaction/state owners and targets, theme tokens). */
/** `template`: a project definition → its template root (owned or, ADR-260, referenced). */
type EdgeType =
  | "definition"
  | "owner"
  | "token"
  | "collection"
  | "ref"
  | "htmlId"
  | "template";
interface Edge {
  type: EdgeType;
  key: string;
  target: string;
}

/** Every token id a value names (`{ kind: "token", tokenId }` at any depth). */
export function tokenRefs(value: unknown, target: Set<string>): void {
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
  // A definition owns its template root (ADR-279 — a component's origin lives on the Local page);
  // an unlocked library origin's override owns its template copy (ADR-282).
  if (entry.kind === "definition" || entry.kind === "definitionOverride")
    return entry.templateRootId ? [entry.templateRootId] : [];
  if (entry.kind !== "node") return [];
  const ids = [...entry.children];
  for (const override of entry.descendantOverrides) {
    if (override.kind === "replace") ids.push(override.replacementId);
    if (override.kind === "fillSlot") ids.push(...override.childIds);
  }
  return ids;
}
/**
 * ADR-284 — the collection a shared view reads through its source chain, or undefined when a
 * source is missing or the chain loops.
 */
export function catalogViewRootCollection(
  viewId: string,
  get: (id: string) => CatalogEntry | undefined,
  self?: CatalogEntry,
): DataCollectionId | undefined {
  const seen = new Set<string>();
  for (let id: string | undefined = viewId; id; ) {
    if (seen.has(id)) return undefined;
    seen.add(id);
    const view: CatalogEntry | undefined = id === self?.id ? self : get(id);
    if (view?.kind !== "view") return undefined;
    if ("collectionId" in view.source) return view.source.collectionId;
    id = view.source.viewId;
  }
  return undefined;
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
  if (entry.kind === "node") {
    for (const override of entry.descendantOverrides) address(override.address);
    // ADR-261 Decision 3: a slot's suggested project components.
    for (const id of entry.slot?.suggested ?? [])
      if (id.startsWith("project:")) ids.push(id);
  }
  // ADR-261 Decision 4: the origin nodes a component's properties drive.
  if (entry.kind === "definition")
    for (const property of entry.properties ?? []) {
      for (const target of property.targets) ids.push(target.id);
      // (Phase 5: an instance property's preferred project components.)
      for (const id of property.preferred ?? [])
        if (id.startsWith("project:")) ids.push(id);
    }
  if (entry.kind === "interaction") {
    ids.push(entry.ownerId);
    if (entry.address) address(entry.address);
    for (const action of entry.actions) {
      if (action.opcode === "navigate") ids.push(action.pageId);
      // ADR-283 Decision 3: every project id of a target's address (a swap · extraction · delete
      // of a middle step finds the rule), as the owner address.
      if (action.opcode === "capability") {
        const target = action.target;
        if ("nodeId" in target) ids.push(target.nodeId);
        else if ("address" in target) address(target.address);
        else if ("local" in target) address(target.local);
      }
      if (
        action.opcode === "setState" &&
        action.variableId.startsWith("project:")
      )
        ids.push(action.variableId);
    }
  }
  // ADR-284: the shared view a binding reads · a derived view's source view. (A condition's
  // `!var` · a sort variable are read when the view runs — as a rule's Value field, ADR-283.)
  if (entry.kind === "node" && entry.binding?.viewId)
    ids.push(entry.binding.viewId);
  if (entry.kind === "view" && "viewId" in entry.source)
    ids.push(entry.source.viewId);
  if (entry.kind === "stateVariable") {
    ids.push(entry.ownerId);
    // A named RAC state goes with its node (removed with it, never left observing nothing).
    if (entry.source) ids.push(entry.source.nodeId);
  }
  if (entry.kind === "theme") ids.push(...entry.tokenIds);
  if (entry.kind === "page" && entry.parentId) ids.push(entry.parentId);
  return ids;
}
/**
 * ADR-261 Decision 4 — a component's properties against the graph: every target is a node of the
 * component's origin subtree (the template root and what it owns, slot contents included); a text
 * target's prop is a string its contract takes; a boolean does not drive the root (it would hide
 * the whole instance); a key is not a prop the instance already takes from its root.
 */
function validateComponentProperties(
  definition: DefinitionEntry,
  get: (id: string) => CatalogEntry | undefined,
  contractOf: (
    definitionId: DefinitionId,
  ) => Pick<LibraryDefinition, "accepts"> | undefined,
): void {
  const rootId = definition.templateRootId;
  const inOrigin = new Set<string>();
  const parentOf = new Map<string, string>();
  const queue = rootId ? [rootId] : [];
  while (queue.length) {
    const id = queue.pop()!;
    if (inOrigin.has(id)) continue;
    inOrigin.add(id);
    const entry = get(id);
    if (entry?.kind === "node")
      for (const child of ownedChildren(entry)) {
        if (!parentOf.has(child)) parentOf.set(child, id);
        queue.push(child);
      }
  }
  const root = rootId ? get(rootId) : undefined;
  const rootAccepts =
    root?.kind === "node" ? contractOf(root.definitionId)?.accepts : undefined;
  // (Phase 5: a swapped nested instance is a new node — a text property cannot reach it there.)
  const swapped = new Set<string>(
    (definition.properties ?? [])
      .filter((property) => property.kind === "instance")
      .flatMap((property) => property.targets.map((target) => target.id)),
  );
  for (const property of definition.properties ?? []) {
    if (rootAccepts && property.key in rootAccepts)
      throw new CatalogValidationError("PROPERTY_KEY_TAKEN", property.key);
    for (const id of property.preferred ?? [])
      if (!contractOf(id as DefinitionId))
        throw new CatalogValidationError("DANGLING_DEFINITION", id);
    for (const target of property.targets) {
      const node = get(target.id);
      if (node?.kind !== "node")
        throw new CatalogValidationError("DANGLING_PROPERTY_TARGET", target.id);
      if (!inOrigin.has(target.id))
        throw new CatalogValidationError("PROPERTY_TARGET_OUTSIDE", target.id);
      if (property.kind !== "text" && target.id === rootId)
        throw new CatalogValidationError("PROPERTY_TARGET_ROOT", target.id);
      if (property.kind === "text" && swapped.has(target.id))
        throw new CatalogValidationError("PROPERTY_TARGET_SWAPPED", target.id);
      // (A nested instance's own property is not a target: exposing nested instances' properties
      // is out of scope — review m2: deleting that inner property left the outer one invalid.)
      if (
        property.kind === "text" &&
        componentPropertiesOf(get(node.definitionId))?.some(
          (inner) => inner.key === target.prop,
        )
      )
        throw new CatalogValidationError(
          "PROPERTY_TARGET_NESTED_PROPERTY",
          `${target.id}.${target.prop}`,
        );
      if (
        property.kind === "text" &&
        contractOf(node.definitionId)?.accepts[target.prop!] !== "string"
      )
        throw new CatalogValidationError(
          "PROPERTY_PROP_NOT_TEXT",
          `${target.id}.${target.prop}`,
        );
    }
  }
  // (Codex M2: a swapped layer is copied with what it holds — a swap target inside another one
  // would no longer be reached by an instance; one swap layer is not inside another.)
  for (const id of swapped)
    for (
      let cursor = parentOf.get(id);
      cursor !== undefined;
      cursor = parentOf.get(cursor)
    )
      if (swapped.has(cursor))
        throw new CatalogValidationError("PROPERTY_TARGET_NESTED", id);
}
function edgesOf(entry: CatalogEntry, withOwner = true): Edge[] {
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
  if (withOwner)
    for (const child of ownedChildren(entry))
      edges.push({ type: "owner", key: entry.id, target: child });
  if (entry.kind === "definition" && entry.templateRootId)
    edges.push({
      type: "template",
      key: entry.templateRootId,
      target: entry.id,
    });
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
/** A prop that is one template binding (`"{isDisabled}"` — the resolver's `WHOLE_TEMPLATE_BINDING`). */
const WHOLE_TEMPLATE_BINDING = /^\{([a-zA-Z][a-zA-Z0-9_-]*)\}$/;
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
function deepFreeze(item: unknown): void {
  if (!item || typeof item !== "object" || Object.isFrozen(item)) return;
  for (const child of Object.values(item)) deepFreeze(child);
  Object.freeze(item);
}
/**
 * A frozen copy the caller cannot change. A field the staged record shares with the committed
 * record it replaces (`previous` — frozen all the way down) is kept, not copied (ADR-265: a style
 * edit of a 5k-child body copied its child list on every commit).
 */
function ownedRecord<T>(value: T, previous?: T): T {
  if (
    !previous ||
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !Object.isFrozen(previous)
  ) {
    const copy = structuredClone(value);
    deepFreeze(copy);
    return copy;
  }
  const kept = previous as Record<string, unknown>;
  const copy: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value))
    copy[key] =
      field !== null && typeof field === "object" && field === kept[key]
        ? field
        : structuredClone(field);
  deepFreeze(copy);
  return copy as T;
}
/** Two id lists hold the same ids in the same order. */
function sameIdList(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
/** Two records of one entry own the same children (their owner edges are the same). */
function sameOwnedChildren(a: CatalogEntry, b: CatalogEntry): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "node" && b.kind === "node")
    return a.descendantOverrides === b.descendantOverrides
      ? sameIdList(a.children, b.children)
      : sameIdList(ownedChildren(a), ownedChildren(b));
  if (a.kind === "page" && b.kind === "page")
    return sameIdList(a.children, b.children);
  return sameIdList(ownedChildren(a), ownedChildren(b));
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
  private readonly templateIndex: MutableIndex = new Map();
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
  };
  readonly projectId: EntryId<"project">;
  /** The code library (no document's forks). */
  readonly codeLibrary: CatalogLibrary;
  private forkedLibrary: CatalogLibrary | undefined;

  constructor(document: CatalogDocument, library: CatalogLibrary) {
    validateCatalogDocument(document);
    library = catalogBaseLibrary(library);
    assertCatalogLibrary(library);
    if (document.libraryContractVersion !== library.contractVersion)
      throw new CatalogValidationError(
        "UNSUPPORTED_LIBRARY_CONTRACT",
        "document.libraryContractVersion",
      );
    this.projectId = document.projectId;
    this.codeLibrary = library;
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
  /**
   * The library as the committed document reads it (ADR-282 — an unlocked origin's template is the
   * copy its override owns; `forkedCatalogLibrary`). Rebuilt after a commit that changes an override.
   */
  get library(): CatalogLibrary {
    return (this.forkedLibrary ??= forkedCatalogLibrary(
      this.codeLibrary,
      originForksOf((id) => this.table.get(id), this.projectId),
    ));
  }
  /** The library as `get` reads the document (a staged transaction's view — ADR-282). */
  libraryFor(get: (id: string) => CatalogEntry | undefined): CatalogLibrary {
    return forkedCatalogLibrary(
      this.codeLibrary,
      originForksOf(get, this.projectId),
    );
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
    const stored = this.table.get(id);
    if (!stored) return this.viewEntries.get(id)?.();
    const drawn = this.viewChildren.get(id);
    if (!drawn || stored.kind !== "node") return stored;
    const ids = drawn.compute();
    if (!ids.length) return stored;
    const at = Math.min(drawn.at, stored.children.length);
    return {
      ...stored,
      children: [
        ...stored.children.slice(0, at),
        ...ids,
        ...stored.children.slice(at),
      ],
    };
  }
  private readonly viewChildren = new Map<
    string,
    { at: number; compute: () => readonly NodeId[] }
  >();
  /**
   * ADR-282 Phase 3 — children a view draws in a stored node, after its first `at` children (a
   * Components page ◆ cell: its origin's sample, or the template root a definition or an
   * override owns — a card that holds its ◆ draws it after its title). Read like the node's
   * children, never part of the document — the transaction stage drops them from every write
   * (`viewChildIds`), and exports, saves and indexes read the stored node. `undefined` removes it.
   */
  setViewChildren(
    id: NodeId,
    at: number,
    compute?: () => readonly NodeId[],
  ): void {
    if (compute) this.viewChildren.set(id, { at, compute });
    else this.viewChildren.delete(id);
  }
  private commandView: CatalogGraph | undefined;
  /**
   * ADR-282 Phase 3 — the graph as commands and transactions read it: stored entries and view
   * entries, without the children a view draws in a stored node (`setViewChildren`). A command
   * that walks a ◆ cell (deletes its card, rewrites addresses) must not take the origin it draws.
   */
  get commandReader(): CatalogGraph {
    return (this.commandView ??= new Proxy(this, {
      get: (target, key) => {
        if (key === "getEntry")
          return (id: string) =>
            target.table.get(id) ?? target.viewEntries.get(id)?.();
        if (key === "commandReader") return target.commandView;
        const value = Reflect.get(target, key, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    }));
  }
  /** A document entry as stored (no view entry, no view children). */
  storedEntry(id: string): CatalogEntry | undefined {
    return this.table.get(id);
  }
  /** The stored nodes a view adds children to (their rows follow the view's relayout). */
  viewChildNodeIds(): readonly string[] {
    return [...this.viewChildren.keys()];
  }
  /** The view children `getEntry` adds to a stored node (none = `undefined`). */
  viewChildIds(id: string): readonly NodeId[] | undefined {
    return this.viewChildren.get(id)?.compute();
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
  private originDisplay: ReadonlyMap<
    string,
    Readonly<Record<string, string>>
  > = new Map();
  /**
   * ADR-282 — what the open derived page shows for an origin's template text no prop binds (the
   * Library card's item ◆: a MenuItem's `{label}` — its holder fills it — as its sample's
   * "Item"). Display only: the resolver reads it for an unlocked origin's copy root resolved
   * itself (the ◆), never for an instance.
   */
  setOriginDisplayBindings(
    bindings: ReadonlyMap<string, Readonly<Record<string, string>>>,
  ): void {
    this.originDisplay = bindings;
  }
  originDisplayBindings(
    definitionId: string,
  ): Readonly<Record<string, string>> | undefined {
    return this.originDisplay.get(definitionId);
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
    for (const [id, entry] of staged) {
      if (
        process.env.NODE_ENV === "development" &&
        entry &&
        "children" in entry &&
        Array.isArray(entry.children) &&
        (this.table.get(id) as { children?: unknown } | undefined)
          ?.children !== entry.children
      )
        docCounters.commitChildrenCloned += entry.children.length;
      prepared.set(
        id,
        entry === null ? null : ownedRecord(entry, this.table.get(id)),
      );
    }
    const previous = new Map<string, CatalogEntry | null>();
    for (const id of staged.keys())
      previous.set(id, this.table.get(id) ?? null);
    const newlyDirty = [...staged.keys()].filter((id) => !this.dirty.has(id));
    const previousMetrics = this.lastMetrics;
    metrics.transactionIndexEdgesUpdated += this.replace(prepared);
    metrics.transactionEntriesTraversed += prepared.size;
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
    let enumerated = 0;
    // An entry that owns the same children before and after keeps its owner edges: they would be
    // listed on both sides and cancel (ADR-265 — a body's 5k owner edges, twice, per style edit).
    const sameOwner = new Set<string>();
    for (const [id, entry] of next) {
      const old = this.table.get(id);
      if (old && entry && sameOwnedChildren(old, entry)) sameOwner.add(id);
    }
    for (const id of next.keys()) {
      const entry = this.table.get(id);
      if (entry)
        for (const edge of edgesOf(entry, !sameOwner.has(id))) {
          enumerated++;
          oldEdges.set(edgeKey(edge), edge);
        }
    }
    for (const [id, entry] of next)
      if (entry)
        for (const edge of edgesOf(entry, !sameOwner.has(id))) {
          enumerated++;
          nextEdges.set(edgeKey(edge), edge);
        }
    if (process.env.NODE_ENV === "development")
      docCounters.replaceEdges += enumerated;
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
        if (old.templateRootId) this.forkedLibrary = undefined;
      }
      if (entry === null) this.table.delete(id);
      else this.table.set(id, entry);
      if (entry?.kind === "definitionOverride") {
        this.overrideIndex.set(entry.targetId, entry.id);
        this.overrideTarget.set(entry.id, entry.targetId);
        if (entry.templateRootId) this.forkedLibrary = undefined;
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
  /**
   * The definition whose template root `id` is (the reverse of `templateRootId`): a project
   * definition, or an unlocked library origin whose override owns `id` (ADR-282).
   */
  definitionOfTemplateRoot(id: string): DefinitionId | undefined {
    const found = this.templateIndex.get(id);
    if (found) return found.values().next().value as EntryId<"definition">;
    const owner = this.ownerByChild.get(id);
    const entry = owner ? this.table.get(owner) : undefined;
    return entry?.kind === "definitionOverride" && entry.templateRootId === id
      ? entry.targetId
      : undefined;
  }
  /** Committed nodes bound to a data collection (the Data panel's usage, no scan). */
  bindingsOf(collectionId: string): ReadonlySet<string> {
    return this.collectionIndex.get(collectionId) ?? new Set();
  }
  /** Whether any committed node is bound to a data collection (a bound-row lookup skips otherwise). */
  hasBoundNodes(): boolean {
    for (const ids of this.collectionIndex.values()) if (ids.size) return true;
    return false;
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
    library: CatalogLibrary = this.libraryFor(get),
  ): void {
    const root = get(this.projectId);
    if (root?.kind !== "project")
      throw new CatalogValidationError("PROJECT_ROOT_REQUIRED", this.projectId);
    const listedIds = (): Set<string> => {
      const listed = new Set<string>();
      for (const ids of [
        root.pageIds,
        root.componentPageIds ?? [],
        root.definitionIds,
        root.overrideIds,
        root.themeIds,
        root.tokenIds,
        root.stateVariableIds,
        root.interactionIds,
        root.assetIds,
        root.viewIds ?? [],
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
        // ADR-260: a subtree placed inside a referenced origin (its chain ends at a page) may
        // hold an instance of that origin's definition too.
        if (this.templateIndex.has(cursor)) definitionsChanged = true;
        top = cursor;
      }
      // A subtree placed inside a template may contain an instance of that template.
      const topKind = get(top)?.kind;
      if (topKind === "definition" || topKind === "definitionOverride")
        definitionsChanged = true;
    }
    // Committed entries whose references read a staged record are re-validated.
    const referrers = new Set<string>();
    for (const [id, entry] of staged) {
      for (const index of [
        this.definitionIndex,
        this.tokenIndex,
        this.refIndex,
        this.templateIndex,
      ])
        for (const referrer of index.get(id) ?? []) referrers.add(referrer);
      const before = this.table.get(id);
      if (entry?.kind === "definition" || before?.kind === "definition")
        definitionsChanged = true;
      // A template root read by reference (ADR-260) carries the instance contract the same way.
      for (const definition of this.templateIndex.get(id) ?? [])
        if (!staged.has(definition)) {
          definitionsChanged = true;
          for (const instance of this.instancesOf(definition))
            referrers.add(instance);
        }
      if (entry?.kind === "definition" && entry.templateRootId) {
        const root = entry.templateRootId;
        const others = [...(this.templateIndex.get(root) ?? [])].filter(
          (other) =>
            other !== id &&
            (!staged.has(other) ||
              (staged.get(other) as DefinitionEntry | null)?.templateRootId ===
                root),
        );
        for (const [otherId, other] of staged)
          if (
            otherId !== id &&
            other?.kind === "definition" &&
            other.templateRootId === root &&
            !others.includes(otherId)
          )
            others.push(otherId);
        if (others.length)
          throw new CatalogValidationError("DUPLICATE_TEMPLATE_ROOT", root);
      }
      // A template root carries its definition's instance contract (an unlocked origin's copy
      // root its origin's — ADR-282).
      for (const owner of [ownerAfter(id), this.ownerByChild.get(id)]) {
        const ownerEntry = owner ? get(owner) : undefined;
        if (ownerEntry?.kind === "definition") {
          definitionsChanged = true;
          for (const instance of this.instancesOf(ownerEntry.id))
            referrers.add(instance);
        } else if (
          ownerEntry?.kind === "definitionOverride" &&
          ownerEntry.templateRootId === id
        ) {
          definitionsChanged = true;
          for (const instance of this.instancesOf(ownerEntry.targetId))
            referrers.add(instance);
        }
      }
      if (
        entry?.kind === "definitionOverride" ||
        before?.kind === "definitionOverride"
      )
        definitionsChanged = true;
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
      if (entry) this.validateEntryReferences(entry, get, library, ownerAfter);
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
      this.validateDefinitionCycles(get, definitions, library);
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
      root.componentPageIds ?? [],
      root.definitionIds,
      root.overrideIds,
      root.themeIds,
      root.tokenIds,
      root.stateVariableIds,
      root.interactionIds,
      root.assetIds,
      root.viewIds ?? [],
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
    const templateRoots = new Set<string>();
    const overrides = new Set<string>();
    const entryIds = new Set(entries.map((entry) => entry.id));
    // (The owners as the view reads them, for the copy of an unlocked origin — ADR-282 R7.)
    const ownerInView = new Map<string, string>();
    for (const entry of entries)
      for (const child of ownedChildren(entry)) ownerInView.set(child, entry.id);
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
      if (entry.kind === "definition" && entry.templateRootId) {
        if (templateRoots.has(entry.templateRootId))
          throw new CatalogValidationError(
            "DUPLICATE_TEMPLATE_ROOT",
            entry.templateRootId,
          );
        templateRoots.add(entry.templateRootId);
      }
      const children = ownedChildren(entry);
      for (const child of children) {
        if (owners.has(child))
          throw new CatalogValidationError("DUPLICATE_OWNERSHIP", child);
        owners.set(child, entry.id);
        if (get(child)?.kind !== "node")
          throw new CatalogValidationError("DANGLING_CHILD", child);
      }
      this.validateEntryReferences(entry, get, this.library, (id) =>
        ownerInView.get(id),
      );
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
    /** The library as `get` reads the document (ADR-282 — a transaction's staged forks). */
    library: CatalogLibrary = this.library,
    /** Owner of a node as `get` reads the document (an unlocked origin's copy — ADR-282 R7). */
    ownerOf: (id: string) => string | undefined = (id) => this.ownerOf(id),
  ): void {
    const lookupDefinition = (id: DefinitionId) =>
      id.startsWith("lib:")
        ? library.definitions.get(id as `lib:definition:${string}`)
        : (get(id) as DefinitionEntry | undefined);
    /**
     * ADR-282 Decision 8 — a node of an unlocked origin's copy keeps the library template's
     * bindings (`"{isDisabled}"`): the accepts of the origin whose copy holds it (owner chain).
     */
    const forkOriginAccepts = (id: string) => {
      const seen = new Set<string>();
      for (
        let cursor = ownerOf(id);
        cursor && !seen.has(cursor);
        cursor = ownerOf(cursor)
      ) {
        seen.add(cursor);
        const owner = get(cursor);
        if (owner?.kind === "definitionOverride")
          return library.definitions.get(owner.targetId)?.accepts;
        if (owner?.kind !== "node") return undefined;
      }
      return undefined;
    };
    // A composite instance is its template root: it takes the root's props plus its schema.
    const contractOf = (definition: DefinitionEntry | LibraryDefinition) =>
      instanceContract(
        definition as LibraryDefinition,
        (id) => lookupDefinition(id as DefinitionId) as LibraryDefinition,
        (id) =>
          id.startsWith("lib:")
            ? library.templates.get(id as `lib:template:${string}`)
            : (get(id) as { definitionId: string } | undefined),
      );
    if (entry.kind === "node") {
      const found = lookupDefinition(entry.definitionId);
      if (!found)
        throw new CatalogValidationError(
          "DANGLING_DEFINITION",
          entry.definitionId,
        );
      for (const id of entry.slot?.suggested ?? [])
        if (!lookupDefinition(id))
          throw new CatalogValidationError("DANGLING_DEFINITION", id);
      const definition = { ...found, ...contractOf(found) };
      this.validatePropWrites(entry.props, definition.accepts, entry.id, () =>
        forkOriginAccepts(entry.id),
      );
      this.validatePropChoices(entry.props, definition, get, entry.id, () =>
        forkOriginAccepts(entry.id),
      );
      // ADR-258 Decision 8 — the last line: a color space · channel combination RAC throws on
      //   (the panel and the AI normalize before writing; import · paste · direct commands land here).
      const colorError = catalogColorControlPropsError(
        found.name.split("/")[0],
        Object.fromEntries(
          Object.entries(entry.props)
            .filter(([, write]) => write.kind === "set")
            .map(([key, write]) => [key, (write as { value?: unknown }).value]),
        ),
      );
      if (colorError)
        throw new CatalogValidationError(
          "PROP_COMBINATION_MISMATCH",
          `${entry.id}: ${colorError}`,
        );
      this.validateTokenFields(entry.props, definition.accepts, get, entry.id);
      this.validateTokenFields(entry.visual, undefined, get, entry.id);
      this.validateStateTokenRules(entry.stateRules, get, entry.id);
      for (const override of entry.descendantOverrides) {
        const target = validateInstanceAddress(
          entry,
          override.address,
          get,
          library,
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
        if (override.kind !== "replace") {
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
      // ADR-284: a shared view the binding reads is a view over the binding's collection.
      if (entry.binding?.viewId) {
        const root = catalogViewRootCollection(entry.binding.viewId, get);
        if (!root)
          throw new CatalogValidationError(
            "DANGLING_VIEW",
            entry.binding.viewId,
          );
        if (root !== entry.binding.collectionId)
          throw new CatalogValidationError(
            "VIEW_COLLECTION_MISMATCH",
            entry.id,
          );
      }
    }
    // ADR-284: a derived view's source is a shared view, never a cycle.
    if (entry.kind === "view" && !catalogViewRootCollection(entry.id, get, entry))
      throw new CatalogValidationError("DANGLING_VIEW", entry.id);
    if (entry.kind === "definition" || entry.kind === "definitionOverride") {
      if (
        entry.kind === "definition" &&
        entry.bindingId &&
        !library.execution.bindingIds.has(entry.bindingId)
      )
        throw new CatalogValidationError("UNKNOWN_BINDING_ID", entry.bindingId);
      if (entry.kind === "definitionOverride") {
        const target = library.definitions.get(entry.targetId);
        if (!target)
          throw new CatalogValidationError(
            "DANGLING_DEFINITION",
            entry.targetId,
          );
        this.validatePropWrites(entry.defaults, target.accepts, entry.id);
        this.validatePropChoices(entry.defaults, target, get, entry.id);
        if (entry.templateRootId) {
          // ADR-282: the copy stands for the origin's library template — its root is the library
          // root's type, every mapped node is a node, every key a node of the library template.
          const libraryRoot = this.codeLibrary.definitions.get(entry.targetId)
            ?.templateRootId as `lib:template:${string}` | undefined;
          const root = get(entry.templateRootId);
          if (
            !libraryRoot ||
            root?.kind !== "node" ||
            root.definitionId !==
              this.codeLibrary.templates.get(libraryRoot)?.definitionId ||
            entry.templateMap?.[libraryRoot] !== entry.templateRootId
          )
            throw new CatalogValidationError(
              "INVALID_ORIGIN_TEMPLATE_ROOT",
              entry.id,
            );
          for (const [templateId, nodeId] of Object.entries(
            entry.templateMap ?? {},
          ))
            if (
              !this.codeLibrary.templates.has(
                templateId as `lib:template:${string}`,
              ) ||
              get(nodeId)?.kind !== "node"
            )
              throw new CatalogValidationError(
                "INVALID_ORIGIN_TEMPLATE_ROOT",
                `${entry.id}.${templateId}`,
              );
        }
        this.validateTokenFields(entry.defaults, target.accepts, get, entry.id);
        this.validateTokenFields(entry.visual, undefined, get, entry.id);
        this.validateStateTokenRules(entry.stateRules, get, entry.id);
      }
      if (entry.kind === "definition") {
        this.validatePropValues(entry.defaults, entry.accepts, entry.id);
        this.validateTokenFields(entry.defaults, entry.accepts, get, entry.id);
        this.validateTokenFields(entry.visual, undefined, get, entry.id);
        this.validateStateTokenRules(entry.stateRules, get, entry.id);
        if (entry.properties?.length)
          validateComponentProperties(entry, get, (definitionId) => {
            const found = lookupDefinition(definitionId);
            return found ? contractOf(found) : undefined;
          });
      }
    }
    if (entry.kind === "interaction") {
      const owner = get(entry.ownerId);
      if (owner?.kind !== "node")
        throw new CatalogValidationError("DANGLING_OWNER", entry.ownerId);
      if (entry.address)
        validateInstanceAddress(owner, entry.address, get, library);
      if (!library.execution.triggerIds.has(entry.trigger))
        throw new CatalogValidationError("UNKNOWN_TRIGGER_ID", entry.trigger);
      // ADR-284 Decision 8 — a rule's Do list: at least one, each checked as one rule was.
      if (!entry.actions.length)
        throw new CatalogValidationError("EMPTY_ACTIONS", entry.id);
      for (const action of entry.actions) {
        if (!library.execution.actionOpCodes.has(action.opcode))
          throw new CatalogValidationError(
            "UNKNOWN_ACTION_OPCODE",
            action.opcode,
          );
        if (
          action.opcode === "navigate" &&
          get(action.pageId)?.kind !== "page"
        )
          throw new CatalogValidationError("DANGLING_PAGE", action.pageId);
        if (action.opcode === "capability") {
          validateCapabilityTarget(entry, action, get, library, ownerOf);
          if (
            !library.execution.capabilityIds.has(action.capabilityId)
          )
            throw new CatalogValidationError(
              "UNKNOWN_CAPABILITY_ID",
              action.capabilityId,
            );
        }
        if (
          action.opcode === "setState" &&
          action.variableId.startsWith("project:") &&
          get(action.variableId)?.kind !== "stateVariable"
        )
          throw new CatalogValidationError(
            "DANGLING_VARIABLE",
            action.variableId,
          );
        if (
          action.opcode === "setState" &&
          action.variableId.startsWith("project:")
        ) {
          const variable = get(action.variableId);
          if (variable?.kind === "stateVariable") {
            // (A reference — `!event` · `!item` · `!var` — is checked when the rule runs; a structured
            //   variable takes only references, or `""` to empty it.)
            const value = action.value;
            if (
              action.op === "set" &&
              !parseRuleValueRef(value) &&
              (variable.valueType === "object" || variable.valueType === "array"
                ? value !== ""
                : typeof value !== variable.valueType)
            )
              throw new CatalogValidationError(
                "STATE_VALUE_TYPE",
                action.variableId,
              );
            // (ADR-284 Phase 6 — a text variable toggles to a text value and back.)
            if (
              action.op === "toggle" &&
              !(variable.valueType === "boolean" && action.value === undefined) &&
              !(
                variable.valueType === "string" &&
                typeof action.value === "string"
              )
            )
              throw new CatalogValidationError(
                "STATE_OP_TYPE",
                action.variableId,
              );
            if (
              action.op === "increment" &&
              variable.valueType !== "number"
            )
              throw new CatalogValidationError(
                "STATE_OP_TYPE",
                action.variableId,
              );
          }
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
        ? library.tokens.get(token as `lib:token:${string}`)
        : (get(token) as { kind: string } | undefined);
      if (!found || ("kind" in found && found.kind !== "token"))
        throw new CatalogValidationError("DANGLING_TOKEN", token);
    }
  }

  private validatePropWrites(
    props: Readonly<Record<string, { kind: string; value?: unknown }>>,
    accepts: Readonly<Record<string, string>>,
    at: string,
    /** The accepts a whole `{key}` binding may name (an unlocked origin's copy — ADR-282). */
    bindingAccepts?: () => Readonly<Record<string, string>> | undefined,
  ): void {
    for (const [key, write] of Object.entries(props)) {
      const type = accepts[key];
      if (!type)
        throw new CatalogValidationError("PROP_NOT_ACCEPTED", `${at}.${key}`);
      if (write.kind === "set" && !propValueMatches(write.value, type)) {
        // (One binding of the origin's prop of the same type — the library template rule.)
        const bound =
          typeof write.value === "string"
            ? WHOLE_TEMPLATE_BINDING.exec(write.value)
            : null;
        if (bound && bindingAccepts?.()?.[bound[1]] === type) continue;
        throw new CatalogValidationError("PROP_TYPE_MISMATCH", `${at}.${key}`);
      }
    }
  }
  private validatePropChoices(
    props: Readonly<Record<string, { kind: string; value?: unknown }>>,
    definition: DefinitionEntry | LibraryDefinition,
    get: (id: string) => CatalogEntry | undefined,
    at: string,
    /** The accepts a whole `{key}` binding may name (an unlocked origin's copy — ADR-282). */
    bindingAccepts?: () => Readonly<Record<string, string>> | undefined,
  ): void {
    if (!("propChoices" in definition) || !definition.propChoices) return;
    for (const [key, choices] of Object.entries(definition.propChoices)) {
      const write = props[key];
      if (write?.kind !== "set") continue;
      const raw = write.value;
      // (One binding of the origin's prop of the same type: the instance's value is checked there.)
      const bound =
        typeof raw === "string" ? WHOLE_TEMPLATE_BINDING.exec(raw) : null;
      if (
        bound &&
        bindingAccepts?.()?.[bound[1]] === definition.accepts[key]
      )
        continue;
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
    library: CatalogLibrary = this.library,
  ): void {
    const definitions = entries.filter(
      (item): item is DefinitionEntry => item.kind === "definition",
    );
    // ADR-282: an unlocked origin's copy is its template — a copy holding an instance of an origin
    // whose template reaches it back (directly, or through a library template — the Select's
    // Button part) is a cycle. Library templates are walked only when the document has forks.
    const project = get(this.projectId);
    const forks = (project?.kind === "project" ? project.overrideIds : [])
      .map((id) => get(id))
      .filter(
        (item): item is DefinitionOverrideEntry =>
          item?.kind === "definitionOverride" && !!item.templateRootId,
      );
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string): void => {
      if (visiting.has(id))
        throw new CatalogValidationError("DEFINITION_CYCLE", id);
      if (visited.has(id)) return;
      visiting.add(id);
      const rootId = id.startsWith("lib:")
        ? library.definitions.get(id as LibraryDefinitionId)?.templateRootId
        : (get(id) as DefinitionEntry | undefined)?.templateRootId;
      if (rootId) {
        const walk = (nodeId: string, seen: Set<string>): void => {
          if (seen.has(nodeId)) return;
          seen.add(nodeId);
          if (process.env.NODE_ENV === "development")
            docCounters.definitionCycleChecks += 1;
          if (nodeId.startsWith("lib:")) {
            const template = library.templates.get(
              nodeId as `lib:template:${string}`,
            );
            if (!template) return;
            visit(template.definitionId);
            for (const child of template.children) walk(child, seen);
            return;
          }
          const node = get(nodeId) as NodeEntry | undefined;
          if (!node) return;
          if (
            node.definitionId.startsWith("project:definition:") ||
            (forks.length && node.definitionId.startsWith("lib:"))
          )
            visit(node.definitionId);
          // Every child the template projects: its children and its `replace` · `fillSlot`
          // nodes (ADR-260 Decision 12 — a self instance in a slot fill is a cycle too).
          for (const child of ownedChildren(node)) walk(child, seen);
        };
        walk(rootId, new Set());
      }
      visiting.delete(id);
      visited.add(id);
    };
    for (const definition of definitions) visit(definition.id);
    for (const fork of forks) visit(fork.targetId);
  }
  private indexFor(type: EdgeType): MutableIndex {
    if (type === "definition") return this.definitionIndex;
    if (type === "owner") return this.ownerIndex;
    if (type === "token") return this.tokenIndex;
    if (type === "ref") return this.refIndex;
    if (type === "htmlId") return this.htmlIdIndex;
    if (type === "template") return this.templateIndex;
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
    const counting = process.env.NODE_ENV === "development";
    if (counting) docCounters.affectedCalls += 1;
    // A read pointer, not `shift()` (ADR-265 C1 — a container's subtree queues thousands).
    for (let head = 0; head < queue.length; head++) {
      const { id, expandChildren } = queue[head]!;
      if (counting) docCounters.affectedVisited += 1;
      if (affected.has(id)) continue;
      affected.add(id);
      for (const index of [
        this.definitionIndex,
        this.libraryDependents,
        this.tokenIndex,
        this.collectionIndex,
        // ADR-260: an origin in place is not owned by its definition — reach it by the root.
        this.templateIndex,
      ])
        for (const next of index.get(id) ?? [])
          if (!affected.has(next))
            queue.push({ id: next, expandChildren: false });
      if (expandChildren)
        for (const next of this.ownerIndex.get(id) ?? [])
          if (!affected.has(next)) {
            if (counting) docCounters.affectedSubtree += 1;
            queue.push({ id: next, expandChildren: true });
          }
      const overrideTarget = this.overrideTarget.get(
        id as EntryId<"definitionOverride">,
      );
      if (overrideTarget && !affected.has(overrideTarget))
        queue.push({ id: overrideTarget, expandChildren: false });
      const owner = this.ownerByChild.get(id);
      if (owner && !affected.has(owner))
        queue.push({ id: owner, expandChildren: false });
    }
    if (counting) docCounters.affectedResult += affected.size;
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

/**
 * ADR-283 Decision 1 · 3 — a capability target names a drawn place: a page node (a template's only
 * from a rule of that template — drawn once per instance, the firing origin says which), a position of an
 * authored instance (`address`, its first step an authored node), or a position of the origin
 * whose template holds the rule's owner (`local`). `unset` names nothing.
 */
function validateCapabilityTarget(
  entry: InteractionEntry,
  action: InteractionEntry["actions"][number],
  get: (id: string) => CatalogEntry | undefined,
  library: CatalogLibrary,
  ownerOf: (id: string) => string | undefined,
): void {
  if (action.opcode !== "capability") return;
  const target = action.target;
  /** The definition whose template holds `id` (owner chain top), else undefined. */
  const templateDefinitionOf = (id: string): DefinitionId | undefined => {
    const seen = new Set<string>();
    for (let cursor = ownerOf(id); cursor && !seen.has(cursor); cursor = ownerOf(cursor)) {
      seen.add(cursor);
      const owner = get(cursor);
      if (owner?.kind === "definition") return owner.id;
      if (owner?.kind === "definitionOverride") return owner.targetId;
      if (owner?.kind !== "node") return undefined;
    }
    return undefined;
  };
  if ("unset" in target) return;
  if ("nodeId" in target) {
    if (get(target.nodeId)?.kind !== "node")
      throw new CatalogValidationError("DANGLING_TARGET", target.nodeId);
    // (A template node is drawn once per instance: only a rule of that same template names it by
    // id — the firing record's origin says which; elsewhere `address` · `local` do.)
    const template = templateDefinitionOf(target.nodeId);
    if (template && template !== templateDefinitionOf(entry.ownerId))
      throw new CatalogValidationError("TARGET_IN_TEMPLATE", target.nodeId);
    return;
  }
  if ("address" in target) {
    const first = get(target.address.instances[0]!);
    if (first?.kind !== "node" || templateDefinitionOf(first.id))
      throw new CatalogValidationError(
        "DANGLING_TARGET",
        target.address.instances[0]!,
      );
    validateInstanceAddress(first, target.address, get, library);
    return;
  }
  const definitionId = templateDefinitionOf(entry.ownerId);
  if (!definitionId)
    throw new CatalogValidationError("TARGET_LOCAL_OUTSIDE_TEMPLATE", entry.id);
  const anchor = {
    kind: "node",
    id: "catalog:local-target" as NodeId,
    definitionId,
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  } as NodeEntry;
  validateInstanceAddress(
    anchor,
    {
      instances: [anchor.id, ...target.local.instances],
      templatePath: target.local.templatePath,
    },
    get,
    library,
  );
}
