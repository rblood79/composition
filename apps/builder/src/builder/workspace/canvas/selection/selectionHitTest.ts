import { isLegacyFrameElementForFrame } from "../../../../adapters/canonical/frameElementLoader";
import { getElementBoundsSimple } from "../elementRegistry";
import { parseZIndex } from "../layout/engines/cssStackingContext";
import { orderPagesForPaint } from "../scene/pagePaintOrder";
import type { CanvasInteractionNode } from "../interaction/interactionNode";
// `PagePositionMap` 정본은 `interaction/pagePositionPresentation.ts`
// (import 0건 leaf 모듈). 종전에 구조가 같은 인덱스 시그니처를 이 파일에
// 다시 선언하고 있었다 — 재수출해 호출부 import 경로는 그대로 둔다.
import type { PagePositionMap } from "../interaction/pagePositionPresentation";

export type { PagePositionMap };

export interface CanvasPoint {
  x: number;
  y: number;
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

export interface TopPageAtPointOptions {
  canvasPoint: CanvasPoint;
  activePageId: string | null;
  pageHeight: number;
  pagePositions: PagePositionMap;
  pagePositionReader?: (pageId: string) => { x: number; y: number } | undefined;
  pageWidth: number;
  pages: PageLike[];
}

/**
 * 지점을 덮는 페이지 중 페인트 최상단 페이지 id — top-first(페인트 역순) 첫 매치.
 * 겹침 영역에서는 위에 그려진 페이지(활성 페이지, 그 외엔 문서 순서 뒤쪽)가 잡힌다.
 * 문서 순서 정방향 + 첫 매치 break 는 아래 깔린 페이지를 선택하는 페인트↔히트
 * 비대칭이었다 (2026-08-11).
 */
export function findTopPageIdAtCanvasPoint({
  canvasPoint,
  activePageId,
  pageHeight,
  pagePositions,
  pagePositionReader,
  pageWidth,
  pages,
}: TopPageAtPointOptions): string | null {
  const orderedPages = orderPagesForPaint(pages, activePageId);
  for (let i = orderedPages.length - 1; i >= 0; i--) {
    const page = orderedPages[i];
    const position = pagePositionReader?.(page.id) ?? pagePositions[page.id];
    if (!position) {
      continue;
    }

    if (
      containsPoint(
        { x: position.x, y: position.y, width: pageWidth, height: pageHeight },
        canvasPoint,
      )
    ) {
      return page.id;
    }
  }

  return null;
}

export function pickTopmostHitElementId(
  hitCandidates: string[],
  elementsMap: ReadonlyMap<string, CanvasInteractionNode>,
  childrenMap?: ReadonlyMap<string, readonly CanvasInteractionNode[]> | null,
  pagePaintRank?: ReadonlyMap<string, number> | null,
  /**
   * 히트 지점을 덮는 최상단 페이지의 페인트 rank (findTopPageIdAtCanvasPoint 로
   * 산출). 이보다 낮은 rank 페이지의 요소는 위 페이지 body 에 가려져 화면에
   * 없으므로 후보에서 제외한다 — tie-break 만으로는 위 페이지에 요소가 없는
   * 지점에서 아래 페이지 요소가 유일 후보로 남아 "안 보이는데 클릭되는" 비대칭
   * (2026-08-11 live 실측).
   */
  occludingPageRank?: number | null,
): string | null {
  let hitElementId: string | null = null;
  let bestDepth = -1;
  let bestArea = Infinity;

  for (const candidateId of hitCandidates) {
    const candidate = elementsMap.get(candidateId);
    if (!candidate || candidate.type.toLowerCase() === "body") {
      continue;
    }

    if (
      pagePaintRank &&
      occludingPageRank !== null &&
      occludingPageRank !== undefined
    ) {
      const candidateRank = readElementPagePaintRank(candidate, pagePaintRank);
      if (candidateRank !== null && candidateRank < occludingPageRank) {
        continue;
      }
    }

    const bounds = getElementBoundsSimple(candidateId);
    const area = bounds ? bounds.width * bounds.height : Infinity;
    const depth = getElementDepth(candidateId, elementsMap);
    const priority = hitElementId
      ? compareHitPriority(
          candidateId,
          hitElementId,
          elementsMap,
          childrenMap,
          pagePaintRank,
        )
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

/** 요소 소속 페이지의 페인트 rank (pagePaintOrder.ts). 페이지 미상은 null. */
function readElementPagePaintRank(
  element: CanvasInteractionNode,
  pagePaintRank: ReadonlyMap<string, number>,
): number | null {
  const pageId = element.page_id ?? element.pageId ?? null;
  if (!pageId) return null;
  return pagePaintRank.get(pageId) ?? null;
}

function compareHitPriority(
  candidateId: string,
  currentId: string,
  elementsMap: ReadonlyMap<string, CanvasInteractionNode>,
  childrenMap?: ReadonlyMap<string, readonly CanvasInteractionNode[]> | null,
  pagePaintRank?: ReadonlyMap<string, number> | null,
): number {
  if (candidateId === currentId) return 0;

  // 서로 다른 페이지의 후보끼리는 페이지 페인트 순서가 1차 키다 — 겹침 영역에서
  // 위에 그려진(활성) 페이지의 요소가 이긴다. 같은 페이지/rank 미상이면 기존
  // 체인 비교로 진행 (조상 체인이 root 에서 갈라져 child-index 비교가 0 이 되는
  // 페이지 간 후보의 기존 판정은 depth 기반으로 사실상 미정의였다).
  if (pagePaintRank) {
    const candidateNode = elementsMap.get(candidateId);
    const currentNode = elementsMap.get(currentId);
    if (candidateNode && currentNode) {
      const candidateRank = readElementPagePaintRank(
        candidateNode,
        pagePaintRank,
      );
      const currentRank = readElementPagePaintRank(currentNode, pagePaintRank);
      if (
        candidateRank !== null &&
        currentRank !== null &&
        candidateRank !== currentRank
      ) {
        return candidateRank - currentRank;
      }
    }
  }

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
  pagePositionReader,
}: {
  canvasPoint: CanvasPoint;
  currentPageId: string | null;
  elementsMap: ReadonlyMap<string, CanvasInteractionNode>;
  frameAreas?: FrameBodySelectionArea[];
  pageHeight: number;
  pageIndexElementsByPage: Map<string, Set<string>>;
  pageSelectionEnabled?: boolean;
  pagePositions: PagePositionMap;
  pagePositionReader?: (pageId: string) => { x: number; y: number } | undefined;
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

  const pageId = findTopPageIdAtCanvasPoint({
    canvasPoint,
    activePageId: currentPageId,
    pageHeight,
    pagePositions,
    pagePositionReader,
    pageWidth,
    pages,
  });

  if (!pageId) {
    return { bodyElementId: null, pageId: null };
  }

  const pageElementIds = pageIndexElementsByPage.get(pageId);
  if (!pageElementIds) {
    return { bodyElementId: null, pageId };
  }

  for (const elementId of pageElementIds) {
    const element = elementsMap.get(elementId);
    if (element?.type.toLowerCase() === "body") {
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
