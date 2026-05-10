import type { PageElementIndex } from "../../../stores/utils/elementIndexer";
import { getPageElements } from "../../../stores/utils/elementIndexer";
import type { Page } from "../../../../types/core/store.types";
import type { CanvasSceneNode } from "./canvasSceneNode";
import { resolvePageWithFrame } from "./resolvePageWithFrame";
import type { ScenePageData, ScenePageFrame } from "./sceneSnapshotTypes";

export function buildDepthMap(
  elements: CanvasSceneNode[],
  elementsMap: Map<string, CanvasSceneNode>,
): Map<string, number> {
  const cache = new Map<string, number>();

  const computeDepth = (id: string | null): number => {
    if (!id) return 0;

    const cached = cache.get(id);
    if (cached !== undefined) {
      return cached;
    }

    const element = elementsMap.get(id);
    if (!element || element.type.toLowerCase() === "body") {
      cache.set(id, 0);
      return 0;
    }

    const style = element.props?.style as Record<string, unknown> | undefined;
    if (style?.display === "contents") {
      const depth = computeDepth(element.parent_id ?? null);
      cache.set(id, depth);
      return depth;
    }

    const depth = 1 + computeDepth(element.parent_id ?? null);
    cache.set(id, depth);
    return depth;
  };

  for (const element of elements) {
    cache.set(element.id, computeDepth(element.id));
  }

  return cache;
}

export function buildPageDataMap(
  pages: Page[],
  pageIndex: PageElementIndex,
  elementsMap: Map<string, CanvasSceneNode>,
): Map<string, ScenePageData> {
  const pageDataMap = new Map<string, ScenePageData>();

  for (const page of pages) {
    const pageElements = getPageElements(pageIndex, page.id, elementsMap);
    const resolved = resolvePageWithFrame({
      page,
      pageElements,
      elementsMap,
    });

    pageDataMap.set(page.id, {
      bodyElement: resolved.bodyElement,
      pageElements: resolved.pageElements,
    });
  }

  return pageDataMap;
}

export function buildPageFrames(
  pages: Page[],
  pageIndex: PageElementIndex,
  elementsMap: Map<string, CanvasSceneNode>,
  pagePositions: Record<string, { x: number; y: number } | undefined>,
  pageWidth: number,
  pageHeight: number,
): ScenePageFrame[] {
  return pages.map((page) => {
    const pageElementIds = pageIndex.elementsByPage.get(page.id);
    let elementCount = 0;

    if (pageElementIds) {
      for (const id of pageElementIds) {
        const element = elementsMap.get(id);
        if (element && !element.deleted) {
          elementCount++;
        }
      }
    }

    return {
      elementCount,
      height: pageHeight,
      id: page.id,
      title: page.title,
      width: pageWidth,
      x: pagePositions[page.id]?.x ?? 0,
      y: pagePositions[page.id]?.y ?? 0,
    };
  });
}
