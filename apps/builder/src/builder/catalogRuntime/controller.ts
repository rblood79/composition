import { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  CatalogDocument,
  CatalogEntry,
  NodeId,
  StateName,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  resolveCatalogNode,
  type ResolvedCatalogNode,
} from "../../../../../packages/shared/src/catalog/resolution/resolver";
import {
  applyCatalogTransaction,
  type CatalogOperation,
  type CatalogTransactionResult,
} from "../../../../../packages/shared/src/catalog/transactions/transaction";
import { CatalogStorage, type CatalogCommit } from "./storage";

/**
 * A change outside the document (the data store, H1) that history undoes and redoes with the
 * document (one stack, user 2026-09-30). It has already happened when recorded; undo and redo run
 * it after the entry's document part, one effect after another in history order.
 */
export interface CatalogExternalEffect {
  undo(): void | Promise<unknown>;
  redo(): void | Promise<unknown>;
}
interface HistoryEntry {
  label: string;
  forward: readonly CatalogOperation[];
  inverse: readonly CatalogOperation[];
  external?: CatalogExternalEffect;
}
interface Subscription {
  id: string;
  field: string;
  source: "entry" | "resolved";
  state?: StateName;
  value: unknown;
  notify: (value: unknown) => void;
}
interface ProjectSession {
  graph: CatalogGraph;
  durableRevision: number;
  pending: CatalogCommit[];
  saveTail: Promise<void>;
  undo: HistoryEntry[];
  redo: HistoryEntry[];
  subscriptions: Map<string, Set<Subscription>>;
  /** Called once per published step (after field subscribers), e.g. session reconciliation. */
  stepListeners: Set<CatalogStepListener>;
  /** Called after every history change (a step, undo, redo, an outside entry, clear). */
  historyListeners: Set<() => void>;
  /** Outside effects of undo/redo, run in order. */
  externalTail: Promise<void>;
  resolved: Map<string, Map<string, ResolvedCatalogNode>>;
  invalidatedIds: readonly string[];
}

function readField(value: unknown, field: string): unknown {
  return field
    .split(".")
    .reduce<unknown>(
      (current, part) =>
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[part]
          : undefined,
      value,
    );
}
function sameValue(a: unknown, b: unknown): boolean {
  return Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b);
}

/** A published step: its result and the entries whose reads it invalidated. */
export type CatalogStepListener = (step: CatalogStepContext) => void;

/**
 * The step was not applied: a consumer could not take the new state. Graph content, revision,
 * history, pending saves and consumer inputs are exactly as before; `revision` is that unchanged
 * revision and `cause` the consumer failure.
 */
export class CatalogStepAbortedError extends Error {
  constructor(
    readonly label: string,
    readonly revision: number,
    cause: unknown,
  ) {
    super(
      `CATALOG_STEP_ABORTED:${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
    this.name = "CatalogStepAbortedError";
  }
}
/**
 * The step is committed at `revision` — graph, history, pending saves and consumer inputs all
 * hold it. Only subscriber callbacks threw (`errors`); every subscriber was still called.
 */
export class CatalogSubscriberError extends Error {
  constructor(
    readonly result: CatalogTransactionResult,
    readonly errors: readonly unknown[],
  ) {
    super(
      `CATALOG_SUBSCRIBER_FAILED@${result.revision}:${errors
        .map((error) =>
          error instanceof Error ? error.message : String(error),
        )
        .join("; ")}`,
      { cause: errors[0] },
    );
    this.name = "CatalogSubscriberError";
  }
  get revision(): number {
    return this.result.revision;
  }
}

export interface CatalogStepContext {
  readonly result: CatalogTransactionResult;
  /** Entries whose resolved values may differ (before and after the step). */
  readonly invalidatedIds: readonly string[];
}
/**
 * Takes a step after the graph holds it and before anything is published (pending save,
 * history, runtime subscribers). Throwing aborts the step: the graph returns to the previous
 * revision, and the consumer must have left its own state as it was. The returned callback runs
 * once the step is published; it returns the errors its subscribers threw.
 */
export type CatalogStepConsumer = (
  step: CatalogStepContext,
) => (() => readonly unknown[]) | void;

/** Phase 2 only: an isolated command/history/storage harness, never a Builder singleton. */
export class CatalogRuntime {
  private readonly projects = new Map<string, ProjectSession>();
  private activeId: CatalogDocument["projectId"];
  constructor(
    graph: CatalogGraph,
    /** Absent for a read-only replica (the Preview): `save` then fails. */
    private readonly storage?: CatalogStorage,
  ) {
    this.activeId = graph.projectId;
    this.addProject(graph);
  }

  addProject(graph: CatalogGraph): void {
    if (this.projects.has(graph.projectId))
      throw new Error("PROJECT_ALREADY_OPEN");
    this.projects.set(graph.projectId, {
      graph,
      durableRevision: graph.revision,
      pending: [],
      saveTail: Promise.resolve(),
      undo: [],
      redo: [],
      subscriptions: new Map(),
      stepListeners: new Set(),
      historyListeners: new Set(),
      externalTail: Promise.resolve(),
      resolved: new Map(),
      invalidatedIds: [],
    });
  }
  switchProject(projectId: CatalogDocument["projectId"]): void {
    if (!this.projects.has(projectId)) throw new Error("PROJECT_NOT_OPEN");
    this.activeId = projectId;
  }
  get projectId(): string {
    return this.activeId;
  }
  get graph(): CatalogGraph {
    return this.current().graph;
  }
  get durableRevision(): number {
    return this.current().durableRevision;
  }
  /** Current and durable revision of any open project (autosave status). */
  projectRevisions(projectId: string): {
    revision: number;
    durableRevision: number;
  } {
    const session = this.projects.get(projectId);
    if (!session) throw new Error("PROJECT_NOT_OPEN");
    return {
      revision: session.graph.revision,
      durableRevision: session.durableRevision,
    };
  }
  get pendingCount(): number {
    return this.current().pending.length;
  }
  get dirtyIds(): ReadonlySet<string> {
    const ids = new Set<string>();
    for (const commit of this.current().pending) {
      for (const entry of commit.changed) ids.add(entry.id);
      for (const id of commit.removedIds) ids.add(id);
    }
    return ids;
  }
  get historyDepth(): { undo: number; redo: number } {
    const session = this.current();
    return { undo: session.undo.length, redo: session.redo.length };
  }
  /** History entry labels of the active project: undo (oldest first) and redo (next first). */
  get historyLabels(): { undo: readonly string[]; redo: readonly string[] } {
    const session = this.current();
    return {
      undo: session.undo.map((entry) => entry.label),
      redo: [...session.redo].reverse().map((entry) => entry.label),
    };
  }
  /** Drop the active project's undo and redo entries (the document and saves stay). */
  clearHistory(): void {
    const session = this.current();
    session.undo = [];
    session.redo = [];
    this.notifyHistory(session);
  }
  /** Listen to every history change of the active project. */
  subscribeHistory(listener: () => void): () => void {
    const session = this.current();
    session.historyListeners.add(listener);
    return () => session.historyListeners.delete(listener);
  }
  /** Resolves once every queued outside effect (undo/redo of an outside change) has run. */
  settled(): Promise<void> {
    return this.current().externalTail;
  }
  private notifyHistory(session: ProjectSession): void {
    for (const listener of [...session.historyListeners]) listener();
  }
  private runExternal(
    session: ProjectSession,
    entry: HistoryEntry,
    direction: "undo" | "redo",
  ): void {
    const effect = entry.external;
    if (!effect) return;
    session.externalTail = session.externalTail.then(async () => {
      try {
        await effect[direction]();
      } catch (error) {
        console.error(`[CatalogRuntime] ${direction} ${entry.label}:`, error);
      }
    });
  }
  /**
   * Record a change outside the document as one history entry. `ops` (optional) are its document
   * part, applied now as one step; without them the entry holds the outside change only.
   */
  recordExternal(
    label: string,
    effect: CatalogExternalEffect,
    ops: readonly CatalogOperation[] = [],
    consumer?: CatalogStepConsumer,
  ): CatalogTransactionResult | undefined {
    const session = this.current();
    if (!ops.length) {
      session.undo.push({ label, forward: [], inverse: [], external: effect });
      session.redo.length = 0;
      this.notifyHistory(session);
      return undefined;
    }
    const result = this.step(
      session,
      label,
      ops,
      session.graph.revision,
      consumer,
      (step) => {
        session.undo.push({
          label,
          forward: step.forward,
          inverse: step.inverse,
          external: effect,
        });
        session.redo.length = 0;
      },
    );
    this.notifyHistory(session);
    return result;
  }
  get lastInvalidatedIds(): readonly string[] {
    return this.current().invalidatedIds;
  }
  private current(): ProjectSession {
    return this.projects.get(this.activeId)!;
  }

  private resolved(
    session: ProjectSession,
    id: NodeId,
    state?: StateName,
  ): ResolvedCatalogNode {
    let byState = session.resolved.get(id);
    if (!byState) {
      byState = new Map();
      session.resolved.set(id, byState);
    }
    const key = state ?? "base";
    let value = byState.get(key);
    if (!value) {
      value = resolveCatalogNode(session.graph, id, state);
      byState.set(key, value);
    }
    return value;
  }
  selectEntryField(id: string, field: string): unknown {
    return readField(this.graph.getEntry(id), field);
  }
  selectResolvedField(id: NodeId, field: string, state?: StateName): unknown {
    return readField(this.resolved(this.current(), id, state), field);
  }
  subscribeEntryField(
    id: string,
    field: string,
    notify: (value: unknown) => void,
  ): () => void {
    return this.subscribe({
      id,
      field,
      source: "entry",
      notify,
      value: this.selectEntryField(id, field),
    });
  }
  subscribeResolvedField(
    id: NodeId,
    field: string,
    notify: (value: unknown) => void,
    state?: StateName,
  ): () => void {
    return this.subscribe({
      id,
      field,
      source: "resolved",
      state,
      notify,
      value: this.selectResolvedField(id, field, state),
    });
  }
  /** Listen to every published step of the active project (dispatch, undo, redo). */
  subscribeSteps(listener: CatalogStepListener): () => void {
    const session = this.current();
    session.stepListeners.add(listener);
    return () => session.stepListeners.delete(listener);
  }
  private subscribe(subscription: Subscription): () => void {
    const session = this.current();
    let set = session.subscriptions.get(subscription.id);
    if (!set) {
      set = new Set();
      session.subscriptions.set(subscription.id, set);
    }
    set.add(subscription);
    return () => {
      set!.delete(subscription);
      if (!set!.size) session.subscriptions.delete(subscription.id);
    };
  }

  dispatch(
    label: string,
    ops: readonly CatalogOperation[],
    expectedRevision = this.graph.revision,
    consumer?: CatalogStepConsumer,
  ): CatalogTransactionResult {
    const session = this.current();
    const result = this.step(
      session,
      label,
      ops,
      expectedRevision,
      consumer,
      (step) => {
        session.undo.push({
          label,
          forward: step.forward,
          inverse: step.inverse,
        });
        session.redo.length = 0;
      },
    );
    this.notifyHistory(session);
    return result;
  }
  /**
   * A step another runtime already recorded (a Preview replica taking the editor's delta): the
   * same validation, consumer and subscribers, but no history entry and no pending save.
   */
  sync(
    label: string,
    ops: readonly CatalogOperation[],
    consumer?: CatalogStepConsumer,
  ): CatalogTransactionResult {
    const session = this.current();
    return this.step(
      session,
      label,
      ops,
      session.graph.revision,
      consumer,
      () => undefined,
      "sync",
    );
  }
  undo(consumer?: CatalogStepConsumer): CatalogTransactionResult | undefined {
    const session = this.current();
    const entry = session.undo.at(-1);
    if (!entry) return undefined;
    const move = () => {
      session.undo.pop();
      session.redo.push(entry);
    };
    const result = entry.inverse.length
      ? this.step(
          session,
          `Undo ${entry.label}`,
          entry.inverse,
          session.graph.revision,
          consumer,
          move,
        )
      : (move(), undefined);
    this.runExternal(session, entry, "undo");
    this.notifyHistory(session);
    return result;
  }
  redo(consumer?: CatalogStepConsumer): CatalogTransactionResult | undefined {
    const session = this.current();
    const entry = session.redo.at(-1);
    if (!entry) return undefined;
    const move = () => {
      session.redo.pop();
      session.undo.push(entry);
    };
    const result = entry.forward.length
      ? this.step(
          session,
          `Redo ${entry.label}`,
          entry.forward,
          session.graph.revision,
          consumer,
          move,
        )
      : (move(), undefined);
    this.runExternal(session, entry, "redo");
    this.notifyHistory(session);
    return result;
  }
  /**
   * One step as a unit. The transaction is staged into the graph, then the consumer takes it; if
   * the consumer throws, the graph commit is reverted and nothing is published (no pending save,
   * no history change, no subscriber call). Otherwise the step is published — pending save,
   * history, cache invalidation, runtime subscribers, then the consumer's own subscribers — and
   * subscriber errors are raised together once all of it is done.
   */
  private step(
    session: ProjectSession,
    label: string,
    ops: readonly CatalogOperation[],
    expectedRevision: number,
    consumer: CatalogStepConsumer | undefined,
    record: (result: CatalogTransactionResult) => void,
    mode: "record" | "sync" = "record",
  ): CatalogTransactionResult {
    const preAffected = session.graph.collectAffectedIds(
      ops.map((op) => (op.kind === "put" ? op.entry.id : op.id)),
    );
    const result = applyCatalogTransaction(session.graph, {
      projectId: session.graph.projectId,
      expectedRevision,
      ops,
      history:
        mode === "record"
          ? { kind: "record", label }
          : { kind: "skip", reason: "sync" },
    });
    const invalidatedIds = [
      ...new Set([
        ...preAffected,
        ...session.graph.collectAffectedIds([
          ...result.changedIds,
          ...result.removedIds,
        ]),
      ]),
    ];
    let deliver: (() => readonly unknown[]) | void;
    try {
      deliver = consumer?.({ result, invalidatedIds });
    } catch (cause) {
      session.graph.revertCommit(result.revision);
      throw new CatalogStepAbortedError(label, session.graph.revision, cause);
    }
    if (mode === "record") {
      const changed = [...result.changedIds].map((id) => {
        const entry = session.graph.getEntry(id) as CatalogEntry;
        return { id, json: JSON.stringify(entry) };
      });
      session.pending.push({
        projectId: session.graph.projectId,
        expectedDurableRevision: result.revision - 1,
        revision: result.revision,
        changed,
        removedIds: [...result.removedIds],
      });
    }
    record(result);
    session.invalidatedIds = invalidatedIds;
    for (const id of invalidatedIds) session.resolved.delete(id);
    const errors = this.notify(session, invalidatedIds);
    for (const listener of session.stepListeners)
      try {
        listener({ result, invalidatedIds });
      } catch (error) {
        errors.push(error);
      }
    if (deliver) errors.push(...deliver());
    if (errors.length) throw new CatalogSubscriberError(result, errors);
    return result;
  }
  /** Every subscriber is called; the errors they throw are returned, not raised. */
  private notify(session: ProjectSession, ids: readonly string[]): unknown[] {
    const errors: unknown[] = [];
    for (const id of ids) {
      const subscriptions = session.subscriptions.get(id);
      if (!subscriptions) continue;
      for (const subscription of subscriptions) {
        try {
          const next =
            subscription.source === "entry"
              ? readField(session.graph.getEntry(id), subscription.field)
              : session.graph.getEntry(id)?.kind === "node"
                ? readField(
                    this.resolved(session, id as NodeId, subscription.state),
                    subscription.field,
                  )
                : undefined;
          if (!sameValue(next, subscription.value)) {
            subscription.value = next;
            subscription.notify(next);
          }
        } catch (error) {
          errors.push(error);
        }
      }
    }
    return errors;
  }

  /** Each save is pinned to a project and revision; only IDB oncomplete advances durableRevision. */
  save(projectId: CatalogDocument["projectId"] = this.activeId): Promise<void> {
    const session = this.projects.get(projectId);
    if (!session) return Promise.reject(new Error("PROJECT_NOT_OPEN"));
    const storage = this.storage;
    if (!storage) return Promise.reject(new Error("CATALOG_READ_ONLY_REPLICA"));
    const targetRevision = session.graph.revision;
    const run = async (): Promise<void> => {
      while (
        session.pending.length &&
        session.pending[0].revision <= targetRevision
      ) {
        const commit = session.pending[0];
        await storage.commit(commit);
        session.durableRevision = commit.revision;
        session.pending.shift();
      }
    };
    const next = session.saveTail.then(run, run);
    session.saveTail = next.catch(() => undefined);
    return next;
  }
}
