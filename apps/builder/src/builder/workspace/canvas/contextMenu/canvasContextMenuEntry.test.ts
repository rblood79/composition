import { describe, expect, it } from "vitest";
import type { CanvasInteractionNode } from "../interaction/interactionNode";
import { resolveCanvasContextMenuEntry } from "./canvasContextMenuEntry";

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

function resolveEntry(
  hitCandidates: string[],
  current = { selectedElementIds: ["card", "other"], editingContextId: null },
  selectionBounds = { x: 0, y: 0, width: 100, height: 100 },
) {
  return resolveCanvasContextMenuEntry({
    current,
    getInteractiveChildrenMap: () => null,
    getInteractiveElementsMap: () => elementsMap,
    hitCandidates,
    occludingPageRank: null,
    pagePaintRank: new Map(),
    scenePoint: { x: 20, y: 20 },
    selectionBounds,
  });
}

describe("resolveCanvasContextMenuEntry", () => {
  it("uses the interactive map and preserves normalized multi-selection", () => {
    const result = resolveEntry(["card-label"]);

    expect(result.hitElement?.id).toBe("card-label");
    expect(result.resolvedElement?.id).toBe("card");
    expect(result.selection).toMatchObject({
      surface: "canvas-element",
      nextSelection: ["card", "other"],
      targetElementIds: ["card", "other"],
      resolvedElementId: "card",
    });
  });

  it("replaces the selection when the normalized hit is outside it", () => {
    const result = resolveEntry(["other"], {
      selectedElementIds: ["card"],
      editingContextId: null,
    });

    expect(result.selection.nextSelection).toEqual(["other"]);
  });

  it("opens the empty-canvas surface and keeps or clears selection by bounds", () => {
    expect(resolveEntry([]).selection).toMatchObject({
      surface: "canvas-empty",
      nextSelection: ["card", "other"],
    });

    const outside = resolveCanvasContextMenuEntry({
      current: { selectedElementIds: ["card"], editingContextId: null },
      getInteractiveChildrenMap: () => null,
      getInteractiveElementsMap: () => elementsMap,
      hitCandidates: [],
      occludingPageRank: null,
      pagePaintRank: new Map(),
      scenePoint: { x: 200, y: 200 },
      selectionBounds: { x: 0, y: 0, width: 100, height: 100 },
    });

    expect(outside.selection.nextSelection).toEqual([]);
  });
});
