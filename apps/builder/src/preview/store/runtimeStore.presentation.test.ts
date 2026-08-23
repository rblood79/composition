import { beforeEach, describe, expect, it } from "vitest";
import type { CompositionDocument, ResolvedNode } from "@composition/shared";
import { FillType, type FillItem } from "../../types/builder/fill.types";

import type {
  EditorPresentationCancelMessage,
  EditorPresentationFinishMessage,
  EditorPresentationPatchMessage,
  UpdateCanonicalDocumentMessage,
} from "../../builder/presentation/editorPresentationProtocol";
import { buildPreviewPresentationProjectionIndex } from "../presentation/editorPresentationProjectionIndex";
import { createRuntimeStore } from "./runtimeStore";

const PROJECT_ID = "project-1";
const TARGET = { kind: "canonical-node", nodeId: "node-1" } as const;

function fill(color: string): FillItem {
  return {
    id: "fill-1",
    type: FillType.Color,
    enabled: true,
    color,
    opacity: 1,
    blendMode: "normal" as const,
  };
}

function descriptor(color: string) {
  return {
    type: "fills.replace" as const,
    target: TARGET,
    fills: [fill(color)],
  };
}

function document(color: string): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "node-1",
        type: "frame",
        fills: [fill(color)],
      },
    ],
  } as CompositionDocument;
}

function canonical(
  revision: number,
  color: string,
): UpdateCanonicalDocumentMessage {
  return {
    type: "UPDATE_CANONICAL_DOCUMENT",
    projectId: PROJECT_ID,
    documentRevision: revision,
    document: document(color),
  };
}

function patch(revision: number, base = 1): EditorPresentationPatchMessage {
  return {
    type: "EDITOR_PRESENTATION_PATCH",
    projectId: PROJECT_ID,
    sessionId: "session-1",
    revision,
    baseDocumentRevision: base,
    mutations: [descriptor("#222222FF")],
  };
}

function finish(
  committedDocumentRevision = 2,
): EditorPresentationFinishMessage {
  return {
    type: "EDITOR_PRESENTATION_FINISH",
    projectId: PROJECT_ID,
    sessionId: "session-1",
    revision: 1,
    committedDocumentRevision,
    finalMutations: [descriptor("#222222FF")],
  };
}

function cancel(revision = 1): EditorPresentationCancelMessage {
  return {
    type: "EDITOR_PRESENTATION_CANCEL",
    projectId: PROJECT_ID,
    sessionId: "session-1",
    revision,
  };
}

function projection(revision: number) {
  return buildPreviewPresentationProjectionIndex(
    [{ id: "node-1", type: "frame" } as ResolvedNode],
    revision,
  );
}

describe("ADR-187 Preview runtime presentation ordering", () => {
  let store: ReturnType<typeof createRuntimeStore>;

  beforeEach(() => {
    store = createRuntimeStore();
    store.getState().receiveCanonicalDocument(canonical(1, "#111111FF"));
    store.getState().setEditorPresentationProjectionIndex(projection(1));
  });

  it("inherited color patch는 Preview에서 own-color 없는 descendant까지 patch/cancel한다", () => {
    const inheritedStore = createRuntimeStore();
    inheritedStore
      .getState()
      .receiveCanonicalDocument(canonical(1, "#111111FF"));
    inheritedStore.getState().setEditorPresentationProjectionIndex(
      buildPreviewPresentationProjectionIndex(
        [
          {
            id: "button-1",
            type: "Button",
            props: { style: { color: "#111111" } },
            children: [{ id: "label-1", type: "Text" }],
          },
        ] as unknown as ResolvedNode[],
        1,
      ),
    );

    inheritedStore.getState().applyEditorPresentationPatch({
      type: "EDITOR_PRESENTATION_PATCH",
      projectId: PROJECT_ID,
      sessionId: "color-session",
      revision: 1,
      baseDocumentRevision: 1,
      mutations: [
        {
          patch: { color: "#222222" },
          propagation: "inherited-subtree",
          target: { kind: "canonical-node", nodeId: "button-1" },
          type: "style.patch",
        },
      ],
    });

    expect(
      Object.keys(inheritedStore.getState().editorPresentationOverrides).sort(),
    ).toEqual(["button-1", "button-1/label-1"]);

    inheritedStore.getState().cancelEditorPresentation({
      type: "EDITOR_PRESENTATION_CANCEL",
      projectId: PROJECT_ID,
      sessionId: "color-session",
      revision: 2,
    });
    expect(inheritedStore.getState().editorPresentationOverrides).toEqual({});
  });

  it("finish-before-document keeps final overlay until atomic canonical retirement", () => {
    store.getState().applyEditorPresentationPatch(patch(1));
    store.getState().finishEditorPresentation(finish(2));

    expect(
      store.getState().editorPresentationOverrides["node-1"],
    ).toMatchObject({
      sessionId: "session-1",
      revision: 1,
    });
    expect(
      store.getState().editorPresentationFinishLatches["session-1"],
    ).toEqual({
      sessionId: "session-1",
      terminalRevision: 1,
      committedDocumentRevision: 2,
    });

    store.getState().receiveCanonicalDocument(canonical(2, "#222222FF"));

    const state = store.getState();
    expect(state.canonicalDocumentRevision).toBe(2);
    expect(state.editorPresentationOverrides).toEqual({});
    expect(state.editorPresentationFinishLatches).toEqual({});
    expect(state.editorPresentationTombstones["session-1"]).toBe(1);
  });

  it("document-before-finish retires in the finish set without creating an overlay", () => {
    store.getState().applyEditorPresentationPatch(patch(1));
    store.getState().receiveCanonicalDocument(canonical(2, "#222222FF"));
    store.getState().finishEditorPresentation(finish(2));

    expect(store.getState().editorPresentationOverrides).toEqual({});
    expect(store.getState().editorPresentationFinishLatches).toEqual({});
    expect(store.getState().editorPresentationTombstones["session-1"]).toBe(1);
  });

  it("buffers a future-base patch until the matching canonical projection index arrives", () => {
    store.getState().applyEditorPresentationPatch(patch(2, 2));
    expect(store.getState().editorPresentationOverrides).toEqual({});
    expect(
      store.getState().pendingEditorPresentationPatches["session-1"]?.revision,
    ).toBe(2);

    store.getState().receiveCanonicalDocument(canonical(2, "#111111FF"));
    expect(store.getState().editorPresentationOverrides).toEqual({});
    store.getState().setEditorPresentationProjectionIndex(projection(2));

    expect(
      store.getState().editorPresentationOverrides["node-1"],
    ).toMatchObject({
      sessionId: "session-1",
      revision: 2,
    });
    expect(store.getState().pendingEditorPresentationPatches).toEqual({});
  });

  it("drops stale/duplicate patches and cancel removes the overlay immediately", () => {
    store.getState().applyEditorPresentationPatch(patch(2));
    store.getState().applyEditorPresentationPatch(patch(1));
    expect(
      store.getState().editorPresentationOverrides["node-1"]?.revision,
    ).toBe(2);

    store.getState().cancelEditorPresentation(cancel(2));
    store.getState().applyEditorPresentationPatch(patch(2));

    expect(store.getState().editorPresentationOverrides).toEqual({});
    expect(store.getState().editorPresentationTombstones["session-1"]).toBe(2);
  });

  it("empty patch는 active overlay만 지우고 이후 revision을 허용한다", () => {
    store.getState().applyEditorPresentationPatch(patch(1));
    store.getState().applyEditorPresentationPatch({
      ...patch(2),
      mutations: [],
    });

    expect(store.getState().editorPresentationOverrides).toEqual({});
    expect(store.getState().editorPresentationLastRevisions["session-1"]).toBe(
      2,
    );

    store.getState().applyEditorPresentationPatch(patch(3));
    expect(
      store.getState().editorPresentationOverrides["node-1"]?.revision,
    ).toBe(3);
  });
});
