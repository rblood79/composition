import { describe, expect, it } from "vitest";
import { resolveContextMenuSelection } from "./resolveContextMenuSelection";
import type { CanvasInteractionNode } from "../../../workspace/canvas/interaction/interactionNode";

function node(
  id: string,
  parent_id: string | null,
  type = "Card",
): CanvasInteractionNode {
  return { id, parent_id, props: {}, type };
}

const elementsMap = new Map<string, CanvasInteractionNode>([
  ["body", node("body", null, "body")],
  ["card", node("card", "body")],
  ["card-label", node("card-label", "card", "Text")],
  ["other", node("other", "body")],
]);

const baseInput = {
  scenePoint: { x: 20, y: 20 },
  current: { selectedElementIds: ["card", "other"], editingContextId: null },
  elementsMap,
  selectionBounds: { x: 0, y: 0, width: 100, height: 100 },
};

describe("resolveContextMenuSelection", () => {
  it("normalizes through resolveClickTarget and preserves multi-selection", () => {
    expect(
      resolveContextMenuSelection({
        ...baseInput,
        hitElementId: "card-label",
      }),
    ).toMatchObject({
      surface: "canvas-element",
      nextSelection: ["card", "other"],
      targetElementIds: ["card", "other"],
      resolvedElementId: "card",
    });
  });

  it("replaces selection when the normalized hit is outside the selection", () => {
    expect(
      resolveContextMenuSelection({
        ...baseInput,
        hitElementId: "other",
        current: {
          selectedElementIds: ["card"],
          editingContextId: null,
        },
      }),
    ).toMatchObject({
      surface: "canvas-element",
      nextSelection: ["other"],
      targetElementIds: ["other"],
      resolvedElementId: "other",
    });
  });

  it("keeps the current selection for an empty point inside its bounds", () => {
    expect(
      resolveContextMenuSelection({
        ...baseInput,
        hitElementId: null,
      }),
    ).toMatchObject({
      surface: "canvas-empty",
      nextSelection: ["card", "other"],
      targetElementIds: ["card", "other"],
    });
  });

  it("clears the selection for an empty point outside its bounds", () => {
    expect(
      resolveContextMenuSelection({
        ...baseInput,
        hitElementId: null,
        scenePoint: { x: 200, y: 200 },
      }),
    ).toMatchObject({
      surface: "canvas-empty",
      nextSelection: [],
      targetElementIds: [],
    });
  });

  it("treats an unresolvable hit like empty canvas", () => {
    expect(
      resolveContextMenuSelection({
        ...baseInput,
        hitElementId: "missing",
        scenePoint: { x: 200, y: 200 },
      }),
    ).toMatchObject({
      surface: "canvas-empty",
      nextSelection: [],
      resolvedElementId: null,
    });
  });
});
