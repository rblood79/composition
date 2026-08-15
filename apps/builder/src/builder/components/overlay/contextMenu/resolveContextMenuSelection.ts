import { resolveClickTarget } from "../../../utils/hierarchicalSelection";
import {
  hitTestSelectionBounds,
  type BoundingBox,
} from "../../../workspace/canvas/selection/types";
import type { CanvasInteractionNode } from "../../../workspace/canvas/interaction/interactionNode";
import type { ContextMenuSurface } from "./types";

export interface ContextMenuSelectionState {
  selectedElementIds: readonly string[];
  editingContextId: string | null;
}

export interface ResolveContextMenuSelectionInput {
  hitElementId: string | null;
  scenePoint: { x: number; y: number };
  current: ContextMenuSelectionState;
  elementsMap: ReadonlyMap<string, CanvasInteractionNode>;
  selectionBounds: BoundingBox | null;
}

export interface ResolvedContextMenuSelection {
  surface: ContextMenuSurface;
  nextSelection: string[];
  targetElementIds: string[];
  resolvedElementId: string | null;
}

export function resolveContextMenuSelection({
  hitElementId,
  scenePoint,
  current,
  elementsMap,
  selectionBounds,
}: ResolveContextMenuSelectionInput): ResolvedContextMenuSelection {
  const resolvedElementId = hitElementId
    ? resolveClickTarget(hitElementId, current.editingContextId, elementsMap)
    : null;

  if (resolvedElementId) {
    const hitIsSelected =
      current.selectedElementIds.includes(resolvedElementId);
    const nextSelection = hitIsSelected
      ? [...current.selectedElementIds]
      : [resolvedElementId];

    return {
      surface: "canvas-element",
      nextSelection,
      targetElementIds: nextSelection,
      resolvedElementId,
    };
  }

  const keepSelection = hitTestSelectionBounds(scenePoint, selectionBounds);
  const nextSelection = keepSelection ? [...current.selectedElementIds] : [];

  return {
    surface: "canvas-empty",
    nextSelection,
    targetElementIds: nextSelection,
    resolvedElementId: null,
  };
}
