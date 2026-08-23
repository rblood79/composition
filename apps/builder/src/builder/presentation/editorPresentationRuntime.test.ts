import { describe, expect, it, vi } from "vitest";
import {
  EditorPresentationTransactionRuntime,
  type EditorPresentationFrameScheduler,
} from "./editorPresentationRuntime";
import type {
  EditorMutationDescriptor,
  EditorPresentationCancelReason,
  EditorPresentationFinishResult,
  EditorPresentationTargetRef,
} from "./editorPresentationTypes";

interface FakeFrameScheduler extends EditorPresentationFrameScheduler {
  flush(): void;
  invokeCancelled(): void;
  pendingCount(): number;
}

function createFrameScheduler(): FakeFrameScheduler {
  let nextId = 0;
  const callbacks = new Map<number, (timestamp: number) => void>();
  const cancelled: Array<(timestamp: number) => void> = [];
  return {
    cancel(handle) {
      const callback = callbacks.get(handle);
      if (callback) cancelled.push(callback);
      callbacks.delete(handle);
    },
    flush() {
      const pending = [...callbacks.values()];
      callbacks.clear();
      for (const callback of pending) callback(0);
    },
    invokeCancelled() {
      for (const callback of cancelled.splice(0)) callback(0);
    },
    pendingCount() {
      return callbacks.size;
    },
    request(callback) {
      nextId += 1;
      callbacks.set(nextId, callback);
      return nextId;
    },
  };
}

const target: EditorPresentationTargetRef = {
  kind: "canonical-node",
  nodeId: "node-1",
};
const projectId = "project-1";

function opacityDescriptor(
  opacity: number,
  descriptorTarget: EditorPresentationTargetRef = target,
): EditorMutationDescriptor {
  return {
    patch: { opacity },
    target: descriptorTarget,
    type: "style.patch",
  };
}

function createRuntime(): {
  commit: ReturnType<typeof vi.fn>;
  scheduler: FakeFrameScheduler;
  runtime: EditorPresentationTransactionRuntime;
  values: Map<string, unknown>;
  setDocumentVersion(value: number): void;
} {
  const scheduler = createFrameScheduler();
  const commit = vi.fn(() => ({ committedDocumentRevision: 2 }));
  const values = new Map<string, unknown>([["canonical-node:node-1", 0]]);
  let documentVersion = 1;
  const runtime = new EditorPresentationTransactionRuntime({
    commit,
    isDescriptorEqualToBase(descriptor, baseValue) {
      return (
        descriptor.type === "style.patch" &&
        descriptor.patch.opacity === baseValue
      );
    },
    readDocumentVersion: () => documentVersion,
    readTargetValue: (_projectId, semanticTarget) =>
      values.get(
        semanticTarget.kind === "canonical-node"
          ? `canonical-node:${semanticTarget.nodeId}`
          : `ref-descendant:${semanticTarget.refId}:${semanticTarget.pathKey}`,
      ),
    scheduler,
  });
  return {
    commit,
    runtime,
    scheduler,
    setDocumentVersion(value) {
      documentVersion = value;
    },
    values,
  };
}

function begin(
  runtime: EditorPresentationTransactionRuntime,
  sessionProjectId = projectId,
) {
  return runtime.beginEditorPresentation({
    commitIntent: "style-opacity",
    ownerId: "control-1",
    projectId: sessionProjectId,
    targets: [target],
  });
}

describe("EditorPresentationTransactionRuntime", () => {
  it("coalesces 100 publishes into one latest-wins frame", () => {
    const { runtime, scheduler } = createRuntime();
    const handle = begin(runtime);
    const listener = vi.fn();
    runtime.subscribe(listener);

    for (let value = 1; value <= 100; value += 1) {
      handle.publish(opacityDescriptor(value / 100));
    }

    expect(scheduler.pendingCount()).toBe(1);
    expect(listener).not.toHaveBeenCalled();
    scheduler.flush();

    const overlays = runtime.getTargetSnapshot(projectId, target);
    expect(overlays).toHaveLength(1);
    expect(overlays[0]?.descriptor).toEqual(opacityDescriptor(1));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(runtime.getDiagnostics()).toMatchObject({ frameApplyCount: 1 });
  });

  it("preserves typed inherited-subtree propagation at the runtime boundary", () => {
    const { runtime, scheduler } = createRuntime();
    const handle = begin(runtime);
    const descriptor: EditorMutationDescriptor = {
      patch: { color: "#222222" },
      propagation: "inherited-subtree",
      target,
      type: "style.patch",
    };

    expect(handle.publish(descriptor)).toBe(true);
    scheduler.flush();
    expect(runtime.getTargetSnapshot(projectId, target)[0]?.descriptor).toEqual(
      descriptor,
    );
  });

  it("publishes layout invalidation separately from the paint lane", () => {
    const { runtime, scheduler } = createRuntime();
    const handle = begin(runtime);
    handle.publish({
      patch: { width: 120 },
      target,
      type: "style.patch",
    });
    scheduler.flush();

    const invalidation = runtime.getSnapshot().invalidation;
    expect(invalidation.paintTargets).toEqual(
      new Set(["canonical-node:node-1"]),
    );
    expect(invalidation.layoutRoots).toEqual(new Set(["node-1"]));
    expect(invalidation.structureRoots).toEqual(new Set());
    expect(invalidation.paintRevision).toBe(1);
    expect(invalidation.layoutRevision).toBe(1);
    expect(invalidation.structureRevision).toBe(0);
  });

  it("visits only pending sessions when many sessions are active", () => {
    const { runtime, scheduler, values } = createRuntime();
    const handles = Array.from({ length: 100 }, (_, index) => {
      const sessionTarget: EditorPresentationTargetRef = {
        kind: "canonical-node",
        nodeId: `node-${index + 1}`,
      };
      values.set(`canonical-node:${sessionTarget.nodeId}`, 0);
      return {
        handle: runtime.beginEditorPresentation({
          commitIntent: "style-opacity",
          ownerId: `control-${index + 1}`,
          projectId,
          targets: [sessionTarget],
        }),
        target: sessionTarget,
      };
    });
    const before = runtime.getDiagnostics();

    handles[73]!.handle.publish(opacityDescriptor(0.5, handles[73]!.target));
    scheduler.flush();

    const afterFrame = runtime.getDiagnostics();
    expect(
      afterFrame.frameSessionVisitCount - before.frameSessionVisitCount,
    ).toBe(1);
    expect(
      afterFrame.snapshotMaterializationCount -
        before.snapshotMaterializationCount,
    ).toBe(0);

    runtime.getSnapshot();
    expect(
      runtime.getDiagnostics().snapshotMaterializationCount -
        before.snapshotMaterializationCount,
    ).toBe(1);
  });

  it("keeps snapshot and target selector identities stable for no-op frames", () => {
    const { runtime, scheduler } = createRuntime();
    const handle = begin(runtime);
    handle.publish(opacityDescriptor(0.5));
    scheduler.flush();
    const snapshot = runtime.getSnapshot();
    const targetSnapshot = runtime.getTargetSnapshot(projectId, target);

    handle.publish(opacityDescriptor(0.5));
    scheduler.flush();

    expect(runtime.getSnapshot()).toBe(snapshot);
    expect(runtime.getTargetSnapshot(projectId, target)).toBe(targetSnapshot);
  });

  it("keeps an already materialized snapshot immutable across later frames", () => {
    const { runtime, scheduler } = createRuntime();
    const handle = begin(runtime);
    handle.publish(opacityDescriptor(0.25));
    scheduler.flush();
    const firstSnapshot = runtime.getSnapshot();

    handle.publish(opacityDescriptor(0.75));
    scheduler.flush();
    const secondSnapshot = runtime.getSnapshot();

    expect(secondSnapshot).not.toBe(firstSnapshot);
    expect(
      firstSnapshot.overlaysByTarget.values().next().value?.[0]?.descriptor,
    ).toEqual(opacityDescriptor(0.25));
    expect(
      secondSnapshot.overlaysByTarget.values().next().value?.[0]?.descriptor,
    ).toEqual(opacityDescriptor(0.75));
  });

  it("batches independent targets and preserves unchanged selector identity", () => {
    const { runtime, scheduler } = createRuntime();
    const secondTarget: EditorPresentationTargetRef = {
      kind: "canonical-node",
      nodeId: "node-2",
    };
    const first = begin(runtime);
    const second = runtime.beginEditorPresentation({
      commitIntent: "style-opacity",
      ownerId: "control-2",
      projectId,
      targets: [secondTarget],
    });
    const listener = vi.fn();
    runtime.subscribe(listener);

    first.publish(opacityDescriptor(0.25));
    second.publish(opacityDescriptor(0.5, secondTarget));
    expect(scheduler.pendingCount()).toBe(1);
    scheduler.flush();
    expect(listener).toHaveBeenCalledTimes(1);

    const firstTargetSnapshot = runtime.getTargetSnapshot(projectId, target);
    second.publish(opacityDescriptor(0.75, secondTarget));
    scheduler.flush();
    expect(runtime.getTargetSnapshot(projectId, target)).toBe(
      firstTargetSnapshot,
    );
  });

  it("captures immutable descriptor data at the publish boundary", () => {
    const { runtime, scheduler } = createRuntime();
    const handle = begin(runtime);
    const patch: Record<string, unknown> = { opacity: 0.25 };
    handle.publish({ patch, target, type: "style.patch" });
    patch.opacity = 0.9;
    scheduler.flush();

    expect(runtime.getTargetSnapshot(projectId, target)[0]?.descriptor).toEqual(
      opacityDescriptor(0.25),
    );
  });

  it("retires the previous target when one session publishes a new latest target", () => {
    const { runtime, scheduler } = createRuntime();
    const secondTarget: EditorPresentationTargetRef = {
      kind: "canonical-node",
      nodeId: "node-2",
    };
    const handle = runtime.beginEditorPresentation({
      commitIntent: "style-opacity",
      ownerId: "control-1",
      projectId,
      targets: [target, secondTarget],
    });
    handle.publish(opacityDescriptor(0.25));
    scheduler.flush();
    handle.publish(opacityDescriptor(0.5, secondTarget));
    scheduler.flush();

    expect(runtime.getTargetSnapshot(projectId, target)).toHaveLength(0);
    expect(runtime.getTargetSnapshot(projectId, secondTarget)).toHaveLength(1);
  });

  it("invalidates a cancelled frame and commits only the explicit final value", () => {
    const { commit, runtime, scheduler } = createRuntime();
    const handle = begin(runtime);
    handle.publish(opacityDescriptor(0.25));

    const result = handle.finish(opacityDescriptor(0.75));
    const snapshotAfterFinish = runtime.getSnapshot();
    scheduler.invokeCancelled();

    expect(result).toEqual({
      committedDocumentRevision: 2,
      status: "committed",
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0]?.[0].descriptor).toEqual(
      opacityDescriptor(0.75),
    );
    expect(runtime.getSnapshot()).toBe(snapshotAfterFinish);
    expect(runtime.getTargetSnapshot(projectId, target)).toHaveLength(0);
    expect(runtime.getDiagnostics()).toMatchObject({
      frameApplyCount: 0,
      staleFrameCallbackCount: 1,
    });
    expect(handle.finish(opacityDescriptor(1))).toBe(result);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("materializes an explicit final descriptor before canonical handoff", () => {
    const { runtime, scheduler } = createRuntime();
    const handle = begin(runtime);
    const observed: Array<EditorMutationDescriptor | null> = [];
    runtime.subscribeTarget(projectId, target, () => {
      observed.push(
        runtime.getTargetSnapshot(projectId, target)[0]?.descriptor ?? null,
      );
    });
    handle.publish(opacityDescriptor(0.25));
    scheduler.flush();

    handle.finish(opacityDescriptor(0.75));

    expect(observed).toEqual([
      opacityDescriptor(0.25),
      opacityDescriptor(0.75),
      null,
    ]);
  });

  it("emits explicit committed and cancelled terminal outcomes", () => {
    const { runtime } = createRuntime();
    const events: Array<{
      result?: EditorPresentationFinishResult;
      sessionId: string;
      type: "terminal" | "updated";
    }> = [];
    runtime.subscribeSessionEvents((event) => {
      events.push({
        ...(event.type === "terminal" ? { result: event.result } : {}),
        sessionId: event.session.sessionId,
        type: event.type,
      });
    });

    const committed = begin(runtime);
    committed.finish(opacityDescriptor(0.75));
    const cancelled = begin(runtime);
    cancelled.cancel("pointer-cancel");

    expect(events.filter((event) => event.type === "terminal")).toEqual([
      {
        result: { committedDocumentRevision: 2, status: "committed" },
        sessionId: committed.sessionId,
        type: "terminal",
      },
      {
        result: { reason: "pointer-cancel", status: "cancelled" },
        sessionId: cancelled.sessionId,
        type: "terminal",
      },
    ]);
  });

  it("terminal event가 exact final descriptor를 전달하고 iframe reload로 project session을 정리한다", () => {
    const { runtime } = createRuntime();
    const terminals: Array<EditorMutationDescriptor | null> = [];
    runtime.subscribeSessionEvents((event) => {
      if (event.type === "terminal") terminals.push(event.finalDescriptor);
    });
    const committed = begin(runtime);
    const finalDescriptor = opacityDescriptor(0.75);
    committed.finish(finalDescriptor);

    begin(runtime);
    expect(runtime.cancelProjectSessions(projectId, "iframe-reload")).toBe(1);
    expect(terminals).toEqual([finalDescriptor, null]);
  });

  it.each<EditorPresentationCancelReason>([
    "pointer-cancel",
    "escape",
    "blur",
    "unmount",
    "selection-change",
    "document-replace",
    "iframe-reload",
  ])("cancels %s without a commit", (reason) => {
    const { commit, runtime, scheduler } = createRuntime();
    const handle = begin(runtime);
    handle.publish(opacityDescriptor(0.5));

    expect(handle.cancel(reason)).toBe(true);
    scheduler.invokeCancelled();

    expect(commit).not.toHaveBeenCalled();
    expect(runtime.getSnapshot().sessions.size).toBe(0);
    expect(runtime.getTargetSnapshot(projectId, target)).toHaveLength(0);
  });

  it("supersedes only sessions that share a semantic target", () => {
    const { runtime } = createRuntime();
    const first = begin(runtime);
    const second = runtime.beginEditorPresentation({
      commitIntent: "style-opacity",
      ownerId: "control-2",
      projectId,
      targets: [target],
    });

    expect(first.publish(opacityDescriptor(0.5))).toBe(false);
    expect(first.finish().status).toBe("cancelled");
    expect(runtime.getSnapshot().sessions.has(second.sessionId)).toBe(true);
  });

  it("isolates ownership and overlays for the same target across projects", () => {
    const { runtime, scheduler } = createRuntime();
    const first = begin(runtime);
    const second = begin(runtime, "project-2");

    first.publish(opacityDescriptor(0.25));
    scheduler.flush();
    second.publish(opacityDescriptor(0.75));
    scheduler.flush();

    expect(first.publish(opacityDescriptor(0.5))).toBe(true);
    expect(runtime.getTargetSnapshot(projectId, target)[0]?.descriptor).toEqual(
      opacityDescriptor(0.25),
    );
    expect(
      runtime.getTargetSnapshot("project-2", target)[0]?.descriptor,
    ).toEqual(opacityDescriptor(0.75));
  });

  it("notifies only subscribers for changed project targets", () => {
    const { runtime, scheduler } = createRuntime();
    const secondTarget: EditorPresentationTargetRef = {
      kind: "canonical-node",
      nodeId: "node-2",
    };
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    const otherProjectListener = vi.fn();
    runtime.subscribeTarget(projectId, target, firstListener);
    runtime.subscribeTarget(projectId, secondTarget, secondListener);
    runtime.subscribeTarget("project-2", target, otherProjectListener);
    const first = begin(runtime);
    const second = runtime.beginEditorPresentation({
      commitIntent: "style-opacity",
      ownerId: "control-2",
      projectId,
      targets: [secondTarget],
    });

    first.publish(opacityDescriptor(0.25));
    scheduler.flush();
    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(secondListener).not.toHaveBeenCalled();
    expect(otherProjectListener).not.toHaveBeenCalled();

    second.publish(opacityDescriptor(0.5, secondTarget));
    scheduler.flush();
    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(secondListener).toHaveBeenCalledTimes(1);
    expect(otherProjectListener).not.toHaveBeenCalled();
  });

  it("validates an initial descriptor before superseding an active owner", () => {
    const { runtime } = createRuntime();
    const first = begin(runtime);
    const otherTarget: EditorPresentationTargetRef = {
      kind: "canonical-node",
      nodeId: "node-2",
    };

    expect(() =>
      runtime.beginEditorPresentation({
        commitIntent: "style-opacity",
        initialDescriptor: opacityDescriptor(0.5, otherTarget),
        ownerId: "control-2",
        projectId,
        targets: [target],
      }),
    ).toThrow(/outside begin scope/);
    expect(runtime.getSnapshot().sessions.has(first.sessionId)).toBe(true);
  });

  it("captures the new base before superseding an active owner", () => {
    const scheduler = createFrameScheduler();
    const readError = new Error("base read failed");
    let shouldFailRead = false;
    const runtime = new EditorPresentationTransactionRuntime({
      commit: () => ({ committedDocumentRevision: 2 }),
      readDocumentVersion: () => 1,
      readTargetValue: () => {
        if (shouldFailRead) throw readError;
        return 0;
      },
      scheduler,
    });
    const first = begin(runtime);
    first.publish(opacityDescriptor(0.25));
    scheduler.flush();
    const snapshot = runtime.getSnapshot();
    const targetSnapshot = runtime.getTargetSnapshot(projectId, target);
    shouldFailRead = true;

    expect(() => begin(runtime)).toThrow(readError);
    expect(runtime.getSnapshot()).toBe(snapshot);
    expect(runtime.getTargetSnapshot(projectId, target)).toBe(targetSnapshot);
    expect(first.publish(opacityDescriptor(0.5))).toBe(true);
    expect(runtime.getSnapshot().sessions.has(first.sessionId)).toBe(true);
  });

  it("rebases unrelated document versions and cancels same-target conflicts", () => {
    const unrelated = createRuntime();
    const unrelatedHandle = begin(unrelated.runtime);
    unrelatedHandle.publish(opacityDescriptor(0.5));
    unrelated.setDocumentVersion(2);
    expect(unrelatedHandle.finish().status).toBe("committed");
    expect(unrelated.commit).toHaveBeenCalledTimes(1);

    const conflict = createRuntime();
    const conflictHandle = begin(conflict.runtime);
    conflictHandle.publish(opacityDescriptor(0.5));
    conflict.values.set("canonical-node:node-1", 0.25);
    conflict.setDocumentVersion(2);
    expect(conflictHandle.finish()).toEqual({
      reason: "conflict",
      status: "cancelled",
    });
    expect(conflict.commit).not.toHaveBeenCalled();
  });

  it("does not commit when the final descriptor equals the captured base", () => {
    const { commit, runtime } = createRuntime();
    const handle = begin(runtime);

    expect(handle.finish(opacityDescriptor(0))).toEqual({ status: "no-op" });
    expect(commit).not.toHaveBeenCalled();
  });

  it("normalizes spacing shorthand before overlay and terminal commit", () => {
    const { commit, runtime, scheduler } = createRuntime();
    const handle = begin(runtime);
    const spacing = {
      target,
      type: "style.patch" as const,
    };

    handle.publish({ ...spacing, patch: { gap: 12, padding: 8 } });
    scheduler.flush();

    expect(runtime.getTargetSnapshot(projectId, target)[0]?.descriptor).toEqual(
      {
        ...spacing,
        patch: {
          columnGap: 12,
          paddingBottom: 8,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 8,
          rowGap: 12,
        },
      },
    );

    expect(handle.finish({ ...spacing, patch: { gap: "16px" } })).toMatchObject(
      { status: "committed" },
    );
    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        descriptor: {
          ...spacing,
          patch: { columnGap: "16px", rowGap: "16px" },
        },
      }),
    );
  });

  it("converts invalid final descriptor normalization into a failed session", () => {
    const { commit, runtime } = createRuntime();
    const handle = begin(runtime);

    const result = handle.finish({
      patch: { opacity: Symbol("invalid") },
      target,
      type: "style.patch",
    });

    expect(result.status).toBe("failed");
    expect(commit).not.toHaveBeenCalled();
    expect(runtime.getSnapshot().sessions.get(handle.sessionId)?.status).toBe(
      "failed",
    );
    expect(handle.publish(opacityDescriptor(0.5))).toBe(false);
    expect(handle.cancel("escape")).toBe(true);
    expect(runtime.getSnapshot().sessions.has(handle.sessionId)).toBe(false);
  });

  it("retains the overlay after commit failure until explicit cancel", () => {
    const scheduler = createFrameScheduler();
    const error = new Error("commit failed");
    const runtime = new EditorPresentationTransactionRuntime({
      commit: () => {
        throw error;
      },
      readDocumentVersion: () => 1,
      readTargetValue: () => 0,
      scheduler,
    });
    const handle = begin(runtime);
    handle.publish(opacityDescriptor(0.5));
    scheduler.flush();

    const result = handle.finish(opacityDescriptor(0.75));
    expect(result).toEqual({ error, status: "failed" });
    expect(handle.finish()).toBe(result);
    expect(runtime.getTargetSnapshot(projectId, target)[0]?.descriptor).toEqual(
      opacityDescriptor(0.75),
    );
    expect(runtime.getSnapshot().sessions.get(handle.sessionId)?.status).toBe(
      "failed",
    );

    expect(handle.cancel("escape")).toBe(true);
    expect(runtime.getTargetSnapshot(projectId, target)).toHaveLength(0);
  });
});
