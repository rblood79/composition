import type { SkiaRendererInput } from "../renderers";

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

  for (const page of rendererInput.pages) {
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
