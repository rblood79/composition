import {
  assertContinuousEditorMutation,
  classifyEditorMutation,
} from "./editorMutationClassifier";
import {
  toEditorPresentationTargetKey,
  type BeginEditorPresentationInput,
  type ClassifiedEditorMutation,
  type EditorMutationDescriptor,
  type EditorPresentationCancelReason,
  type EditorPresentationFinishResult,
  type EditorPresentationHandle,
  type EditorPresentationScopedTargetKey,
  type EditorPresentationSession,
  type EditorPresentationSnapshot,
  type EditorPresentationTargetKey,
  type EditorPresentationTargetRef,
  type EditorStructureOperation,
  toEditorPresentationScopedTargetKey,
} from "./editorPresentationTypes";
import type { FillItem } from "../../types/builder/fill.types";

export interface EditorPresentationFrameScheduler {
  cancel(handle: number): void;
  request(callback: (timestamp: number) => void): number;
}

export interface EditorPresentationCommitInput {
  readonly baseDocumentVersion: number;
  readonly commitIntent: string;
  readonly descriptor: EditorMutationDescriptor;
  readonly projectId: string;
  readonly sessionId: string;
  readonly targets: readonly EditorPresentationTargetRef[];
}

export interface EditorPresentationCommitResult {
  readonly committedDocumentRevision: number;
}

export interface EditorPresentationRuntimeOptions {
  readonly commit: (
    input: EditorPresentationCommitInput,
  ) => EditorPresentationCommitResult;
  readonly hasTarget?: (
    projectId: string,
    target: EditorPresentationTargetRef,
  ) => boolean;
  readonly isDescriptorEqualToBase?: (
    descriptor: EditorMutationDescriptor,
    baseValue: unknown,
  ) => boolean;
  readonly onCancel?: (
    sessionId: string,
    reason: EditorPresentationCancelReason,
  ) => void;
  readonly readDocumentVersion: (projectId: string) => number;
  readonly readTargetValue: (
    projectId: string,
    target: EditorPresentationTargetRef,
  ) => unknown;
  readonly scheduler?: EditorPresentationFrameScheduler;
}

export interface EditorPresentationRuntimeDiagnostics {
  readonly frameApplyCount: number;
  readonly frameSessionVisitCount: number;
  readonly snapshotMaterializationCount: number;
  readonly staleFrameCallbackCount: number;
}

export type EditorPresentationSessionEvent =
  | {
      readonly session: EditorPresentationSession;
      readonly type: "updated";
    }
  | {
      readonly finalDescriptor: EditorMutationDescriptor | null;
      readonly result: EditorPresentationFinishResult;
      readonly session: EditorPresentationSession;
      readonly type: "terminal";
    };

class ImmutableMap<K, V> implements ReadonlyMap<K, V> {
  readonly #values: Map<K, V>;

  constructor(values?: Iterable<readonly [K, V]>) {
    this.#values = new Map(values);
  }

  get size(): number {
    return this.#values.size;
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.#values[Symbol.iterator]();
  }

  entries(): MapIterator<[K, V]> {
    return this.#values.entries();
  }

  forEach(
    callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void,
    thisArg?: unknown,
  ): void {
    this.#values.forEach((value, key) =>
      callbackfn.call(thisArg, value, key, this),
    );
  }

  get(key: K): V | undefined {
    return this.#values.get(key);
  }

  has(key: K): boolean {
    return this.#values.has(key);
  }

  keys(): MapIterator<K> {
    return this.#values.keys();
  }

  values(): MapIterator<V> {
    return this.#values.values();
  }
}

interface HandleState {
  finishResult: EditorPresentationFinishResult | null;
}

interface RuntimeSession {
  applied: ClassifiedEditorMutation | null;
  baseDocumentVersion: number;
  readonly baseValues: ReadonlyMap<EditorPresentationTargetKey, unknown>;
  readonly commitIntent: string;
  readonly handleState: HandleState;
  readonly ownerId: string;
  pending: EditorMutationDescriptor | null;
  readonly projectId: string;
  revision: number;
  readonly sessionId: string;
  readonly scopedTargetKeys: ReadonlyMap<
    EditorPresentationTargetKey,
    EditorPresentationScopedTargetKey
  >;
  status: "active" | "closing" | "failed";
  readonly targetKeys: ReadonlySet<EditorPresentationTargetKey>;
  readonly targets: readonly EditorPresentationTargetRef[];
}

interface ScheduledFrame {
  readonly handle: number;
  readonly token: number;
}

const EMPTY_TARGET_SNAPSHOT: readonly ClassifiedEditorMutation[] =
  Object.freeze([]);
const EMPTY_SCOPED_TARGET_KEYS: ReadonlySet<EditorPresentationScopedTargetKey> =
  new Set();

const browserFrameScheduler: EditorPresentationFrameScheduler = {
  cancel: (handle) => cancelAnimationFrame(handle),
  request: (callback) => requestAnimationFrame(callback),
};

function isPlainRecord(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clonePresentationValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(clonePresentationValue));
  }
  if (value !== null && typeof value === "object") {
    if (!isPlainRecord(value)) {
      throw new Error(
        "Editor presentation payload must contain plain data only",
      );
    }
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
          key,
          clonePresentationValue(entry),
        ]),
      ),
    );
  }
  if (typeof value === "function" || typeof value === "symbol") {
    throw new Error(
      "Editor presentation payload must be structured-clone compatible",
    );
  }
  return value;
}

function arePresentationValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    return (
      left.length === right.length &&
      left.every((entry, index) =>
        arePresentationValuesEqual(entry, right[index]),
      )
    );
  }
  if (
    left !== null &&
    right !== null &&
    typeof left === "object" &&
    typeof right === "object" &&
    isPlainRecord(left) &&
    isPlainRecord(right)
  ) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) =>
          Object.prototype.hasOwnProperty.call(right, key) &&
          arePresentationValuesEqual(left[key], right[key]),
      )
    );
  }
  return false;
}

function normalizeTarget(
  target: EditorPresentationTargetRef,
): EditorPresentationTargetRef {
  if (target.kind === "canonical-node") {
    if (target.nodeId.length === 0) {
      throw new Error("Editor presentation canonical target requires nodeId");
    }
    return Object.freeze({ kind: target.kind, nodeId: target.nodeId });
  }
  if (target.refId.length === 0 || target.pathKey.length === 0) {
    throw new Error(
      "Editor presentation ref descendant requires refId and pathKey",
    );
  }
  return Object.freeze({
    kind: target.kind,
    pathKey: target.pathKey,
    refId: target.refId,
  });
}

function normalizeDescriptor(
  descriptor: EditorMutationDescriptor,
): EditorMutationDescriptor {
  const target = normalizeTarget(descriptor.target);
  switch (descriptor.type) {
    case "fills.replace":
      return Object.freeze({
        fills: clonePresentationValue(descriptor.fills) as readonly FillItem[],
        target,
        type: descriptor.type,
      });
    case "geometry.patch":
    case "style.patch":
      return Object.freeze({
        patch: clonePresentationValue(descriptor.patch) as Readonly<
          Record<string, unknown>
        >,
        target,
        type: descriptor.type,
      });
    case "structure.patch":
      return Object.freeze({
        operation: clonePresentationValue(
          descriptor.operation,
        ) as EditorStructureOperation,
        target,
        type: descriptor.type,
      });
  }
}

function toPublicSession(session: RuntimeSession): EditorPresentationSession {
  return Object.freeze({
    applied: session.applied,
    baseDocumentVersion: session.baseDocumentVersion,
    baseValues: session.baseValues,
    commitIntent: session.commitIntent,
    ownerId: session.ownerId,
    pending: null,
    projectId: session.projectId,
    revision: session.revision,
    sessionId: session.sessionId,
    status: session.status,
    targets: session.targets,
  });
}

export class EditorPresentationTransactionRuntime {
  readonly #activeSessionIdByTarget = new Map<
    EditorPresentationScopedTargetKey,
    string
  >();
  readonly #commit: EditorPresentationRuntimeOptions["commit"];
  readonly #hasTarget: NonNullable<
    EditorPresentationRuntimeOptions["hasTarget"]
  >;
  readonly #isDescriptorEqualToBase: NonNullable<
    EditorPresentationRuntimeOptions["isDescriptorEqualToBase"]
  >;
  readonly #listeners = new Set<() => void>();
  readonly #sessionEventListeners = new Set<
    (event: EditorPresentationSessionEvent) => void
  >();
  readonly #onCancel: EditorPresentationRuntimeOptions["onCancel"];
  readonly #readDocumentVersion: EditorPresentationRuntimeOptions["readDocumentVersion"];
  readonly #readTargetValue: EditorPresentationRuntimeOptions["readTargetValue"];
  readonly #scheduler: EditorPresentationFrameScheduler;
  readonly #pendingSessionIds = new Set<string>();
  readonly #publicSessions = new Map<string, EditorPresentationSession>();
  readonly #sessions = new Map<string, RuntimeSession>();
  readonly #overlaysByTarget = new Map<
    EditorPresentationScopedTargetKey,
    readonly ClassifiedEditorMutation[]
  >();
  readonly #targetListeners = new Map<
    EditorPresentationScopedTargetKey,
    Set<() => void>
  >();

  #frameApplyCount = 0;
  #frameSessionVisitCount = 0;
  #frameToken = 0;
  #nextSessionId = 0;
  #scheduledFrame: ScheduledFrame | null = null;
  #snapshotDirty = false;
  #snapshotMaterializationCount = 0;
  #snapshotVersion = 0;
  #snapshot: EditorPresentationSnapshot = Object.freeze({
    overlaysByTarget: new ImmutableMap<
      EditorPresentationScopedTargetKey,
      readonly ClassifiedEditorMutation[]
    >(),
    sessions: new ImmutableMap<string, EditorPresentationSession>(),
    version: 0,
  });
  #staleFrameCallbackCount = 0;

  constructor(options: EditorPresentationRuntimeOptions) {
    this.#commit = options.commit;
    this.#hasTarget = options.hasTarget ?? (() => true);
    this.#isDescriptorEqualToBase =
      options.isDescriptorEqualToBase ?? (() => false);
    this.#onCancel = options.onCancel;
    this.#readDocumentVersion = options.readDocumentVersion;
    this.#readTargetValue = options.readTargetValue;
    this.#scheduler = options.scheduler ?? browserFrameScheduler;
  }

  getSnapshot = (): EditorPresentationSnapshot => {
    if (this.#snapshotDirty) {
      this.#snapshot = Object.freeze({
        overlaysByTarget: new ImmutableMap(this.#overlaysByTarget),
        sessions: new ImmutableMap(this.#publicSessions),
        version: this.#snapshotVersion,
      });
      this.#snapshotDirty = false;
      this.#snapshotMaterializationCount += 1;
    }
    return this.#snapshot;
  };

  getTargetSnapshot(
    projectId: string,
    target: EditorPresentationTargetRef,
  ): readonly ClassifiedEditorMutation[] {
    return (
      this.#overlaysByTarget.get(
        toEditorPresentationScopedTargetKey(projectId, target),
      ) ?? EMPTY_TARGET_SNAPSHOT
    );
  }

  getDiagnostics(): EditorPresentationRuntimeDiagnostics {
    return Object.freeze({
      frameApplyCount: this.#frameApplyCount,
      frameSessionVisitCount: this.#frameSessionVisitCount,
      snapshotMaterializationCount: this.#snapshotMaterializationCount,
      staleFrameCallbackCount: this.#staleFrameCallbackCount,
    });
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  subscribeSessionEvents(
    listener: (event: EditorPresentationSessionEvent) => void,
  ): () => void {
    this.#sessionEventListeners.add(listener);
    return () => this.#sessionEventListeners.delete(listener);
  }

  subscribeTarget(
    projectId: string,
    target: EditorPresentationTargetRef,
    listener: () => void,
  ): () => void {
    const key = toEditorPresentationScopedTargetKey(projectId, target);
    const listeners = this.#targetListeners.get(key) ?? new Set<() => void>();
    listeners.add(listener);
    this.#targetListeners.set(key, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.#targetListeners.delete(key);
    };
  }

  beginEditorPresentation(
    input: BeginEditorPresentationInput,
  ): EditorPresentationHandle {
    if (input.targets.length === 0) {
      throw new Error(
        "Editor presentation requires at least one semantic target",
      );
    }

    const targetsByKey = new Map<
      EditorPresentationTargetKey,
      EditorPresentationTargetRef
    >();
    for (const rawTarget of input.targets) {
      const target = normalizeTarget(rawTarget);
      if (!this.#hasTarget(input.projectId, target)) {
        throw new Error(
          `Editor presentation target is not available: ${toEditorPresentationTargetKey(
            target,
          )}`,
        );
      }
      targetsByKey.set(toEditorPresentationTargetKey(target), target);
    }
    const targets = Object.freeze([...targetsByKey.values()]);
    const targetKeys = new Set(targetsByKey.keys());
    const scopedTargetKeys = new Map<
      EditorPresentationTargetKey,
      EditorPresentationScopedTargetKey
    >(
      [...targetsByKey].map(([key, target]) => [
        key,
        toEditorPresentationScopedTargetKey(input.projectId, target),
      ]),
    );
    const initialDescriptor = input.initialDescriptor
      ? normalizeDescriptor(input.initialDescriptor)
      : null;
    if (initialDescriptor) {
      const initialTargetKey = toEditorPresentationTargetKey(
        initialDescriptor.target,
      );
      if (!targetKeys.has(initialTargetKey)) {
        throw new Error(
          `Editor presentation descriptor target is outside begin scope: ${initialTargetKey}`,
        );
      }
      assertContinuousEditorMutation(initialDescriptor);
      classifyEditorMutation(initialDescriptor);
    }

    const baseValues = new Map<EditorPresentationTargetKey, unknown>();
    for (const target of targets) {
      baseValues.set(
        toEditorPresentationTargetKey(target),
        clonePresentationValue(this.#readTargetValue(input.projectId, target)),
      );
    }
    const baseDocumentVersion = this.#readDocumentVersion(input.projectId);

    const supersededSessionIds = new Set<string>();
    for (const key of scopedTargetKeys.values()) {
      const sessionId = this.#activeSessionIdByTarget.get(key);
      if (sessionId) supersededSessionIds.add(sessionId);
    }
    for (const sessionId of supersededSessionIds) {
      this.#cancelSession(sessionId, "superseded");
    }

    this.#nextSessionId += 1;
    const sessionId = `editor-presentation-${this.#nextSessionId}`;
    const handleState: HandleState = { finishResult: null };
    const session: RuntimeSession = {
      applied: null,
      baseDocumentVersion,
      baseValues: new ImmutableMap(baseValues),
      commitIntent: input.commitIntent,
      handleState,
      ownerId: input.ownerId,
      pending: null,
      projectId: input.projectId,
      revision: 0,
      sessionId,
      scopedTargetKeys,
      status: "active",
      targetKeys,
      targets,
    };
    this.#sessions.set(sessionId, session);
    for (const key of scopedTargetKeys.values()) {
      this.#activeSessionIdByTarget.set(key, sessionId);
    }
    this.#replaceSnapshotSession(session);

    const handle = this.#createHandle(session);
    if (initialDescriptor) {
      handle.publish(initialDescriptor);
    }
    return handle;
  }

  reconcileDocumentVersion(projectId: string): void {
    const sessions = [...this.#sessions.values()].filter(
      (session) =>
        session.projectId === projectId && session.status === "active",
    );
    for (const session of sessions) {
      if (this.#hasConflict(session)) {
        this.#cancelSession(session.sessionId, "conflict");
        continue;
      }
      const nextVersion = this.#readDocumentVersion(projectId);
      if (nextVersion !== session.baseDocumentVersion) {
        session.baseDocumentVersion = nextVersion;
        this.#replaceSnapshotSession(session);
      }
    }
  }

  cancelProjectSessions(
    projectId: string,
    reason: EditorPresentationCancelReason,
  ): number {
    const sessionIds = [...this.#sessions.values()]
      .filter((session) => session.projectId === projectId)
      .map((session) => session.sessionId);
    let cancelled = 0;
    for (const sessionId of sessionIds) {
      if (this.#cancelSession(sessionId, reason)) cancelled += 1;
    }
    return cancelled;
  }

  #createHandle(session: RuntimeSession): EditorPresentationHandle {
    return Object.freeze({
      cancel: (reason: EditorPresentationCancelReason): boolean =>
        this.#cancelSession(session.sessionId, reason),
      finish: (
        finalDescriptor?: EditorMutationDescriptor,
      ): EditorPresentationFinishResult =>
        session.handleState.finishResult ??
        this.#finishSession(session.sessionId, finalDescriptor),
      publish: (descriptor: EditorMutationDescriptor): boolean =>
        this.#publish(session.sessionId, descriptor),
      sessionId: session.sessionId,
    });
  }

  #publish(sessionId: string, descriptor: EditorMutationDescriptor): boolean {
    const session = this.#sessions.get(sessionId);
    if (!session || session.status !== "active") return false;

    const normalized = normalizeDescriptor(descriptor);
    this.#assertDescriptorInScope(session, normalized);
    assertContinuousEditorMutation(normalized);
    classifyEditorMutation(normalized);

    if (
      (session.pending &&
        arePresentationValuesEqual(session.pending, normalized)) ||
      (!session.pending &&
        session.applied &&
        arePresentationValuesEqual(session.applied.descriptor, normalized))
    ) {
      return true;
    }

    session.pending = normalized;
    this.#pendingSessionIds.add(sessionId);
    this.#scheduleFrame();
    return true;
  }

  #scheduleFrame(): void {
    if (this.#scheduledFrame) return;
    this.#frameToken += 1;
    const token = this.#frameToken;
    const handle = this.#scheduler.request(() => {
      if (!this.#scheduledFrame || this.#scheduledFrame.token !== token) {
        this.#staleFrameCallbackCount += 1;
        return;
      }
      this.#scheduledFrame = null;
      this.#flushFrame();
    });
    this.#scheduledFrame = { handle, token };
  }

  #flushFrame(): void {
    const pendingSessionIds = [...this.#pendingSessionIds];
    this.#pendingSessionIds.clear();
    const changedSessions = new Map<string, RuntimeSession>();
    const overlayChanges = new Map<
      EditorPresentationScopedTargetKey,
      readonly ClassifiedEditorMutation[] | null
    >();

    for (const sessionId of pendingSessionIds) {
      this.#frameSessionVisitCount += 1;
      const session = this.#sessions.get(sessionId);
      if (!session) continue;
      if (session.status !== "active" || !session.pending) continue;
      const descriptor = session.pending;
      session.pending = null;
      const targetKey = toEditorPresentationTargetKey(descriptor.target);
      const scopedTargetKey = session.scopedTargetKeys.get(targetKey)!;
      const baseValue = session.baseValues.get(targetKey);
      const appliedTargetKey = session.applied
        ? toEditorPresentationTargetKey(session.applied.descriptor.target)
        : null;
      const appliedScopedTargetKey = appliedTargetKey
        ? session.scopedTargetKeys.get(appliedTargetKey)!
        : null;

      if (this.#isDescriptorEqualToBase(descriptor, baseValue)) {
        if (session.applied) {
          session.applied = null;
          session.revision += 1;
          changedSessions.set(session.sessionId, session);
          if (appliedScopedTargetKey) {
            overlayChanges.set(appliedScopedTargetKey, null);
          }
        }
        continue;
      }

      if (
        session.applied &&
        arePresentationValuesEqual(session.applied.descriptor, descriptor)
      ) {
        continue;
      }

      const classified = classifyEditorMutation(descriptor);
      session.applied = classified;
      session.revision += 1;
      changedSessions.set(session.sessionId, session);
      if (appliedScopedTargetKey && appliedTargetKey !== targetKey) {
        overlayChanges.set(appliedScopedTargetKey, null);
      }
      overlayChanges.set(scopedTargetKey, Object.freeze([classified]));
    }

    if (changedSessions.size === 0) return;
    this.#frameApplyCount += 1;
    this.#applySnapshotChanges(changedSessions, overlayChanges);
  }

  #cancelScheduledFrameIfIdle(): void {
    if (!this.#scheduledFrame) return;
    if (this.#pendingSessionIds.size > 0) return;
    this.#scheduler.cancel(this.#scheduledFrame.handle);
    this.#scheduledFrame = null;
  }

  #assertDescriptorInScope(
    session: RuntimeSession,
    descriptor: EditorMutationDescriptor,
  ): void {
    const targetKey = toEditorPresentationTargetKey(descriptor.target);
    if (!session.targetKeys.has(targetKey)) {
      throw new Error(
        `Editor presentation descriptor target is outside begin scope: ${targetKey}`,
      );
    }
  }

  #finishSession(
    sessionId: string,
    finalDescriptor?: EditorMutationDescriptor,
  ): EditorPresentationFinishResult {
    const session = this.#sessions.get(sessionId);
    if (!session) {
      return { reason: "superseded", status: "cancelled" };
    }
    if (session.handleState.finishResult) {
      return session.handleState.finishResult;
    }
    if (session.status !== "active") {
      return { reason: "conflict", status: "cancelled" };
    }

    session.status = "closing";
    let descriptor: EditorMutationDescriptor | null;
    try {
      descriptor = finalDescriptor
        ? normalizeDescriptor(finalDescriptor)
        : (session.pending ?? session.applied?.descriptor ?? null);
      if (descriptor) {
        this.#assertDescriptorInScope(session, descriptor);
        assertContinuousEditorMutation(descriptor);
        classifyEditorMutation(descriptor);
      }
    } catch (error: unknown) {
      session.pending = null;
      this.#pendingSessionIds.delete(sessionId);
      this.#cancelScheduledFrameIfIdle();
      return this.#failSession(session, error, null);
    }
    session.pending = null;
    this.#pendingSessionIds.delete(sessionId);
    this.#cancelScheduledFrameIfIdle();

    if (this.#hasConflict(session)) {
      this.#cancelSession(sessionId, "conflict");
      return session.handleState.finishResult!;
    }
    session.baseDocumentVersion = this.#readDocumentVersion(session.projectId);

    if (!descriptor) {
      const result: EditorPresentationFinishResult = { status: "no-op" };
      this.#completeSession(session, result, null);
      return result;
    }

    const targetKey = toEditorPresentationTargetKey(descriptor.target);
    if (
      this.#isDescriptorEqualToBase(
        descriptor,
        session.baseValues.get(targetKey),
      )
    ) {
      const result: EditorPresentationFinishResult = { status: "no-op" };
      this.#completeSession(session, result, descriptor);
      return result;
    }

    this.#applyClosingDescriptor(session, descriptor);

    try {
      const commitResult = this.#commit(
        Object.freeze({
          baseDocumentVersion: session.baseDocumentVersion,
          commitIntent: session.commitIntent,
          descriptor,
          projectId: session.projectId,
          sessionId: session.sessionId,
          targets: session.targets,
        }),
      );
      const result: EditorPresentationFinishResult = Object.freeze({
        committedDocumentRevision: commitResult.committedDocumentRevision,
        status: "committed",
      });
      this.#completeSession(session, result, descriptor);
      return result;
    } catch (error: unknown) {
      return this.#failSession(session, error, descriptor);
    }
  }

  #failSession(
    session: RuntimeSession,
    error: unknown,
    finalDescriptor: EditorMutationDescriptor | null,
  ): EditorPresentationFinishResult {
    session.status = "failed";
    const result: EditorPresentationFinishResult = Object.freeze({
      error,
      status: "failed",
    });
    session.handleState.finishResult = result;

    if (!finalDescriptor) {
      this.#replaceSnapshotSession(session);
      return result;
    }

    if (
      session.applied &&
      arePresentationValuesEqual(session.applied.descriptor, finalDescriptor)
    ) {
      this.#replaceSnapshotSession(session);
      return result;
    }

    const previousTargetKey = session.applied
      ? toEditorPresentationTargetKey(session.applied.descriptor.target)
      : null;
    const nextTargetKey = toEditorPresentationTargetKey(finalDescriptor.target);
    const classified = classifyEditorMutation(finalDescriptor);
    session.applied = classified;
    session.revision += 1;
    const overlayChanges = new Map<
      EditorPresentationScopedTargetKey,
      readonly ClassifiedEditorMutation[] | null
    >();
    if (previousTargetKey && previousTargetKey !== nextTargetKey) {
      overlayChanges.set(
        session.scopedTargetKeys.get(previousTargetKey)!,
        null,
      );
    }
    overlayChanges.set(
      session.scopedTargetKeys.get(nextTargetKey)!,
      Object.freeze([classified]),
    );
    this.#applySnapshotChanges(
      new Map([[session.sessionId, session]]),
      overlayChanges,
    );
    return result;
  }

  #applyClosingDescriptor(
    session: RuntimeSession,
    descriptor: EditorMutationDescriptor,
  ): void {
    if (
      session.applied &&
      arePresentationValuesEqual(session.applied.descriptor, descriptor)
    ) {
      this.#replaceSnapshotSession(session);
      return;
    }

    const previousTargetKey = session.applied
      ? toEditorPresentationTargetKey(session.applied.descriptor.target)
      : null;
    const nextTargetKey = toEditorPresentationTargetKey(descriptor.target);
    const classified = classifyEditorMutation(descriptor);
    session.applied = classified;
    session.revision += 1;
    const overlayChanges = new Map<
      EditorPresentationScopedTargetKey,
      readonly ClassifiedEditorMutation[] | null
    >();
    if (previousTargetKey && previousTargetKey !== nextTargetKey) {
      overlayChanges.set(
        session.scopedTargetKeys.get(previousTargetKey)!,
        null,
      );
    }
    overlayChanges.set(
      session.scopedTargetKeys.get(nextTargetKey)!,
      Object.freeze([classified]),
    );
    this.#applySnapshotChanges(
      new Map([[session.sessionId, session]]),
      overlayChanges,
    );
  }

  #cancelSession(
    sessionId: string,
    reason: EditorPresentationCancelReason,
  ): boolean {
    const session = this.#sessions.get(sessionId);
    if (!session) return false;
    if (session.status === "failed") {
      session.handleState.finishResult = null;
    } else if (session.handleState.finishResult) {
      return false;
    }

    const result: EditorPresentationFinishResult = Object.freeze({
      reason,
      status: "cancelled",
    });
    session.handleState.finishResult = result;
    session.pending = null;
    this.#pendingSessionIds.delete(sessionId);
    const publicSession = toPublicSession(session);
    this.#removeSession(session);
    this.#cancelScheduledFrameIfIdle();
    this.#removeSnapshotSession(session);
    this.#publishSessionEvent(
      Object.freeze({
        finalDescriptor: null,
        result,
        session: publicSession,
        type: "terminal",
      }),
    );
    this.#onCancel?.(sessionId, reason);
    return true;
  }

  #completeSession(
    session: RuntimeSession,
    result: EditorPresentationFinishResult,
    finalDescriptor: EditorMutationDescriptor | null,
  ): void {
    session.handleState.finishResult = result;
    const publicSession = toPublicSession(session);
    this.#removeSession(session);
    this.#removeSnapshotSession(session);
    this.#publishSessionEvent(
      Object.freeze({
        finalDescriptor,
        result,
        session: publicSession,
        type: "terminal",
      }),
    );
  }

  #removeSession(session: RuntimeSession): void {
    this.#pendingSessionIds.delete(session.sessionId);
    this.#sessions.delete(session.sessionId);
    for (const key of session.scopedTargetKeys.values()) {
      if (this.#activeSessionIdByTarget.get(key) === session.sessionId) {
        this.#activeSessionIdByTarget.delete(key);
      }
    }
  }

  #hasConflict(session: RuntimeSession): boolean {
    const currentVersion = this.#readDocumentVersion(session.projectId);
    if (currentVersion === session.baseDocumentVersion) return false;
    for (const target of session.targets) {
      if (!this.#hasTarget(session.projectId, target)) return true;
      const key = toEditorPresentationTargetKey(target);
      if (
        !arePresentationValuesEqual(
          session.baseValues.get(key),
          this.#readTargetValue(session.projectId, target),
        )
      ) {
        return true;
      }
    }
    return false;
  }

  #replaceSnapshotSession(session: RuntimeSession): void {
    const publicSession = toPublicSession(session);
    this.#publicSessions.set(session.sessionId, publicSession);
    this.#publishSnapshot(EMPTY_SCOPED_TARGET_KEYS);
    this.#publishSessionEvent(
      Object.freeze({ session: publicSession, type: "updated" }),
    );
  }

  #removeSnapshotSession(session: RuntimeSession): void {
    this.#publicSessions.delete(session.sessionId);
    const changedTargetKeys = new Set<EditorPresentationScopedTargetKey>();
    for (const key of session.scopedTargetKeys.values()) {
      if (this.#overlaysByTarget.delete(key)) changedTargetKeys.add(key);
    }
    this.#publishSnapshot(changedTargetKeys);
  }

  #applySnapshotChanges(
    changedSessions: ReadonlyMap<string, RuntimeSession>,
    overlayChanges: ReadonlyMap<
      EditorPresentationScopedTargetKey,
      readonly ClassifiedEditorMutation[] | null
    >,
  ): void {
    for (const session of changedSessions.values()) {
      this.#publicSessions.set(session.sessionId, toPublicSession(session));
    }
    for (const [key, value] of overlayChanges) {
      if (value) this.#overlaysByTarget.set(key, value);
      else this.#overlaysByTarget.delete(key);
    }
    this.#publishSnapshot(new Set(overlayChanges.keys()));
    for (const session of changedSessions.values()) {
      this.#publishSessionEvent(
        Object.freeze({ session: toPublicSession(session), type: "updated" }),
      );
    }
  }

  #publishSessionEvent(event: EditorPresentationSessionEvent): void {
    for (const listener of this.#sessionEventListeners) listener(event);
  }

  #publishSnapshot(
    changedTargetKeys: ReadonlySet<EditorPresentationScopedTargetKey>,
  ): void {
    this.#snapshotVersion += 1;
    this.#snapshotDirty = true;
    for (const listener of this.#listeners) listener();
    for (const key of changedTargetKeys) {
      for (const listener of this.#targetListeners.get(key) ?? []) listener();
    }
  }
}
