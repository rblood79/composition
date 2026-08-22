import { describe, expect, it } from "vitest";

import type { EditorPresentationProtocolMessage } from "./editorPresentationProtocol";
import {
  EditorPresentationTransactionRuntime,
  type EditorPresentationFrameScheduler,
} from "./editorPresentationRuntime";
import { EditorPresentationPreviewBridge } from "./editorPresentationPreviewBridge";

function createScheduler(): EditorPresentationFrameScheduler & {
  flush(): void;
} {
  let callback: ((timestamp: number) => void) | null = null;
  return {
    cancel: () => {
      callback = null;
    },
    flush: () => {
      const next = callback;
      callback = null;
      next?.(0);
    },
    request: (next) => {
      callback = next;
      return 1;
    },
  };
}

describe("EditorPresentationPreviewBridge", () => {
  it("frame당 semantic delta를 보내고 finish 전 canonical envelope를 보장한다", () => {
    let documentRevision = 1;
    const scheduler = createScheduler();
    const runtime = new EditorPresentationTransactionRuntime({
      commit: () => ({ committedDocumentRevision: ++documentRevision }),
      readDocumentVersion: () => documentRevision,
      readTargetValue: () => [],
      scheduler,
    });
    const bridge = new EditorPresentationPreviewBridge({
      readDocumentRevision: () => documentRevision,
      runtime,
    });
    const order: string[] = [];
    const messages: EditorPresentationProtocolMessage[] = [];
    bridge.attachTransport({
      ensureCanonicalDocumentSent: (_projectId, revision) => {
        order.push(`canonical:${revision}`);
      },
      send: (message) => {
        order.push(message.type);
        messages.push(message);
      },
    });
    const handle = runtime.beginEditorPresentation({
      commitIntent: "style-fill",
      ownerId: "picker-1",
      projectId: "project-1",
      targets: [{ kind: "canonical-node", nodeId: "node-1" }],
    });
    const descriptor = {
      type: "fills.replace" as const,
      target: { kind: "canonical-node" as const, nodeId: "node-1" },
      fills: [],
    };

    handle.publish(descriptor);
    scheduler.flush();
    handle.finish(descriptor);

    expect(messages[0]).toMatchObject({
      type: "EDITOR_PRESENTATION_PATCH",
      revision: 1,
      mutations: [descriptor],
    });
    expect(order.slice(-2)).toEqual([
      "canonical:2",
      "EDITOR_PRESENTATION_FINISH",
    ]);
    expect(messages.at(-1)).toMatchObject({
      type: "EDITOR_PRESENTATION_FINISH",
      committedDocumentRevision: 2,
      finalMutations: [descriptor],
    });
    bridge.dispose();
  });

  it("base 복귀는 empty patch, iframe reload는 cancel tombstone으로 전송한다", () => {
    const scheduler = createScheduler();
    const runtime = new EditorPresentationTransactionRuntime({
      isDescriptorEqualToBase: (descriptor) =>
        descriptor.type === "fills.replace" && descriptor.fills.length === 0,
      commit: () => ({ committedDocumentRevision: 2 }),
      readDocumentVersion: () => 1,
      readTargetValue: () => [],
      scheduler,
    });
    const messages: EditorPresentationProtocolMessage[] = [];
    const bridge = new EditorPresentationPreviewBridge({
      readDocumentRevision: () => 1,
      runtime,
    });
    bridge.attachTransport({
      ensureCanonicalDocumentSent: () => {},
      send: (message) => messages.push(message),
    });
    const handle = runtime.beginEditorPresentation({
      commitIntent: "style-fill",
      ownerId: "picker-1",
      projectId: "project-1",
      targets: [{ kind: "canonical-node", nodeId: "node-1" }],
    });
    handle.publish({
      type: "fills.replace",
      target: { kind: "canonical-node", nodeId: "node-1" },
      fills: [{ id: "fill-1" } as never],
    });
    scheduler.flush();
    handle.publish({
      type: "fills.replace",
      target: { kind: "canonical-node", nodeId: "node-1" },
      fills: [],
    });
    scheduler.flush();
    runtime.cancelProjectSessions("project-1", "iframe-reload");

    expect(messages.at(-2)).toMatchObject({
      type: "EDITOR_PRESENTATION_PATCH",
      mutations: [],
    });
    expect(messages.at(-1)).toMatchObject({
      type: "EDITOR_PRESENTATION_CANCEL",
      revision: 2,
    });
    bridge.dispose();
  });
});
