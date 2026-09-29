import type {
  CatalogEntry,
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
import { CatalogGraph } from "../document/graph";
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
  | { kind: "upsertDescendant"; id: NodeId; override: DescendantOverride }
  | {
      kind: "removeDescendant";
      id: NodeId;
      address: DescendantOverride["address"];
    };
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
export type NodeWholeField = "fills" | "fillSizing" | "visibility" | "themeOverride";
const NODE_WHOLE_FIELDS: readonly string[] = [
  "fills",
  "fillSizing",
  "visibility",
  "themeOverride",
];
export type HistoryIntent =
  | { kind: "record"; label: string }
  | { kind: "skip"; reason: "project-create" | "load" | "fixture" };
export interface CatalogTransactionRequest {
  projectId: EntryId<"project">;
  expectedRevision: number;
  ops: readonly CatalogOperation[];
  history: HistoryIntent;
}
export interface CatalogTransactionResult {
  forward: readonly CatalogOperation[];
  inverse: readonly CatalogOperation[];
  changedIds: ReadonlySet<string>;
  removedIds: ReadonlySet<string>;
  revision: number;
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
): Extract<DescendantOverride, { kind: "patch" }> | null {
  const previous = old?.kind === "patch" ? old : undefined;
  const props = mergeWrites(previous?.props, incoming.props);
  const visual = mergeWrites(previous?.visual, incoming.visual);
  const sizing = mergeWrites(previous?.sizing, incoming.sizing);
  const stateRules = { ...previous?.stateRules } as Record<
    string,
    Record<string, WriteValue<AuthoredValue>>
  >;
  for (const [state, writes] of Object.entries(incoming.stateRules ?? {})) {
    const next = mergeWrites(stateRules[state], writes);
    if (Object.keys(next).length) stateRules[state] = next;
    else delete stateRules[state];
  }
  if (
    !Object.keys(props).length &&
    !Object.keys(visual).length &&
    !Object.keys(sizing).length &&
    !Object.keys(stateRules).length
  )
    return null;
  return {
    kind: "patch",
    address: incoming.address,
    ...(Object.keys(props).length ? { props } : {}),
    ...(Object.keys(visual).length ? { visual } : {}),
    ...(Object.keys(sizing).length ? { sizing } : {}),
    ...(Object.keys(stateRules).length ? { stateRules } : {}),
  };
}
function requireNode(value: CatalogEntry | undefined, id: string): NodeEntry {
  if (value?.kind !== "node")
    throw new CatalogValidationError("NODE_REQUIRED", id);
  return value;
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
      !["project-create", "load", "fixture"].includes(request.history.reason))
  )
    throw new CatalogValidationError("HISTORY_INTENT_REQUIRED", "history");
  if (!request.ops.length)
    throw new CatalogValidationError("EMPTY_TRANSACTION", "ops");
  const metrics = CatalogGraph.emptyMetrics();
  const staged = new Map<string, CatalogEntry | null>();
  const before = new Map<string, CatalogEntry | undefined>();
  const inverse: CatalogOperation[] = [];
  let structural = false;
  const get = (id: string): CatalogEntry | undefined => {
    metrics.transactionEntryReads++;
    if (staged.has(id)) return staged.get(id) ?? undefined;
    return graph.getEntry(id);
  };
  const stage = (id: string, value: CatalogEntry | null): void => {
    if (!before.has(id)) before.set(id, graph.getEntry(id));
    staged.set(id, value);
  };
  for (const op of request.ops) {
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
      const old = get(entry.id);
      inverse.unshift(
        old ? { kind: "put", entry: old } : { kind: "remove", id: entry.id },
      );
      stage(entry.id, entry);
      structural = true;
      continue;
    }
    if (op.kind === "remove") {
      const old = get(op.id);
      if (!old) throw new CatalogValidationError("ENTRY_NOT_FOUND", op.id);
      inverse.unshift({ kind: "put", entry: old });
      stage(op.id, null);
      structural = true;
      continue;
    }
    if (op.kind === "patchDefinitionOverride") {
      const entry = get(op.id);
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
      inverse.unshift({
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
        stage(entry.id, { ...entry, stateRules });
      } else stage(entry.id, { ...entry, [op.scope]: next });
      continue;
    }
    const node = requireNode(get(op.id), op.id);
    if (op.kind === "setNodeField") {
      if (!NODE_WHOLE_FIELDS.includes(op.field))
        throw new CatalogValidationError("UNKNOWN_NODE_FIELD", String(op.field));
      inverse.unshift({
        kind: "setNodeField",
        id: node.id,
        field: op.field,
        value: node[op.field],
      } as CatalogOperation);
      const next = { ...node } as Record<string, unknown>;
      if (op.value === undefined) delete next[op.field];
      else next[op.field] = structuredClone(op.value);
      stage(node.id, next as unknown as NodeEntry);
      continue;
    }
    if (
      (op.kind === "patchNodeVisual" ||
        op.kind === "patchNodeSizing" ||
        op.kind === "patchNodeLayout") &&
      op.breakpoint !== undefined
    ) {
      if (op.breakpoint !== "tablet" && op.breakpoint !== "mobile")
        throw new CatalogValidationError("RESPONSIVE_BREAKPOINT", String(op.breakpoint));
      const scope =
        op.kind === "patchNodeVisual"
          ? "visual"
          : op.kind === "patchNodeSizing"
            ? "sizing"
            : "layout";
      const layer = node.responsive?.[op.breakpoint] ?? {};
      const prior = (layer[scope] ?? {}) as Record<string, WriteValue<unknown>>;
      inverse.unshift({
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
      stage(node.id, next as unknown as NodeEntry);
      continue;
    }
    if (op.kind === "patchNodeLayout") {
      const prior = node.layout ?? {};
      inverse.unshift({
        ...op,
        write: prior[op.key] ?? { kind: "remove" },
      });
      const next = { ...prior } as Record<string, WriteValue<string>>;
      if (op.write.kind === "remove") delete next[op.key];
      else next[op.key] = op.write;
      const entry = { ...node } as Record<string, unknown>;
      if (Object.keys(next).length) entry.layout = next;
      else delete entry.layout;
      stage(node.id, entry as unknown as NodeEntry);
      continue;
    }
    if (op.kind === "setNodePlacement") {
      inverse.unshift({
        kind: "setNodePlacement",
        id: node.id,
        placement: node.placement,
      });
      stage(node.id, { ...node, placement: op.placement });
      continue;
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
      inverse.unshift({
        ...op,
        write: previousWrite ?? { kind: "remove" },
      } as CatalogOperation);
      const next = { ...prior } as Record<string, unknown>;
      if (op.write.kind === "remove") delete next[op.key];
      else next[op.key] = op.write;
      stage(node.id, { ...node, [scope]: next });
      continue;
    }
    if (op.kind === "setNodeBinding") {
      inverse.unshift({
        kind: "setNodeBinding",
        id: node.id,
        binding: node.binding,
      });
      const next = { ...node };
      if (op.binding === undefined) delete next.binding;
      else next.binding = op.binding;
      stage(node.id, next);
      continue;
    }
    if (op.kind === "upsertDescendant") {
      inverse.unshift({ kind: "put", entry: node });
      const key = keyOfOverride(op.override);
      const found = node.descendantOverrides.findIndex(
        (item) => keyOfOverride(item) === key,
      );
      const overrides = [...node.descendantOverrides];
      const merged =
        op.override.kind === "patch"
          ? mergePatch(found >= 0 ? overrides[found] : undefined, op.override)
          : op.override;
      if (merged === null) {
        if (found >= 0) overrides.splice(found, 1);
      } else if (found < 0) overrides.push(merged);
      else overrides[found] = merged;
      stage(node.id, { ...node, descendantOverrides: overrides });
      structural =
        structural ||
        op.override.kind !== "patch" ||
        (found >= 0 && node.descendantOverrides[found].kind !== "patch");
      continue;
    }
    const key = JSON.stringify(op.address);
    inverse.unshift({ kind: "put", entry: node });
    const overrides = node.descendantOverrides.filter(
      (item) => keyOfOverride(item) !== key,
    );
    if (overrides.length === node.descendantOverrides.length)
      throw new CatalogValidationError("OVERRIDE_NOT_FOUND", node.id);
    stage(node.id, { ...node, descendantOverrides: overrides });
    structural = true;
  }
  for (const [id, entry] of staged) {
    if (entry !== null) {
      validateCatalogEntry(entry);
      graph.validateEntryReferences(entry, get);
    }
    if (!structural && before.get(id)?.kind !== entry?.kind)
      throw new CatalogValidationError("LEAF_KIND_CHANGED", id);
  }
  if (structural) {
    const existing = graph.exportDocument().entries;
    const merged = new Map<string, CatalogEntry>(Object.entries(existing));
    for (const [id, entry] of staged) {
      if (entry === null) merged.delete(id);
      else merged.set(id, entry);
    }
    metrics.transactionEntriesTraversed = merged.size;
    graph.validateView(get, [...merged.values()]);
  }
  const forward = structuredClone(request.ops);
  graph.commit(
    staged,
    request.history.kind === "record" ? request.history.label : null,
    metrics,
  );
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
