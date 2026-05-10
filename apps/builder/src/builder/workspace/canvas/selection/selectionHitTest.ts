import { isLegacyFrameElementForFrame } from "../../../../adapters/canonical/frameElementLoader";
import { getElementBoundsSimple } from "../elementRegistry";
import { parseZIndex } from "../layout/engines/cssStackingContext";
import type { CanvasInteractionNode } from "../interaction/interactionNode";

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
  elementsMap: ReadonlyMap<string, CanvasInteractionNode>;
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
  elementsMap: ReadonlyMap<string, CanvasInteractionNode>,
  childrenMap?: ReadonlyMap<string, readonly CanvasInteractionNode[]> | null,
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
    const priority = hitElementId
      ? compareHitPriority(candidateId, hitElementId, elementsMap, childrenMap)
      : 1;
    if (
      priority > 0 ||
      (priority === 0 &&
        (depth > bestDepth || (depth === bestDepth && area < bestArea)))
    ) {
      bestDepth = depth;
      bestArea = area;
      hitElementId = candidateId;
    }
  }

  return hitElementId;
}

function compareHitPriority(
  candidateId: string,
  currentId: string,
  elementsMap: ReadonlyMap<string, CanvasInteractionNode>,
  childrenMap?: ReadonlyMap<string, readonly CanvasInteractionNode[]> | null,
): number {
  if (candidateId === currentId) return 0;

  const candidateChain = getElementAncestorChain(candidateId, elementsMap);
  const currentChain = getElementAncestorChain(currentId, elementsMap);
  const length = Math.min(candidateChain.length, currentChain.length);

  let divergenceIndex = 0;
  while (
    divergenceIndex < length &&
    candidateChain[divergenceIndex] === currentChain[divergenceIndex]
  ) {
    divergenceIndex += 1;
  }

  if (divergenceIndex === candidateChain.length) return -1;
  if (divergenceIndex === currentChain.length) return 1;

  const candidateSiblingId = candidateChain[divergenceIndex];
  const currentSiblingId = currentChain[divergenceIndex];
  const candidateSibling = elementsMap.get(candidateSiblingId);
  const currentSibling = elementsMap.get(currentSiblingId);
  if (!candidateSibling || !currentSibling) return 0;

  const zIndexDiff =
    readElementZIndex(candidateSibling) - readElementZIndex(currentSibling);
  if (zIndexDiff !== 0) return zIndexDiff;

  const parentId =
    divergenceIndex > 0
      ? candidateChain[divergenceIndex - 1]
      : (candidateSibling.parent_id ?? null);
  const childIndexDiff = compareChildIndex(
    candidateSiblingId,
    currentSiblingId,
    parentId,
    childrenMap,
  );
  if (childIndexDiff !== 0) return childIndexDiff;

  return (
    getElementDepth(candidateId, elementsMap) -
    getElementDepth(currentId, elementsMap)
  );
}

function getElementAncestorChain(
  elementId: string,
  elementsMap: ReadonlyMap<string, CanvasInteractionNode>,
): string[] {
  const chain: string[] = [];
  let current = elementsMap.get(elementId);
  const visited = new Set<string>();

  while (current && !visited.has(current.id)) {
    chain.unshift(current.id);
    visited.add(current.id);
    current = current.parent_id
      ? elementsMap.get(current.parent_id)
      : undefined;
  }

  return chain;
}

function readElementZIndex(element: CanvasInteractionNode): number {
  const style = element.props?.style as Record<string, unknown> | undefined;
  const zIndex = style?.zIndex;
  return (
    parseZIndex(
      typeof zIndex === "number" || typeof zIndex === "string"
        ? zIndex
        : undefined,
    ) ?? 0
  );
}

function compareChildIndex(
  candidateId: string,
  currentId: string,
  parentId: string | null,
  childrenMap?: ReadonlyMap<string, readonly CanvasInteractionNode[]> | null,
): number {
  if (!parentId || !childrenMap) return 0;
  const children = childrenMap.get(parentId);
  if (!children) return 0;

  const candidateIndex = children.findIndex(
    (child) => child.id === candidateId,
  );
  const currentIndex = children.findIndex((child) => child.id === currentId);
  if (candidateIndex < 0 || currentIndex < 0) return 0;
  return candidateIndex - currentIndex;
}

function getElementDepth(
  elementId: string,
  elementsMap: ReadonlyMap<string, CanvasInteractionNode>,
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
  elementsMap: ReadonlyMap<string, CanvasInteractionNode>;
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
