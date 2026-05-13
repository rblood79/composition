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
  // same-page element — treeBoundsMap 없이도 fallback 경로 (getElementBoundsSimple)
  // 가 처리 가능. body 등 page 단위 element 도 통과.
  if (currentPageId !== null && element.page_id === currentPageId) {
    return true;
  }

  // bounds 가 등록되지 않은 element 는 selection box 그릴 좌표 부재 → 차단.
  if (!treeBoundsMap.has(id)) return false;

  // cross-page 일반 element — multi-page rendering ([[multipage]] 메모리) 으로
  // 모든 page 의 element 가 canvas 에 동시 렌더링되므로, page_id 와 currentPageId
  // 가 달라도 bounds 가 등록된 element 는 selection box 표시 가능. cross-page
  // multi-select 정합 (직전 fix ef22be877 의 cross-page shift+click 허용 후속).
  if (element.page_id != null) return true;

  // page_id null + frame mirror id 보유 — ADR-130 frame canonical layout/body
  // 등 special structural element. 기존 분기 유지.
  return hasFrameElementMirrorId(element);
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
    // multi-select 시에도 combined bounds 의 corner handles 표시. Figma / Pencil /
    // Sketch standard 동작 정합 — 사용자가 selection 영역을 시각적으로 인식.
    // Resize drag 동작 자체는 single 도 미구현 (handles 는 visual indicator only).
    showHandles = selectedIds.length >= 1;
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
