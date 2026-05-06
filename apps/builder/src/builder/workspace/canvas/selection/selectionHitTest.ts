import type { Element } from "../../../../types/core/store.types";
import { isLegacyFrameElementForFrame } from "../../../../adapters/canonical/frameElementLoader";
import { getElementBoundsSimple } from "../elementRegistry";

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface PagePositionMap {
  [pageId: string]: { x: number; y: number } | undefined;
}

export interface PageLike {
  id: string;
}

export interface BodySelectionResult {
  bodyElementId: string | null;
  pageId: string | null;
}

export interface FrameBodySelectionArea {
  frameId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function containsPoint(
  bounds: { x: number; y: number; width: number; height: number },
  point: CanvasPoint,
): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

function findFrameBodySelectionAtCanvasPoint({
  canvasPoint,
  elementsMap,
  frameAreas,
}: {
  canvasPoint: CanvasPoint;
  elementsMap: Map<string, Element>;
  frameAreas: FrameBodySelectionArea[];
}): BodySelectionResult | null {
  for (let i = frameAreas.length - 1; i >= 0; i--) {
    const area = frameAreas[i];
    if (!containsPoint(area, canvasPoint)) continue;

    for (const element of elementsMap.values()) {
      if (element.deleted) continue;
      if (element.type.toLowerCase() !== "body") continue;
      if (!isLegacyFrameElementForFrame(element, area.frameId)) continue;
      return {
        bodyElementId: element.id,
        pageId: null,
      };
    }

    return { bodyElementId: null, pageId: null };
  }

  return null;
}

export function pickTopmostHitElementId(
  hitCandidates: string[],
  elementsMap: Map<string, Element>,
): string | null {
  let hitElementId: string | null = null;
  let bestDepth = -1;
  let bestArea = Infinity;

  for (const candidateId of hitCandidates) {
    const candidate = elementsMap.get(candidateId);
    if (!candidate || candidate.type.toLowerCase() === "body") {
      continue;
    }

    const bounds = getElementBoundsSimple(candidateId);
    const area = bounds ? bounds.width * bounds.height : Infinity;
    const depth = getElementDepth(candidateId, elementsMap);
    if (depth > bestDepth || (depth === bestDepth && area < bestArea)) {
      bestDepth = depth;
      bestArea = area;
      hitElementId = candidateId;
    }
  }

  return hitElementId;
}

function getElementDepth(
  elementId: string,
  elementsMap: Map<string, Element>,
): number {
  let depth = 0;
  let current = elementsMap.get(elementId);
  const visited = new Set<string>();

  while (current?.parent_id && !visited.has(current.parent_id)) {
    visited.add(current.parent_id);
    const parent = elementsMap.get(current.parent_id);
    if (!parent) break;
    depth += 1;
    current = parent;
  }

  return depth;
}

export function findBodySelectionAtCanvasPoint({
  canvasPoint,
  currentPageId,
  elementsMap,
  pageHeight,
  pageIndexElementsByPage,
  pageSelectionEnabled = true,
  pagePositions,
  pageWidth,
  pages,
  frameAreas = [],
}: {
  canvasPoint: CanvasPoint;
  currentPageId: string | null;
  elementsMap: Map<string, Element>;
  frameAreas?: FrameBodySelectionArea[];
  pageHeight: number;
  pageIndexElementsByPage: Map<string, Set<string>>;
  pageSelectionEnabled?: boolean;
  pagePositions: PagePositionMap;
  pageWidth: number;
  pages: PageLike[];
}): BodySelectionResult {
  const frameSelection = findFrameBodySelectionAtCanvasPoint({
    canvasPoint,
    elementsMap,
    frameAreas,
  });
  if (frameSelection) {
    return frameSelection;
  }

  if (!pageSelectionEnabled) {
    return { bodyElementId: null, pageId: null };
  }

  let pageId: string | null = null;

  for (const page of pages) {
    const position = pagePositions[page.id];
    if (!position) {
      continue;
    }

    if (
      containsPoint(
        { x: position.x, y: position.y, width: pageWidth, height: pageHeight },
        canvasPoint,
      )
    ) {
      pageId = page.id;
      break;
    }
  }

  if (!pageId) {
    return { bodyElementId: null, pageId: null };
  }

  const pageElementIds = pageIndexElementsByPage.get(pageId);
  if (!pageElementIds) {
    return { bodyElementId: null, pageId };
  }

  for (const elementId of pageElementIds) {
    const element = elementsMap.get(elementId);
    if (element?.type === "body") {
      return {
        bodyElementId: element.id,
        pageId,
      };
    }
  }

  return {
    bodyElementId: null,
    pageId: pageId === currentPageId ? currentPageId : pageId,
  };
}
