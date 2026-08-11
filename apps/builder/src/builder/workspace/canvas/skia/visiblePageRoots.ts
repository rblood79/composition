import type { SkiaRendererInput } from "../renderers";
import { orderPagesForPaint } from "../scene/pagePaintOrder";

export interface VisiblePageRootBuildResult {
  bodyPageIds: Map<string, string>;
  bodyPagePositions: Record<string, { x: number; y: number }>;
  rootElementIds: string[];
}

export function collectVisiblePageRoots(
  rendererInput: SkiaRendererInput,
): VisiblePageRootBuildResult {
  const rootElementIds: string[] = [];
  const bodyPageIds = new Map<string, string>();
  const bodyPagePositions: Record<string, { x: number; y: number }> = {};

  if (rendererInput.editMode === "layout") {
    return { bodyPageIds, bodyPagePositions, rootElementIds };
  }

  const visiblePageIds = rendererInput.sceneSnapshot.document.visiblePageIds;

  // 활성 페이지를 마지막 root 로 — 겹친 페이지 위에 그려진다 (pagePaintOrder.ts).
  // rootSignature(getCachedCommandStream)가 순서를 포함하므로 활성 페이지 전환 시
  // 커맨드 스트림 캐시는 자동 무효화된다.
  const orderedPages = orderPagesForPaint(
    rendererInput.pages,
    rendererInput.sceneSnapshot.document.currentPageId,
  );

  for (const page of orderedPages) {
    if (!visiblePageIds.has(page.id)) {
      continue;
    }

    const pageSnapshot = rendererInput.pageSnapshots.get(page.id);
    const bodyElement = pageSnapshot?.bodyElement;
    if (!bodyElement) {
      continue;
    }

    rootElementIds.push(bodyElement.id);
    bodyPageIds.set(bodyElement.id, page.id);
    const pos = rendererInput.pagePositions[page.id];
    if (pos) {
      bodyPagePositions[bodyElement.id] = pos;
    }
  }

  return { bodyPageIds, bodyPagePositions, rootElementIds };
}
