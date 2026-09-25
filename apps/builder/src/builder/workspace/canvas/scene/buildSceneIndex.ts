import { projectDialogVisibility } from "./projectDialogVisibility";
import type { PageElementIndex } from "../../../stores/utils/elementIndexer";
import { getPageElements } from "../../../stores/utils/elementIndexer";
import type { Page } from "../../../../types/core/store.types";
import type { CanvasSceneNode } from "./canvasSceneNode";
import { readPageFrameSize } from "./pageFrameSize";
import { resolvePageWithFrame } from "./resolvePageWithFrame";
import type { ScenePageData, ScenePageFrame } from "./sceneSnapshotTypes";
import { isBodyType, isComponentsPage } from "@composition/shared";

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
    if (!element || isBodyType(element.type)) {
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
      pageElements: projectDialogVisibility(
        resolved.pageElements,
        isComponentsPage(page),
      ),
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
  /** ADR-231 — 레이아웃이 발행한 페이지별 body 높이 (Components 페이지만 읽는다). */
  pageContentHeights?: ReadonlyMap<string, number>,
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

    // 페이지 frame = body 저작 크기 (없으면 breakpoint) — 테두리·선택·히트·가이드가 같이 읽는다.
    //   Components 페이지 (ADR-231) 는 breakpoint 중립: 1920 × max(1080, 발행 높이).
    const neutral = isComponentsPage(page);
    const size = readPageFrameSize(
      page.id,
      pageIndex.elementsByPage,
      elementsMap,
      pageWidth,
      pageHeight,
      neutral
        ? {
            neutral: true,
            publishedContentHeight: pageContentHeights?.get(page.id),
          }
        : undefined,
    );
    return {
      elementCount,
      height: size.height,
      id: page.id,
      title: page.title,
      width: size.width,
      x: pagePositions[page.id]?.x ?? 0,
      y: pagePositions[page.id]?.y ?? 0,
    };
  });
}
