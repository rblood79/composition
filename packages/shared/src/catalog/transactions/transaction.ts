import type {
  CatalogEntry,
  CatalogLibrary,
  CatalogReader,
  LayoutField,
  ResponsiveBreakpointName,
  DataBindingRef,
  DescendantOverride,
  EntryId,
  StateName,
  NodeEntry,
  NodeId,
  NodePlacement,
  SizingField,
  VisualField,
  WriteValue,
  AuthoredValue,
} from "../document/types";
import { CatalogGraph, ownedChildren, referencedIds } from "../document/graph";
import {
  validateCatalogEntry,
  CatalogValidationError,
} from "../document/validation";

export type CatalogOperation =
  | { kind: "put"; entry: CatalogEntry }
  | { kind: "remove"; id: EntryId }
  | {
      kind: "patchNodeProp";
      id: NodeId;
      key: string;
      write: WriteValue<AuthoredValue>;
    }
  | {
      kind: "patchNodeVisual";
      id: NodeId;
      key: VisualField;
      write: WriteValue<AuthoredValue>;
      /** Absent = the base (desktop) layer. */
      breakpoint?: ResponsiveBreakpointName;
    }
  | {
      kind: "patchNodeSizing";
      id: NodeId;
      key: SizingField;
      write: WriteValue<number | null>;
      breakpoint?: ResponsiveBreakpointName;
    }
  | {
      kind: "patchNodeLayout";
      id: NodeId;
      key: LayoutField;
      write: WriteValue<string>;
      breakpoint?: ResponsiveBreakpointName;
    }
  | NodeFieldOperation
  | { kind: "setNodeBinding"; id: NodeId; binding?: DataBindingRef }
  | { kind: "setNodePlacement"; id: NodeId; placement?: NodePlacement }
  | {
      kind: "patchDefinitionOverride";
      id: EntryId<"definitionOverride">;
      scope: "defaults" | "visual" | "stateRules";
      key: string;
      state?: StateName;
      write: WriteValue<AuthoredValue>;
    }
  | {
      kind: "upsertDescendant";
      id: NodeId;
      override: DescendantOverride;
      /** A patch's whole-value fields to drop (the incoming patch can only set them). */
      clear?: readonly PatchWholeField[];
    }
  | {
      kind: "removeDescendant";
      id: NodeId;
      address: DescendantOverride["address"];
    };
/** Whole-value fields of a path patch (replaced, not merged, by an incoming patch). */
export type PatchWholeField =
  "fills" | "fillSizing" | "responsive" | "visibility" | "enabled";
const PATCH_WHOLE_FIELDS: readonly string[] = [
  "fills",
  "fillSizing",
  "responsive",
  "visibility",
  "enabled",
];
/** Whole-value node fields a single edit replaces (Fill panel, fill intent, display, theme). */
export type NodeFieldOperation = {
  [F in NodeWholeField]: {
    kind: "setNodeField";
    id: NodeId;
    field: F;
    /** `undefined` removes the field. */
    value?: NodeEntry[F];
  };
}[NodeWholeField];
export type NodeWholeField =
  "name" | "fills" | "fillSizing" | "visibility" | "themeOverride" | "metadata";
const NODE_WHOLE_FIELDS: readonly string[] = [
  "name",
  "fills",
  "fillSizing",
  "visibility",
  "themeOverride",
  "metadata",
];
export type HistoryIntent =
  | { kind: "record"; label: string }
  | {
      kind: "skip";
      /** `sync`: a read-only replica (Preview) takes a step the editor already recorded. */
      reason: "project-create" | "load" | "fixture" | "sync";
    };
export interface CatalogTransactionRequest {
  projectId: EntryId<"project">;
  expectedRevision: number;
  ops: readonly CatalogOperation[];
  history: HistoryIntent;
}
/**
 * What a committed transaction touched, so each consumer processes that delta instead of
 * rediscovering it (ADR-248 §4.1). Derived from the staged records and the graph indexes.
 */
export interface CatalogTransactionImpact {
  /** Owners (page, node or definition) of changed/removed nodes, before and after the change. */
  affectedParents: ReadonlySet<string>;
  /** Pages that render a changed record, directly or through an instance of a changed template. */
  affectedPages: ReadonlySet<EntryId<"page">>;
  /** Ownership, order, definition or descendant structure changed. */
  structural: boolean;
  /** Box geometry may change (structure, sizing, layout, text or layout-relevant visual keys). */
  layout: boolean;
}
export interface CatalogTransactionResult {
  forward: readonly CatalogOperation[];
  inverse: readonly CatalogOperation[];
  changedIds: ReadonlySet<string>;
  removedIds: ReadonlySet<string>;
  revision: number;
  impact: CatalogTransactionImpact;
}
/** Visual keys that only repaint: every other visual key may change box geometry. */
const PAINT_ONLY_VISUAL_KEYS: ReadonlySet<string> = new Set([
  "color",
  "backgroundColor",
  "borderColor",
  "fill",
  "fillAlpha",
  "opacity",
  "radius",
  "radiusTopLeft",
  "radiusTopRight",
  "radiusBottomRight",
  "radiusBottomLeft",
  "boxShadow",
  "filter",
  "transform",
  "zIndex",
  "backgroundImage",
  "backgroundSize",
  "textDecoration",
]);
/** Owned child IDs of a record as one comparable key (order matters). */
function ownedChildIds(entry: CatalogEntry): string {
  if (entry.kind === "page") return entry.children.join("\0");
  if (entry.kind === "definition") return entry.templateRootId ?? "";
  if (entry.kind !== "node") return "";
  const ids = [...entry.children];
  for (const override of entry.descendantOverrides) {
    if (override.kind === "replace") ids.push(override.replacementId);
    if (override.kind === "fillSlot") ids.push(...override.childIds);
  }
  return ids.join("\0");
}
/** A record's content apart from its own child list (one staged record, not the graph). */
function withoutChildren(entry: CatalogEntry): string {
  return JSON.stringify(
    "children" in entry ? { ...entry, children: [] } : entry,
  );
}
/**
 * Pages rendering any of `ids`: walk owners up to a page; a template (owner chain ends at a
 * definition) reaches the pages of that definition's instances. Cost = depth × fan-out.
 */
function affectedPagesOf(
  graph: CatalogGraph,
  ids: Iterable<string>,
): Set<EntryId<"page">> {
  const pages = new Set<EntryId<"page">>();
  const visited = new Set<string>();
  const queue = [...ids];
  while (queue.length) {
    let cursor: string | undefined = queue.pop()!;
    while (cursor && !visited.has(cursor)) {
      visited.add(cursor);
      const entry = graph.getEntry(cursor);
      if (entry?.kind === "page") {
        pages.add(entry.id);
        break;
      }
      if (entry?.kind === "definition") {
        queue.push(...graph.instancesOf(entry.id));
        break;
      }
      cursor = graph.ownerOf(cursor);
    }
  }
  return pages;
}
function operationAffectsLayout(op: CatalogOperation): boolean {
  switch (op.kind) {
    case "patchNodeVisual":
      return !PAINT_ONLY_VISUAL_KEYS.has(op.key);
    case "setNodeField":
      return op.field === "fillSizing" || op.field === "visibility";
    case "patchDefinitionOverride":
      return op.scope !== "visual" || !PAINT_ONLY_VISUAL_KEYS.has(op.key);
    default:
      return true;
  }
}
function keyOfOverride(override: DescendantOverride): string {
  return JSON.stringify(override.address);
}
function mergeWrites<T>(
  previous: Readonly<Record<string, WriteValue<T>>> | undefined,
  incoming: Readonly<Record<string, WriteValue<T>>> | undefined,
): Record<string, WriteValue<T>> {
  const result = { ...previous };
  for (const [key, write] of Object.entries(incoming ?? {})) {
    if (write.kind === "remove") delete result[key];
    else result[key] = write;
  }
  return result;
}
function mergePatch(
  old: DescendantOverride | undefined,
  incoming: Extract<DescendantOverride, { kind: "patch" }>,
  clear: readonly PatchWholeField[] = [],
): Extract<DescendantOverride, { kind: "patch" }> | null {
  const previous = old?.kind === "patch" ? old : undefined;
  const props = mergeWrites(previous?.props, incoming.props);
  const visual = mergeWrites(previous?.visual, incoming.visual);
  const sizing = mergeWrites(previous?.sizing, incoming.sizing);
  const layout = mergeWrites(previous?.layout, incoming.layout);
  // Whole-value fields: the incoming value replaces the previous one.
  const whole = {
    fills: incoming.fills ?? previous?.fills,
    fillSizing: incoming.fillSizing ?? previous?.fillSizing,
    responsive: incoming.responsive ?? previous?.responsive,
    visibility: incoming.visibility ?? previous?.visibility,
    enabled: incoming.enabled ?? previous?.enabled,
  };
  for (const field of clear) delete whole[field];
  const stateRules = { ...previous?.stateRules } as Record<
    string,
    Record<string, WriteValue<AuthoredValue>>
  >;
  for (const [state, writes] of Object.entries(incoming.stateRules ?? {})) {
    const next = mergeWrites(stateRules[state], writes);
    if (Object.keys(next).length) stateRules[state] = next;
    else delete stateRules[state];
  }
  const wholeFields = Object.fromEntries(
    Object.entries(whole).filter(([, value]) => value !== undefined),
  );
  if (
    !Object.keys(props).length &&
    !Object.keys(visual).length &&
    !Object.keys(sizing).length &&
    !Object.keys(layout).length &&
    !Object.keys(stateRules).length &&
    !Object.keys(wholeFields).length
  )
    return null;
  return {
    kind: "patch",
    address: incoming.address,
    ...(Object.keys(props).length ? { props } : {}),
    ...(Object.keys(visual).length ? { visual } : {}),
    ...(Object.keys(sizing).length ? { sizing } : {}),
    ...(Object.keys(layout).length ? { layout } : {}),
    ...(Object.keys(stateRules).length ? { stateRules } : {}),
    ...wholeFields,
  };
}
function requireNode(value: CatalogEntry | undefined, id: string): NodeEntry {
  if (value?.kind !== "node")
    throw new CatalogValidationError("NODE_REQUIRED", id);
  return value;
}

/**
 * Operations applied over the committed graph without touching it, its indexes, history or dirty
 * IDs. `applyCatalogTransaction` stages its request here, then validates and commits; a composed
 * edit stages each command's ops so the next command reads what the earlier ones staged. Reads cost
 * the staged records, never the graph (ADR-248 §4.1).
 */
export type { CatalogReader };
export class CatalogStage implements CatalogReader {
  readonly staged = new Map<string, CatalogEntry | null>();
  readonly before = new Map<string, CatalogEntry | undefined>();
  readonly inverse: CatalogOperation[] = [];
  readonly metrics = CatalogGraph.emptyMetrics();
  structural = false;
  constructor(readonly graph: CatalogGraph) {}
  get projectId(): EntryId<"project"> {
    return this.graph.projectId;
  }
  get revision(): number {
    return this.graph.revision;
  }
  get library(): CatalogLibrary {
    return this.graph.library;
  }
  readonly get = (id: string): CatalogEntry | undefined => {
    this.metrics.transactionEntryReads++;
    if (this.staged.has(id)) return this.staged.get(id) ?? undefined;
    return this.graph.getEntry(id);
  };
  getEntry(id: string): CatalogEntry | undefined {
    return this.get(id);
  }
  /** Owner after the staged records: a staged record that claims `id`, else the committed owner. */
  ownerOf(id: string): string | undefined {
    for (const [ownerId, entry] of this.staged)
      if (entry && (ownedChildren(entry) as string[]).includes(id))
        return ownerId;
    const owner = this.graph.ownerOf(id);
    return owner !== undefined && this.staged.has(owner) ? undefined : owner;
  }
  referrersOf(id: string): ReadonlySet<string> {
    return this.overlay(this.graph.referrersOf(id), (entry) =>
      referencedIds(entry).includes(id),
    );
  }
  instancesOf(definitionId: string): ReadonlySet<string> {
    return this.overlay(
      this.graph.instancesOf(definitionId),
      (entry) => entry.kind === "node" && entry.definitionId === definitionId,
    );
  }
  /** A committed index set with the staged records re-tested against `holds`. */
  private overlay(
    committed: ReadonlySet<string>,
    holds: (entry: CatalogEntry) => boolean,
  ): ReadonlySet<string> {
    if (!this.staged.size) return committed;
    const result = new Set(committed);
    for (const [id, entry] of this.staged)
      if (entry && holds(entry)) result.add(id);
      else result.delete(id);
    return result;
  }
  apply(ops: readonly CatalogOperation[]): this {
    for (const op of ops) this.applyOne(op);
    return this;
  }
  private stage(id: string, value: CatalogEntry | null): void {
    if (!this.before.has(id)) this.before.set(id, this.graph.getEntry(id));
    this.staged.set(id, value);
  }
  private applyOne(op: CatalogOperation): void {
    if (
      ![
        "put",
        "remove",
        "patchNodeProp",
        "patchNodeVisual",
        "patchNodeSizing",
        "patchNodeLayout",
        "setNodeField",
        "setNodeBinding",
        "setNodePlacement",
        "patchDefinitionOverride",
        "upsertDescendant",
        "removeDescendant",
      ].includes(op.kind)
    )
      throw new CatalogValidationError("UNKNOWN_OPERATION", String(op.kind));
    if (op.kind === "put") {
      const entry = validateCatalogEntry(op.entry);
      const old = this.get(entry.id);
      this.inverse.unshift(
        old ? { kind: "put", entry: old } : { kind: "remove", id: entry.id },
      );
      this.stage(entry.id, entry);
      this.structural = true;
      return;
    }
    if (op.kind === "remove") {
      const old = this.get(op.id);
      if (!old) throw new CatalogValidationError("ENTRY_NOT_FOUND", op.id);
      this.inverse.unshift({ kind: "put", entry: old });
      this.stage(op.id, null);
      this.structural = true;
      return;
    }
    if (op.kind === "patchDefinitionOverride") {
      const entry = this.get(op.id);
      if (entry?.kind !== "definitionOverride")
        throw new CatalogValidationError("DEFINITION_OVERRIDE_REQUIRED", op.id);
      if (op.scope === "stateRules" && !op.state)
        throw new CatalogValidationError("STATE_REQUIRED", op.id);
      if (op.scope !== "stateRules" && op.state)
        throw new CatalogValidationError("STATE_NOT_ALLOWED", op.id);
      const prior =
        op.scope === "stateRules"
          ? (entry.stateRules[op.state!] ?? {})
          : entry[op.scope];
      const previousWrite = prior[op.key as keyof typeof prior];
      this.inverse.unshift({
        ...op,
        write: previousWrite ?? { kind: "remove" },
      } as CatalogOperation);
      const next = { ...prior } as Record<string, unknown>;
      if (op.write.kind === "remove") delete next[op.key];
      else next[op.key] = op.write;
      if (op.scope === "stateRules") {
        const stateRules = { ...entry.stateRules };
        if (Object.keys(next).length)
          stateRules[op.state!] = next as typeof prior;
        else delete stateRules[op.state!];
        this.stage(entry.id, { ...entry, stateRules });
      } else this.stage(entry.id, { ...entry, [op.scope]: next });
      return;
    }
    const node = requireNode(this.get(op.id), op.id);
    if (op.kind === "setNodeField") {
      if (!NODE_WHOLE_FIELDS.includes(op.field))
        throw new CatalogValidationError(
          "UNKNOWN_NODE_FIELD",
          String(op.field),
        );
      this.inverse.unshift({
        kind: "setNodeField",
        id: node.id,
        field: op.field,
        value: node[op.field],
      } as CatalogOperation);
      const next = { ...node } as Record<string, unknown>;
      if (op.value === undefined) delete next[op.field];
      else next[op.field] = structuredClone(op.value);
      this.stage(node.id, next as unknown as NodeEntry);
      return;
    }
    if (
      (op.kind === "patchNodeVisual" ||
        op.kind === "patchNodeSizing" ||
        op.kind === "patchNodeLayout") &&
      op.breakpoint !== undefined
    ) {
      if (op.breakpoint !== "tablet" && op.breakpoint !== "mobile")
        throw new CatalogValidationError(
          "RESPONSIVE_BREAKPOINT",
          String(op.breakpoint),
        );
      const scope =
        op.kind === "patchNodeVisual"
          ? "visual"
          : op.kind === "patchNodeSizing"
            ? "sizing"
            : "layout";
      const layer = node.responsive?.[op.breakpoint] ?? {};
      const prior = (layer[scope] ?? {}) as Record<string, WriteValue<unknown>>;
      this.inverse.unshift({
        ...op,
        write: prior[op.key] ?? { kind: "remove" },
      } as CatalogOperation);
      const nextScope = { ...prior };
      if (op.write.kind === "remove") delete nextScope[op.key];
      else nextScope[op.key] = op.write;
      const nextLayer = { ...layer } as Record<string, unknown>;
      if (Object.keys(nextScope).length) nextLayer[scope] = nextScope;
      else delete nextLayer[scope];
      const responsive = { ...node.responsive } as Record<string, unknown>;
      if (Object.keys(nextLayer).length) responsive[op.breakpoint] = nextLayer;
      else delete responsive[op.breakpoint];
      const next = { ...node } as Record<string, unknown>;
      if (Object.keys(responsive).length) next.responsive = responsive;
      else delete next.responsive;
      this.stage(node.id, next as unknown as NodeEntry);
      return;
    }
    if (op.kind === "patchNodeLayout") {
      const prior = node.layout ?? {};
      this.inverse.unshift({
        ...op,
        write: prior[op.key] ?? { kind: "remove" },
      });
      const next = { ...prior } as Record<string, WriteValue<string>>;
      if (op.write.kind === "remove") delete next[op.key];
      else next[op.key] = op.write;
      const entry = { ...node } as Record<string, unknown>;
      if (Object.keys(next).length) entry.layout = next;
      else delete entry.layout;
      this.stage(node.id, entry as unknown as NodeEntry);
      return;
    }
    if (op.kind === "setNodePlacement") {
      this.inverse.unshift({
        kind: "setNodePlacement",
        id: node.id,
        placement: node.placement,
      });
      this.stage(node.id, { ...node, placement: op.placement });
      return;
    }
    if (
      op.kind === "patchNodeProp" ||
      op.kind === "patchNodeVisual" ||
      op.kind === "patchNodeSizing"
    ) {
      const scope =
        op.kind === "patchNodeProp"
          ? "props"
          : op.kind === "patchNodeVisual"
            ? "visual"
            : "sizing";
      const prior = node[scope];
      const previousWrite = prior[op.key as keyof typeof prior];
      this.inverse.unshift({
        ...op,
        write: previousWrite ?? { kind: "remove" },
      } as CatalogOperation);
      const next = { ...prior } as Record<string, unknown>;
      if (op.write.kind === "remove") delete next[op.key];
      else next[op.key] = op.write;
      this.stage(node.id, { ...node, [scope]: next });
      return;
    }
    if (op.kind === "setNodeBinding") {
      this.inverse.unshift({
        kind: "setNodeBinding",
        id: node.id,
        binding: node.binding,
      });
      const next = { ...node };
      if (op.binding === undefined) delete next.binding;
      else next.binding = op.binding;
      this.stage(node.id, next);
      return;
    }
    if (op.kind === "upsertDescendant") {
      for (const field of op.clear ?? [])
        if (op.override.kind !== "patch" || !PATCH_WHOLE_FIELDS.includes(field))
          throw new CatalogValidationError(
            "INVALID_PATCH_CLEAR",
            String(field),
          );
      this.inverse.unshift({ kind: "put", entry: node });
      const key = keyOfOverride(op.override);
      const found = node.descendantOverrides.findIndex(
        (item) => keyOfOverride(item) === key,
      );
      const overrides = [...node.descendantOverrides];
      const merged =
        op.override.kind === "patch"
          ? mergePatch(
              found >= 0 ? overrides[found] : undefined,
              op.override,
              op.clear,
            )
          : op.override;
      if (merged === null) {
        if (found >= 0) overrides.splice(found, 1);
      } else if (found < 0) overrides.push(merged);
      else overrides[found] = merged;
      this.stage(node.id, { ...node, descendantOverrides: overrides });
      this.structural =
        this.structural ||
        op.override.kind !== "patch" ||
        (found >= 0 && node.descendantOverrides[found].kind !== "patch");
      return;
    }
    const key = JSON.stringify(op.address);
    this.inverse.unshift({ kind: "put", entry: node });
    const overrides = node.descendantOverrides.filter(
      (item) => keyOfOverride(item) !== key,
    );
    if (overrides.length === node.descendantOverrides.length)
      throw new CatalogValidationError("OVERRIDE_NOT_FOUND", node.id);
    this.stage(node.id, { ...node, descendantOverrides: overrides });
    this.structural = true;
  }
}

/** Stages operations over the committed graph (see `CatalogStage`); nothing is committed. */
export function stageCatalogTransaction(
  graph: CatalogGraph,
  ops: readonly CatalogOperation[],
): CatalogStage {
  return new CatalogStage(graph).apply(ops);
}

/** Purely stages changes before touching graph, indexes, history or dirty IDs. */
export function applyCatalogTransaction(
  graph: CatalogGraph,
  request: CatalogTransactionRequest,
): CatalogTransactionResult {
  if (request.projectId !== graph.projectId)
    throw new CatalogValidationError("PROJECT_MISMATCH", request.projectId);
  if (request.expectedRevision !== graph.revision)
    throw new CatalogValidationError(
      "REVISION_CONFLICT",
      String(request.expectedRevision),
    );
  if (
    !request.history ||
    (request.history.kind !== "record" && request.history.kind !== "skip") ||
    (request.history.kind === "record" && !request.history.label.trim()) ||
    (request.history.kind === "skip" &&
      !["project-create", "load", "fixture", "sync"].includes(
        request.history.reason,
      ))
  )
    throw new CatalogValidationError("HISTORY_INTENT_REQUIRED", "history");
  if (!request.ops.length)
    throw new CatalogValidationError("EMPTY_TRANSACTION", "ops");
  const stage = new CatalogStage(graph).apply(request.ops);
  const { staged, before, inverse, metrics, get } = stage;
  const structural = stage.structural;
  for (const [id, entry] of staged) {
    if (entry !== null) {
      validateCatalogEntry(entry);
      graph.validateEntryReferences(entry, get);
    }
    if (!structural && before.get(id)?.kind !== entry?.kind)
      throw new CatalogValidationError("LEAF_KIND_CHANGED", id);
  }
  if (structural) graph.validateStructuralDelta(staged, get);
  // Owners before the commit: a removed node keeps its old parent in the impact.
  const ownerBefore = new Map<string, string>();
  for (const id of staged.keys()) {
    const owner = graph.ownerOf(id);
    if (owner) ownerBefore.set(id, owner);
  }
  const forward = structuredClone(request.ops);
  graph.commit(
    staged,
    request.history.kind === "record" ? request.history.label : null,
    metrics,
  );
  const affectedParents = new Set<string>();
  for (const [id, entry] of staged) {
    const previous = before.get(id);
    if (entry === null) {
      const owner = ownerBefore.get(id);
      if (owner) affectedParents.add(owner);
      continue;
    }
    // An owner whose owned children changed is itself an affected parent.
    if (!previous || ownedChildIds(previous) !== ownedChildIds(entry))
      affectedParents.add(id);
    // A record whose own content changed affects its parent's layout/paint.
    if (!previous || withoutChildren(previous) !== withoutChildren(entry)) {
      const owner = graph.ownerOf(id) ?? ownerBefore.get(id);
      if (owner) affectedParents.add(owner);
    }
  }
  for (const id of affectedParents)
    if (!graph.getEntry(id) || graph.getEntry(id)?.kind === "project")
      affectedParents.delete(id);
  return {
    forward,
    inverse,
    changedIds: new Set(
      [...staged].filter(([, entry]) => entry !== null).map(([id]) => id),
    ),
    removedIds: new Set(
      [...staged].filter(([, entry]) => entry === null).map(([id]) => id),
    ),
    revision: graph.revision,
    impact: {
      affectedParents,
      affectedPages: affectedPagesOf(graph, [
        ...staged.keys(),
        ...affectedParents,
      ]),
      structural,
      layout: structural || request.ops.some(operationAffectsLayout),
    },
  };
}

/** The bound command has the ADR §4.1 request shape without any global graph. */
export function createCatalogTransactionController(graph: CatalogGraph): {
  applyCatalogTransaction(
    request: CatalogTransactionRequest,
  ): CatalogTransactionResult;
} {
  return {
    applyCatalogTransaction: (request) =>
      applyCatalogTransaction(graph, request),
  };
}
