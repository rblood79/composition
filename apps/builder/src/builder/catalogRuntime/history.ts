import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type {
  CatalogEntry,
  CatalogReader,
  DefinitionId,
  NodeEntry,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogOperation } from "../../../../../packages/shared/src/catalog/transactions/transaction";
import type { CatalogHistoryEntryView, CatalogRuntime } from "./controller";

export interface CatalogHistorySnapshot {
  /** Entry labels in order: the applied ones, then the undone ones (next redo first). */
  readonly labels: readonly string[];
  /** How many entries are applied (`labels.slice(0, applied)`); 0 = the opened state. */
  readonly applied: number;
  /** When each entry's action ran (epoch ms), in `labels` order. */
  readonly times: readonly number[];
  /** The element each entry acted on (its name, else its type), in `labels` order. */
  readonly subjects: readonly (string | null)[];
}

const isNodeId = (id: unknown): id is string =>
  typeof id === "string" && id.startsWith("project:node:");
const isNode = (entry: CatalogEntry | undefined): entry is NodeEntry =>
  entry?.kind === "node";

/**
 * The node an entry acted on (the old History label's subject): what it created (the root of the
 * new nodes), else what it removed, else the node a field edit wrote, else the node a move put
 * into another parent, else the first node it changed. The entry is the snapshot for a node that
 * no longer exists.
 */
function historySubject(
  forward: readonly CatalogOperation[],
  inverse: readonly CatalogOperation[],
): { id: string; entry?: NodeEntry } | undefined {
  const puts = (ops: readonly CatalogOperation[]) => {
    const map = new Map<string, NodeEntry>();
    for (const op of ops)
      if (op.kind === "put" && isNode(op.entry)) map.set(op.entry.id, op.entry);
    return map;
  };
  const removed = (ops: readonly CatalogOperation[]) =>
    new Set(
      ops.flatMap((op) =>
        op.kind === "remove" && isNodeId(op.id) ? [op.id] : [],
      ),
    );
  const after = puts(forward);
  const before = puts(inverse);
  const root = (ids: Set<string>, entries: Map<string, NodeEntry>) => {
    const children = new Set<string>(
      [...ids].flatMap((id) => entries.get(id)?.children ?? []),
    );
    // In the order the step wrote them (the first root of an insert is its first node).
    const id = [...entries.keys(), ...ids].find(
      (candidate) => ids.has(candidate) && !children.has(candidate),
    );
    return id ? { id, entry: entries.get(id) } : undefined;
  };
  const created = removed(inverse);
  if (created.size) return root(created, after);
  const deleted = removed(forward);
  if (deleted.size) return root(deleted, before);
  for (const op of forward)
    if (
      op.kind !== "put" &&
      op.kind !== "remove" &&
      "id" in op &&
      isNodeId(op.id)
    )
      return { id: op.id };
  for (const [id, entry] of after) {
    const previous = new Set<string>(before.get(id)?.children ?? []);
    const moved = entry.children.find((child) => !previous.has(child));
    if (moved && before.has(id)) return { id: moved };
  }
  const first = after.keys().next();
  return first.done ? undefined : { id: first.value };
}

function nodeName(graph: CatalogReader, node: NodeEntry): string {
  if (node.name) return node.name;
  try {
    return definitionTypeName(graph, node.definitionId as DefinitionId);
  } catch {
    return node.definitionId;
  }
}

/**
 * ADR-248 Phase 4e-4: the History panel's read of the project's single history — entry labels
 * and the applied count after each history change (a step, undo, redo, an outside data change, a
 * clear).
 * Jumping to an entry undoes or redoes one step at a time through the workspace (each one a
 * published step, so every consumer follows).
 *
 * The snapshot is read when a reader asks (`getSnapshot` — the History panel while it is shown):
 * a change only marks it stale and tells the listeners, so an edit does not read every entry of a
 * long session (CANVAS_PERF_SCALING_2026-11 B7). A read that finds nothing changed returns the same
 * snapshot object.
 */
export class CatalogHistoryStore {
  private snapshot: CatalogHistorySnapshot | undefined;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;

  constructor(
    private readonly runtime: CatalogRuntime,
    private readonly steps: { undo(): unknown; redo(): unknown },
  ) {
    this.unsubscribe = runtime.subscribeHistory(() => this.changed());
  }
  dispose(): void {
    this.unsubscribe();
    this.listeners.clear();
  }
  getSnapshot = (): CatalogHistorySnapshot => {
    if (!this.stale && this.snapshot) return this.snapshot;
    this.stale = false;
    const next = this.read();
    if (!this.snapshot || !sameSnapshot(next, this.snapshot))
      this.snapshot = next;
    return this.snapshot;
  };
  /** How many entries are applied (undo) and undone (redo) — no entry is read. */
  size(): { undo: number; redo: number } {
    return this.runtime.historySize;
  }
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Undo or redo until `applied` entries are applied. */
  goTo(applied: number): void {
    const { undo, redo } = this.size();
    const target = Math.max(0, Math.min(applied, undo + redo));
    for (let at = undo; at > target; at--) this.steps.undo();
    for (let at = undo; at < target; at++) this.steps.redo();
  }
  /** Drop every entry (the document stays as it is). */
  clear(): void {
    this.runtime.clearHistory();
  }

  private stale = true;
  /** Each entry's subject node (its operations do not change). */
  private readonly subjectIds = new WeakMap<
    readonly CatalogOperation[],
    { id: string; entry?: NodeEntry } | null
  >();
  private subjectOf(entry: CatalogHistoryEntryView): string | null {
    let subject = this.subjectIds.get(entry.forward);
    if (subject === undefined) {
      subject = historySubject(entry.forward, entry.inverse) ?? null;
      this.subjectIds.set(entry.forward, subject);
    }
    if (!subject) return null;
    // The current name (a later rename shows), else the entry's own snapshot.
    const graph = this.runtime.graph;
    const current = graph.getEntry(subject.id);
    const node = isNode(current) ? current : subject.entry;
    return node ? nodeName(graph, node) : null;
  }
  private read(): CatalogHistorySnapshot {
    const { undo, redo } = this.runtime.historyEntries;
    const entries = [...undo, ...redo];
    return {
      labels: entries.map((entry) => entry.label),
      applied: undo.length,
      times: entries.map((entry) => entry.at),
      subjects: entries.map((entry) => this.subjectOf(entry)),
    };
  }
  private changed(): void {
    this.stale = true;
    for (const listener of [...this.listeners]) listener();
  }
}

function sameSnapshot(
  next: CatalogHistorySnapshot,
  previous: CatalogHistorySnapshot,
): boolean {
  return (
    next.applied === previous.applied &&
    next.labels.length === previous.labels.length &&
    next.labels.every(
      (label, index) =>
        label === previous.labels[index] &&
        next.times[index] === previous.times[index] &&
        next.subjects[index] === previous.subjects[index],
    )
  );
}
