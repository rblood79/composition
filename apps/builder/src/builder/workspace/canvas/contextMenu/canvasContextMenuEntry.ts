import { resolveContextMenuSelection } from "../../../components/overlay/contextMenu";
import type { ContextMenuSelectionState } from "../../../components/overlay/contextMenu/resolveContextMenuSelection";
import type { CanvasInteractionNode } from "../interaction/interactionNode";
import { resolveTopmostHitElementId } from "../interaction/selectionModel";
import type { BoundingBox } from "../selection/types";

export interface CanvasContextMenuEntryInput {
  scenePoint: { x: number; y: number };
  hitCandidates: string[];
  getInteractiveElementsMap: () => ReadonlyMap<string, CanvasInteractionNode>;
  getInteractiveChildrenMap: () => ReadonlyMap<
    string,
    readonly CanvasInteractionNode[]
  > | null;
  pagePaintRank: ReadonlyMap<string, number>;
  occludingPageRank: number | null;
  current: ContextMenuSelectionState;
  selectionBounds: BoundingBox | null;
}

export interface CanvasContextMenuEntryResult {
  hitElement: CanvasInteractionNode | undefined;
  resolvedElement: CanvasInteractionNode | undefined;
  selection: ReturnType<typeof resolveContextMenuSelection>;
}

/**
 * Resolve the same topmost interactive target used by the canvas pointer path,
 * then apply the shared right-click selection policy.
 */
export function resolveCanvasContextMenuEntry({
  scenePoint,
  hitCandidates,
  getInteractiveElementsMap,
  getInteractiveChildrenMap,
  pagePaintRank,
  occludingPageRank,
  current,
  selectionBounds,
}: CanvasContextMenuEntryInput): CanvasContextMenuEntryResult {
  const hitElementsMap = getInteractiveElementsMap();
  const hitChildrenMap = getInteractiveChildrenMap();
  const elementId = resolveTopmostHitElementId(
    hitCandidates,
    hitElementsMap,
    hitChildrenMap,
    pagePaintRank,
    occludingPageRank,
  );
  const hitElement = elementId ? hitElementsMap.get(elementId) : undefined;
  const selection = resolveContextMenuSelection({
    current,
    elementsMap: hitElementsMap,
    hitElementId: elementId,
    scenePoint,
    selectionBounds,
  });
  const resolvedElement = selection.resolvedElementId
    ? hitElementsMap.get(selection.resolvedElementId)
    : undefined;

  return { hitElement, resolvedElement, selection };
}
