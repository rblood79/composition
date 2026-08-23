import { describe, expect, it, vi } from "vitest";
import {
  EditorPresentationTransactionRuntime,
  type EditorPresentationFrameScheduler,
  type EditorPresentationSessionEvent,
} from "./editorPresentationRuntime";
import {
  assertContinuousEditorMutation,
  classifyEditorMutation,
} from "./editorMutationClassifier";
import { getEditorMutationEffectRule } from "./invalidation/editorMutationEffectRegistry";
import type {
  EditorMutationDescriptor,
  EditorPresentationTargetRef,
} from "./editorPresentationTypes";

interface FakeFrameScheduler extends EditorPresentationFrameScheduler {
  flush(): void;
  pendingCount(): number;
}

function createFrameScheduler(): FakeFrameScheduler {
  let nextId = 0;
  const callbacks = new Map<number, (timestamp: number) => void>();
  return {
    cancel(handle) {
      callbacks.delete(handle);
    },
    flush() {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback(0));
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
  nodeId: "text-1",
};
const projectId = "project-1";

function stylePatch(
  patch: Readonly<Record<string, unknown>>,
): EditorMutationDescriptor {
  return { patch, target, type: "style.patch" };
}

function createRuntime(): {
  commit: ReturnType<typeof vi.fn>;
  runtime: EditorPresentationTransactionRuntime;
  scheduler: FakeFrameScheduler;
} {
  const scheduler = createFrameScheduler();
  const commit = vi.fn(() => ({ committedDocumentRevision: 2 }));
  const runtime = new EditorPresentationTransactionRuntime({
    commit,
    readDocumentVersion: () => 1,
    readTargetValue: () => 0,
    scheduler,
  });
  return { commit, runtime, scheduler };
}

function begin(runtime: EditorPresentationTransactionRuntime) {
  return runtime.beginEditorPresentation({
    commitIntent: "text-metric-residual",
    ownerId: "text-control-1",
    projectId,
    targets: [target],
  });
}

function expectRejectedWithoutOverlay(
  descriptor: EditorMutationDescriptor,
): void {
  const { runtime, scheduler } = createRuntime();
  const handle = begin(runtime);
  const events: EditorPresentationSessionEvent[] = [];
  runtime.subscribeSessionEvents((event) => events.push(event));

  expect(() => handle.publish(descriptor)).toThrow(
    /not registered for continuous presentation|Unknown editor mutation effect/,
  );
  expect(scheduler.pendingCount()).toBe(0);
  expect(runtime.getTargetSnapshot(projectId, target)).toHaveLength(0);
  expect(runtime.getSnapshot().sessions.get(handle.sessionId)?.status).toBe(
    "active",
  );

  expect(handle.cancel("escape")).toBe(true);
  expect(runtime.getTargetSnapshot(projectId, target)).toHaveLength(0);
  expect(events.filter((event) => event.type === "terminal")).toHaveLength(1);
}

describe("ADR-187 Phase 5 residual fail-closed boundary", () => {
  it("keeps unsupported text metrics commit-only at the runtime publish gate", () => {
    for (const key of ["fontFamily", "lineHeight", "letterSpacing"]) {
      const descriptor = stylePatch({ [key]: "18px" });
      expect(
        () => classifyEditorMutation(descriptor).invalidation,
      ).not.toThrow();
      expect(() => assertContinuousEditorMutation(descriptor)).toThrow(
        /not registered for continuous presentation/,
      );
      expectRejectedWithoutOverlay(descriptor);
    }
  });

  it("rejects resource-shaped style payloads because prop resources have no presentation descriptor", () => {
    expect(getEditorMutationEffectRule("prop", "src")).toMatchObject({
      cacheSignature: "prop",
      continuous: false,
      invalidation: "layout",
    });

    const resourceLikeStyle = stylePatch({ src: "image://intrinsic-resource" });
    expect(() => classifyEditorMutation(resourceLikeStyle)).toThrow(
      /Unknown editor mutation effect: style:src/,
    );
    expectRejectedWithoutOverlay(resourceLikeStyle);
  });

  it("keeps structure terminal-only and emits no presentation overlay", () => {
    const { commit, runtime, scheduler } = createRuntime();
    const handle = begin(runtime);
    const events: EditorPresentationSessionEvent[] = [];
    runtime.subscribeSessionEvents((event) => events.push(event));
    const descriptor: EditorMutationDescriptor = {
      operation: {
        payload: { parentId: "frame-1" },
        type: "reparent",
      },
      target,
      type: "structure.patch",
    };

    expect(() => handle.publish(descriptor)).toThrow(
      /not registered for continuous presentation/,
    );
    expect(scheduler.pendingCount()).toBe(0);
    expect(runtime.getTargetSnapshot(projectId, target)).toHaveLength(0);
    expect(commit).not.toHaveBeenCalled();

    expect(handle.finish(descriptor).status).toBe("failed");
    expect(commit).not.toHaveBeenCalled();
    expect(runtime.getTargetSnapshot(projectId, target)).toHaveLength(0);
    expect(runtime.getSnapshot().sessions.get(handle.sessionId)?.status).toBe(
      "failed",
    );
    expect(events.filter((event) => event.type === "terminal")).toHaveLength(0);

    expect(handle.cancel("escape")).toBe(true);
    expect(runtime.getSnapshot().sessions.has(handle.sessionId)).toBe(false);
    expect(runtime.getTargetSnapshot(projectId, target)).toHaveLength(0);
    expect(events.filter((event) => event.type === "terminal")).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({
      finalDescriptor: null,
      result: { reason: "escape", status: "cancelled" },
      type: "terminal",
    });
  });

  it("does not mistake the legacy prop registry axis for a continuous descriptor", () => {
    const resourceRule = getEditorMutationEffectRule("prop", "src");
    expect(resourceRule?.continuous).toBe(false);
    expect(() =>
      assertContinuousEditorMutation(
        stylePatch({ src: "image://intrinsic-resource" }),
      ),
    ).toThrow(/Unknown editor mutation effect: style:src/);
  });
});
