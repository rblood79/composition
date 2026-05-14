// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import type { CanvasInteractionNode } from "../interactionNode";
import { resolveCanvasInteractionTarget } from "../resolveCanvasInteractionTarget";

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

describe("resolveCanvasInteractionTarget", () => {
  it("maps projected page slot fill hits back to the canonical element id", () => {
    const slot = makeNode("page-1::page-frame::slot-content", {
      type: "Slot",
      projection: {
        kind: "page-frame-element",
        pageId: "page-1",
        sourceElementId: "slot-content",
        renderElementId: "page-1::page-frame::slot-content",
        renderParentId: "page-1-body",
        canonicalParentId: "frame-body",
        slotName: "content",
        descendantPath: "frame-body/slot-content",
      },
    });
    const fill = makeNode("page-card", {
      parent_id: slot.id,
      projection: {
        kind: "page-slot-fill",
        pageId: "page-1",
        sourceElementId: "page-card",
        renderElementId: "page-card",
        renderParentId: slot.id,
        canonicalParentId: "page-body",
        slotName: "content",
        descendantPath: "frame-body/slot-content",
      },
    });

    expect(
      resolveCanvasInteractionTarget({
        candidateIds: [slot.id, fill.id],
        elementsMap: new Map([
          [slot.id, slot],
          [fill.id, fill],
        ]),
        childrenMap: new Map([[slot.id, [fill]]]),
      }),
    ).toEqual({
      kind: "select",
      elementId: "page-card",
      pageId: "page-1",
    });
  });

  it("returns a slot guard target for projected Slot chrome", () => {
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
      resolveCanvasInteractionTarget({
        candidateIds: [slot.id],
        elementsMap: new Map([[slot.id, slot]]),
        childrenMap: new Map(),
      }),
    ).toEqual({
      kind: "slot-guard",
      renderSlotId: slot.id,
      pageId: "page-1",
      slotName: "header",
      descendantPath: "frame-body/slot-header",
    });
  });

  it("does not return synthetic render IDs as selectable element IDs", () => {
    const projected = makeNode("page-1::page-frame::plain", {
      projection: {
        kind: "page-frame-element",
        pageId: "page-1",
        sourceElementId: "plain",
        renderElementId: "page-1::page-frame::plain",
        renderParentId: "page-1-body",
        canonicalParentId: "frame-body",
      },
    });

    expect(
      resolveCanvasInteractionTarget({
        candidateIds: [projected.id],
        elementsMap: new Map([[projected.id, projected]]),
        childrenMap: new Map(),
      }),
    ).toEqual({ kind: "none" });
  });
});
