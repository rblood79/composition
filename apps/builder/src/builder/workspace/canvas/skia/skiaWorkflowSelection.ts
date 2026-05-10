import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import {
  getEditingSlotMarkerRole,
  getEditingSemanticsRole,
  type EditingSemanticsRole,
} from "../../../utils/editingSemantics";
import { getElementBoundsSimple } from "../elementRegistry";
import type { RendererSelectionInvalidation } from "../renderers";
import { calculateCombinedBounds } from "../selection/types";
import type { BoundingBox } from "../selection/types";
import type { LassoRenderData } from "./selectionRenderer";
import { computeConnectedEdges } from "./workflowGraphUtils";
import type { WorkflowEdge } from "./workflowEdges";
import type { WorkflowHighlightState } from "./workflowRenderer";
import { hasFrameElementMirrorId } from "../../../../adapters/canonical/frameMirror";

export interface SelectionRenderResult {
  bounds: BoundingBox | null;
  lasso: LassoRenderData | null;
  semanticRole: EditingSemanticsRole | null;
  semanticTargets: Array<{
    bounds: BoundingBox;
    semanticRole: EditingSemanticsRole | null;
    slotMarkerRole: EditingSemanticsRole | null;
  }>;
  showHandles: boolean;
  slotMarkerRole: EditingSemanticsRole | null;
}

export interface PageFrameLike {
  height: number;
  id: string;
  width: number;
  x: number;
  y: number;
}

function isRenderableSelectionTarget(
  id: string,
  element: CanvasSceneNode,
  currentPageId: string | null,
  treeBoundsMap: Map<string, BoundingBox>,
): boolean {
  if (currentPageId !== null && element.page_id === currentPageId) {
    return true;
  }

  return (
    element.page_id == null &&
    hasFrameElementMirrorId(element) &&
    treeBoundsMap.has(id)
  );
}

export function buildWorkflowHighlightState(
  hoveredEdgeId: string | null,
  focusedPageId: string | null,
  workflowEdges: WorkflowEdge[],
): WorkflowHighlightState | undefined {
  if (!hoveredEdgeId && !focusedPageId) {
    return undefined;
  }

  const connected = focusedPageId
    ? computeConnectedEdges(focusedPageId, workflowEdges)
    : {
        directEdgeIds: new Set<string>(),
        secondaryEdgeIds: new Set<string>(),
      };

  return {
    hoveredEdgeId,
    focusedPageId,
    directEdgeIds: connected.directEdgeIds,
    secondaryEdgeIds: connected.secondaryEdgeIds,
  };
}

export function collectHighlightedWorkflowPageIds(
  focusedPageId: string,
  highlightState: WorkflowHighlightState,
  workflowEdges: WorkflowEdge[],
): Set<string> {
  const connectedPageIds = new Set<string>();
  connectedPageIds.add(focusedPageId);

  for (const edge of workflowEdges) {
    if (highlightState.directEdgeIds.has(edge.id)) {
      connectedPageIds.add(edge.sourcePageId);
      connectedPageIds.add(edge.targetPageId);
    }
  }

  return connectedPageIds;
}

export function filterRenderableWorkflowEdges(
  workflowEdges: WorkflowEdge[],
  showNavigation: boolean,
  showEvents: boolean,
): WorkflowEdge[] {
  return workflowEdges.filter((edge) => {
    if (edge.type === "navigation") {
      return showNavigation;
    }
    if (edge.type === "event-navigation") {
      return showEvents;
    }
    return false;
  });
}

export function buildSelectionRenderData(
  cameraX: number,
  cameraY: number,
  cameraZoom: number,
  treeBoundsMap: Map<string, BoundingBox>,
  selection: RendererSelectionInvalidation,
  elementsMap: Map<string, CanvasSceneNode>,
  pageFrames?: PageFrameLike[],
): SelectionRenderResult {
  const selectedIds = selection.selectedElementIds;

  let selectionBounds: BoundingBox | null = null;
  let semanticRole: EditingSemanticsRole | null = null;
  const semanticTargets: SelectionRenderResult["semanticTargets"] = [];
  let slotMarkerRole: EditingSemanticsRole | null = null;
  let showHandles = false;

  if (selectedIds.length > 0) {
    const currentPageId = selection.currentPageId;
    const boxes: BoundingBox[] = [];

    for (const id of selectedIds) {
      const element = elementsMap.get(id);
      if (
        !element ||
        !isRenderableSelectionTarget(id, element, currentPageId, treeBoundsMap)
      ) {
        continue;
      }

      const elementSemanticRole = getEditingSemanticsRole(element);
      const elementSlotMarkerRole = getEditingSlotMarkerRole(
        element,
        elementsMap,
      );
      if (selectedIds.length === 1) {
        semanticRole = elementSemanticRole;
        slotMarkerRole = elementSlotMarkerRole;
      }

      const treeBounds = treeBoundsMap.get(id);
      if (treeBounds) {
        const bounds = {
          x: treeBounds.x,
          y: treeBounds.y,
          width: treeBounds.width,
          height: treeBounds.height,
        };
        boxes.push(bounds);
        if (
          selectedIds.length > 1 &&
          (elementSemanticRole || elementSlotMarkerRole)
        ) {
          semanticTargets.push({
            bounds,
            semanticRole: elementSemanticRole,
            slotMarkerRole: elementSlotMarkerRole,
          });
        }
        continue;
      }

      const globalBounds = getElementBoundsSimple(id);
      if (globalBounds) {
        const bounds = {
          x: (globalBounds.x - cameraX) / cameraZoom,
          y: (globalBounds.y - cameraY) / cameraZoom,
          width: globalBounds.width / cameraZoom,
          height: globalBounds.height / cameraZoom,
        };
        boxes.push(bounds);
        if (
          selectedIds.length > 1 &&
          (elementSemanticRole || elementSlotMarkerRole)
        ) {
          semanticTargets.push({
            bounds,
            semanticRole: elementSemanticRole,
            slotMarkerRole: elementSlotMarkerRole,
          });
        }
        continue;
      }

      if (element.type.toLowerCase() === "body" && pageFrames) {
        const pageFrame = pageFrames.find(
          (frame) => frame.id === element.page_id,
        );
        if (pageFrame) {
          boxes.push({
            x: pageFrame.x,
            y: pageFrame.y,
            width: pageFrame.width,
            height: pageFrame.height,
          });
        }
      }
    }

    selectionBounds = calculateCombinedBounds(boxes);
    showHandles = selectedIds.length === 1;
  }

  return {
    bounds: selectionBounds,
    lasso: null,
    semanticRole,
    semanticTargets,
    showHandles,
    slotMarkerRole,
  };
}
