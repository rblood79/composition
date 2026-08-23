import { describe, expect, it } from "vitest";
import {
  assertContinuousEditorMutation,
  classifyEditorMutation,
  mergeEditorInvalidationKinds,
} from "./editorMutationClassifier";
import type {
  EditorMutationDescriptor,
  EditorPresentationTargetRef,
} from "./editorPresentationTypes";
import { toEditorPresentationTargetKey } from "./editorPresentationTypes";

const target: EditorPresentationTargetRef = {
  kind: "canonical-node",
  nodeId: "node-1",
};

function stylePatch(
  patch: Readonly<Record<string, unknown>>,
): EditorMutationDescriptor {
  return { patch, target, type: "style.patch" };
}

describe("classifyEditorMutation", () => {
  it("classifies the complete paint-layout-structure lattice", () => {
    expect(
      classifyEditorMutation({ fills: [], target, type: "fills.replace" })
        .invalidation,
    ).toBe("paint");
    expect(
      classifyEditorMutation(stylePatch({ opacity: 0.4 })).invalidation,
    ).toBe("paint");
    expect(
      classifyEditorMutation(stylePatch({ opacity: 0.4, padding: 12 }))
        .invalidation,
    ).toBe("layout");
    expect(
      classifyEditorMutation({
        operation: { type: "reparent" },
        target,
        type: "structure.patch",
      }).invalidation,
    ).toBe("structure");
    expect(mergeEditorInvalidationKinds(["paint", "structure", "layout"])).toBe(
      "structure",
    );
  });

  it("derives layout roots from semantic targets without renderer ids", () => {
    const canonical = classifyEditorMutation(stylePatch({ width: 120 }));
    const descendant = classifyEditorMutation({
      patch: { height: 40 },
      target: {
        kind: "ref-descendant",
        pathKey: "label/stable-key",
        refId: "ref-1",
      },
      type: "geometry.patch",
    });

    expect(canonical.affectedLayoutRoots).toEqual(["node-1"]);
    expect(descendant.affectedLayoutRoots).toEqual(["ref-1"]);
  });

  it("fails closed for unknown or non-continuous descriptors", () => {
    expect(() =>
      classifyEditorMutation(stylePatch({ mysteryPaint: "red" })),
    ).toThrow(/Unknown editor mutation effect/);
    expect(() =>
      assertContinuousEditorMutation(stylePatch({ transition: "all" })),
    ).toThrow(/not registered for continuous presentation/);
    expect(() =>
      assertContinuousEditorMutation({
        operation: { type: "remove" },
        target,
        type: "structure.patch",
      }),
    ).toThrow(/not registered for continuous presentation/);
  });

  it("opens fixed Text font metrics and keeps other metrics commit-only", () => {
    expect(() =>
      assertContinuousEditorMutation(stylePatch({ fontSize: "18px" })),
    ).not.toThrow();
    expect(() =>
      assertContinuousEditorMutation(stylePatch({ fontWeight: "700" })),
    ).not.toThrow();
    for (const key of ["fontFamily", "lineHeight", "letterSpacing"]) {
      const descriptor = stylePatch({ [key]: "18px" });
      expect(classifyEditorMutation(descriptor).invalidation).toBe("layout");
      expect(() => assertContinuousEditorMutation(descriptor)).toThrow(
        /not registered for continuous presentation/,
      );
    }
  });

  it("serializes canonical and ref-descendant targets without collisions", () => {
    expect(
      toEditorPresentationTargetKey({
        kind: "canonical-node",
        nodeId: "ref-descendant:ref-1:path/key",
      }),
    ).not.toBe(
      toEditorPresentationTargetKey({
        kind: "ref-descendant",
        pathKey: "path/key",
        refId: "ref-1",
      }),
    );
  });
});
