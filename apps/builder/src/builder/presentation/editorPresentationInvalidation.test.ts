import { describe, expect, it } from "vitest";
import {
  EMPTY_EDITOR_PRESENTATION_INVALIDATION,
  updateEditorPresentationInvalidation,
} from "./editorPresentationInvalidation";
import type {
  ClassifiedEditorMutation,
  EditorPresentationSession,
} from "./editorPresentationTypes";

const sessionBase = {
  baseDocumentVersion: 1,
  baseValues: new Map(),
  commitIntent: "test",
  ownerId: "test",
  pending: null,
  projectId: "project-1",
  revision: 1,
  sessionId: "session-1",
  status: "active" as const,
  targets: [{ kind: "canonical-node", nodeId: "node-1" } as const],
};

function mutation(
  invalidation: ClassifiedEditorMutation["invalidation"],
): ClassifiedEditorMutation {
  return {
    affectedLayoutRoots: invalidation === "paint" ? [] : ["node-1"],
    affectedTargets: [{ kind: "canonical-node", nodeId: "node-1" }],
    descriptor: {
      patch: invalidation === "layout" ? { width: 120 } : { opacity: 0.5 },
      target: { kind: "canonical-node", nodeId: "node-1" },
      type: "style.patch",
    },
    invalidation,
  };
}

describe("editor presentation invalidation lanes", () => {
  it("increments only the lanes required by the changed mutation", () => {
    const layout = mutation("layout");
    const session: EditorPresentationSession = {
      ...sessionBase,
      applied: layout,
    };
    const next = updateEditorPresentationInvalidation(
      EMPTY_EDITOR_PRESENTATION_INVALIDATION,
      [session],
      [layout],
    );

    expect(next.paintTargets).toEqual(new Set(["canonical-node:node-1"]));
    expect(next.layoutRoots).toEqual(new Set(["node-1"]));
    expect(next.structureRoots).toEqual(new Set());
    expect(next.paintRevision).toBe(1);
    expect(next.layoutRevision).toBe(1);
    expect(next.structureRevision).toBe(0);
  });

  it("removes inactive targets without resetting monotonic revisions", () => {
    const paint = mutation("paint");
    const active: EditorPresentationSession = {
      ...sessionBase,
      applied: paint,
    };
    const first = updateEditorPresentationInvalidation(
      EMPTY_EDITOR_PRESENTATION_INVALIDATION,
      [active],
      [paint],
    );
    const empty = updateEditorPresentationInvalidation(first, [], [paint]);

    expect(empty.paintTargets).toEqual(new Set());
    expect(empty.paintRevision).toBe(2);
    expect(empty.layoutRevision).toBe(0);
  });
});
