// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { CompositionDocument, ResolvedNode } from "@composition/shared";

import { buildPreviewPresentationProjectionIndex } from "../presentation/editorPresentationProjectionIndex";
import { createRuntimeStore } from "../store/runtimeStore";
import { MessageHandler } from "./messageHandler";

function event(data: unknown): MessageEvent {
  return { data, origin: window.location.origin } as MessageEvent;
}

describe("ADR-187 Preview message handler", () => {
  it("routes validated canonical and presentation messages to the isolated store", () => {
    const store = createRuntimeStore();
    const handler = new MessageHandler(store.getState());
    const document = {
      version: "composition-1.0",
      children: [{ id: "node-1", type: "frame" }],
    } as CompositionDocument;
    handler.handle(
      event({
        type: "UPDATE_CANONICAL_DOCUMENT",
        projectId: "project-1",
        documentRevision: 1,
        document,
      }),
    );
    store
      .getState()
      .setEditorPresentationProjectionIndex(
        buildPreviewPresentationProjectionIndex(
          [{ id: "node-1", type: "frame" } as ResolvedNode],
          1,
        ),
      );
    handler.handle(
      event({
        type: "EDITOR_PRESENTATION_PATCH",
        projectId: "project-1",
        sessionId: "session-1",
        revision: 1,
        baseDocumentRevision: 1,
        mutations: [
          {
            type: "fills.replace",
            target: { kind: "canonical-node", nodeId: "node-1" },
            fills: [],
          },
        ],
      }),
    );

    expect(store.getState().canonicalDocument).toBe(document);
    expect(
      store.getState().editorPresentationOverrides["node-1"]?.sessionId,
    ).toBe("session-1");
  });

  it("rejects raw renderer identity before it reaches the store", () => {
    const store = createRuntimeStore();
    const handler = new MessageHandler(store.getState());
    handler.handle(
      event({
        type: "EDITOR_PRESENTATION_PATCH",
        projectId: "project-1",
        sessionId: "session-1",
        revision: 1,
        baseDocumentRevision: 0,
        mutations: [
          {
            type: "fills.replace",
            target: { kind: "canonical-node", nodeId: "instance/child" },
            fills: [],
          },
        ],
      }),
    );

    expect(store.getState().pendingEditorPresentationPatches).toEqual({});
  });
});
