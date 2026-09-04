import { describe, expect, it } from "vitest";
import {
  normalizePresentationSpacingPatch,
  normalizePresentationSpacingStyle,
} from "./editorPresentationStyleNormalization";
import { EditorPresentationTransactionRuntime } from "./editorPresentationRuntime";
import {
  resolvePresentationLayoutProps,
  resolvePresentationPaintProps,
} from "../../preview/components/canonicalPresentationProps";

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

  it("keeps layout and paint lanes fail-closed for a mixed descriptor", () => {
    const base = {
      style: {
        display: "flex",
        opacity: 1,
        paddingTop: 4,
        paddingRight: 4,
        paddingBottom: 4,
        paddingLeft: 4,
      },
    };
    const mixed = stylePatch({ opacity: "0.42", padding: 12 });

    expect(resolvePresentationPaintProps(base, [mixed])).toBe(base);
    expect(resolvePresentationLayoutProps(base, [mixed])).toBe(base);
  });

  it("normalizes spacing before Preview layout composition", () => {
    const base = {
      style: {
        display: "flex",
        gap: "4px",
        padding: "8px",
        paddingLeft: 10,
      },
    };
    const resolved = resolvePresentationLayoutProps(base, [
      stylePatch({ gap: 16, padding: 12 }),
    ]);

    expect(resolved).toEqual({
      style: {
        columnGap: 16,
        display: "flex",
        paddingBottom: 12,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 12,
        rowGap: 16,
      },
    });
    expect(resolved.style).not.toHaveProperty("gap");
    expect(resolved.style).not.toHaveProperty("padding");
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
