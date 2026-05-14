import { beforeEach, describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";

import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import {
  moveElementToCanonicalTarget,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "../canonicalMutations";

function makeDocument(
  children: Array<Record<string, unknown>>,
): CompositionDocument {
  return {
    version: "composition-1.0",
    children: children as unknown as CompositionDocument["children"],
  };
}

describe("canonical projected ID guard", () => {
  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
  });

  it("rejects projected render ids at the canonical mutation boundary", () => {
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    expect(() =>
      moveElementToCanonicalTarget("card", {
        kind: "node-children",
        parentId: "page-1::page-frame::slot-content",
        insertionIndex: 0,
      }),
    ).toThrow(/Projected render id/);
  });

  it("moves page-owned children into ref descendants without storing projected ids", () => {
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "ref",
          ref: "layout-frame-1",
          metadata: { type: "legacy-page", pageId: "page-1" },
          descendants: {
            "frame-body/slot-header": { children: [] },
          },
          children: [
            {
              id: "card",
              type: "Card",
              props: {},
            },
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    const result = moveElementToCanonicalTarget("card", {
      kind: "ref-descendants",
      refNodeId: "page-1",
      descendantPath: "frame-body/slot-header",
      insertionIndex: 0,
    });

    expect(result.changed).toBe(true);
    const serialized = JSON.stringify(result.document);
    expect(serialized).not.toContain("::page-frame::");
    expect(
      (
        result.document?.children[0] as {
          descendants?: Record<string, { children?: Array<{ id: string }> }>;
        }
      ).descendants?.["frame-body/slot-header"]?.children?.map(
        (child) => child.id,
      ),
    ).toEqual(["card"]);
  });
});
