import type { SkiaRendererInput } from "../renderers";

export interface VisiblePageRootBuildResult {
  bodyPagePositions: Record<string, { x: number; y: number }>;
  rootElementIds: string[];
}

export function collectVisiblePageRoots(
  rendererInput: SkiaRendererInput,
): VisiblePageRootBuildResult {
  const rootElementIds: string[] = [];
  const bodyPagePositions: Record<string, { x: number; y: number }> = {};

  if (rendererInput.editMode === "layout") {
    return { bodyPagePositions, rootElementIds };
  }

  // ADR-144 Wave D Phase 1.5 — page tree + reusable masters (virtual page)
  // 양쪽 통합 순회. `rendererInput.pages` (Page tree array) 는 master 미포함
  // 이므로 `sceneSnapshot.document.visiblePageFrames` 기반 순회로 변경.
  // master frame 의 경우 bodyElement null 이지만 master id 자체를 root 로 push.
  const visibleFrames = rendererInput.sceneSnapshot.document.visiblePageFrames;
  const renderNodesMap = rendererInput.renderNodesMap;

  for (const frame of visibleFrames) {
    const pageSnapshot = rendererInput.pageSnapshots.get(frame.id);
    const bodyElement = pageSnapshot?.bodyElement;
    const pos = rendererInput.pagePositions[frame.id];

    if (bodyElement) {
      rootElementIds.push(bodyElement.id);
      if (pos) {
        bodyPagePositions[bodyElement.id] = pos;
      }
      continue;
    }

    // master frame (no body) — master id 자체가 element id.
    // renderNodesMap (ADR-135/136 hit-test authoritative source) 안 존재
    // 확인 후 push (canonicalElementsView 양쪽 traverse 결과 master 들이
    // renderNodesMap 안 등록되어 있음 — Wave D Task 7).
    if (renderNodesMap.has(frame.id)) {
      rootElementIds.push(frame.id);
      if (pos) {
        bodyPagePositions[frame.id] = pos;
      }
    }
  }

  return { bodyPagePositions, rootElementIds };
}
