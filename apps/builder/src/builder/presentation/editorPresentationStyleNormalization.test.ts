import { describe, expect, it } from "vitest";
import {
  normalizePresentationSpacingPatch,
  normalizePresentationSpacingStyle,
} from "./editorPresentationStyleNormalization";
import { EditorPresentationTransactionRuntime } from "./editorPresentationRuntime";

const target = { kind: "canonical-node" as const, nodeId: "spacing-node" };

function stylePatch(patch: Readonly<Record<string, unknown>>) {
  return { patch, target, type: "style.patch" as const };
}

describe("presentation spacing normalization", () => {
  it("expands shorthand and keeps explicit longhands as the winner", () => {
    expect(
      normalizePresentationSpacingStyle({
        gap: "8px 16px",
        padding: "4px 8px",
        paddingTop: "6px",
      }),
    ).toEqual({
      columnGap: "16px",
      paddingBottom: "4px",
      paddingLeft: "8px",
      paddingRight: "8px",
      paddingTop: "6px",
      rowGap: "8px",
    });
  });

  it("normalizes a mixed opacity/spacing descriptor without losing opacity", () => {
    expect(
      normalizePresentationSpacingPatch({
        opacity: "0.42",
        padding: 12,
      }),
    ).toEqual({
      opacity: "0.42",
      paddingBottom: 12,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 12,
    });
  });



  it("normalizes the runtime descriptor before either consumer sees it", () => {
    const pending: Array<() => void> = [];
    const runtime = new EditorPresentationTransactionRuntime({
      commit: () => ({ committedDocumentRevision: 2 }),
      readDocumentVersion: () => 1,
      readTargetValue: () => ({ opacity: 1 }),
      scheduler: {
        cancel: () => {
          pending.length = 0;
        },
        request: (callback) => {
          pending.push(() => callback(0));
          return 1;
        },
      },
    });
    const handle = runtime.beginEditorPresentation({
      commitIntent: "spacing-normalization",
      ownerId: "spacing-normalization-test",
      projectId: "project-1",
      targets: [target],
    });
    handle.publish(stylePatch({ opacity: "0.42", padding: 12 }));
    pending.splice(0).forEach((callback) => callback());

    expect(
      runtime.getTargetSnapshot("project-1", target)[0]?.descriptor,
    ).toEqual(
      stylePatch({
        opacity: "0.42",
        paddingBottom: 12,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 12,
      }),
    );
  });
});
