// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { CanvasInteractionNode } from "../interactionNode";
import { resolveCanonicalMoveTarget } from "../resolveCanonicalMutationTarget";

function makeNode(
  id: string,
  overrides: Partial<CanvasInteractionNode> = {},
): CanvasInteractionNode {
  return {
    id,
    type: "Box",
    props: {},
    parent_id: null,
    page_id: "page-1",
    deleted: false,
    ...overrides,
  };
}

describe("resolveCanonicalMoveTarget", () => {
  it("converts projected Slot render targets to ref descendant targets", () => {
    const slot = makeNode("page-1::page-frame::slot-header", {
      type: "Slot",
      projection: {
        kind: "page-frame-element",
        pageId: "page-1",
        sourceElementId: "slot-header",
        renderElementId: "page-1::page-frame::slot-header",
        renderParentId: "page-1-body",
        canonicalParentId: "frame-body",
        slotName: "header",
        descendantPath: "frame-body/slot-header",
      },
    });

    expect(
      resolveCanonicalMoveTarget({
        renderTargetId: slot.id,
        insertionIndex: 2,
        elementsMap: new Map([[slot.id, slot]]),
      }),
    ).toEqual({
      kind: "ref-descendants",
      refNodeId: "page-1",
      descendantPath: "frame-body/slot-header",
      insertionIndex: 2,
    });
  });

  it("rejects synthetic targets without projection metadata", () => {
    const target = makeNode("page-1::page-frame::unknown");

    expect(
      resolveCanonicalMoveTarget({
        renderTargetId: target.id,
        insertionIndex: 0,
        elementsMap: new Map([[target.id, target]]),
      }),
    ).toBeNull();
  });

  it("keeps ordinary render targets as canonical node children targets", () => {
    const target = makeNode("card");

    expect(
      resolveCanonicalMoveTarget({
        renderTargetId: target.id,
        insertionIndex: 1,
        elementsMap: new Map([[target.id, target]]),
      }),
    ).toEqual({
      kind: "node-children",
      parentId: "card",
      insertionIndex: 1,
    });
  });
});
