/**
 * ADR-111 P3-δ — reusable frame canvas authoring viewport root collection.
 *
 * Sibling to `visiblePageRoots.ts`. P3-α (`framePositions`) + P3-β
 * (`computeFrameAreas`) + P3-γ (`selectedReusableFrameId`) 결정에 따라 신설.
 *
 * Contract:
 * - input: `SkiaRendererInput.frameAreas` (canonical reusable frames, 이미
 *   현재 page 작업면 좌표/크기로 정규화됨)
 * - output: rootElementIds (frame body element id 목록) +
 *   bodyPagePositions (body element id → {x,y}) — `visiblePageRoots` 출력과
 *   동일 shape 라 caller (skiaFramePipeline) 가 단일 맵으로 병합 가능 (D3=A)
 *
 * frame body 식별 (ADR-116 cleanup): canonical reusable FrameNode 에서 파생한
 * `frameElementScopes[frameId].bodyElementId` 를 직접 사용한다. legacy
 * `layout_id` mirror predicate 는 이 Skia root collection 경로에서 사용하지
 * 않는다.
 */

import type { SkiaRendererInput } from "../renderers";

export interface VisibleFrameRootBuildResult {
  /** frame body element id → { x, y } — `visiblePageRoots` 와 동일 shape */
  bodyPagePositions: Record<string, { x: number; y: number }>;
  /** frame body element id 목록 — render command stream root 진입 */
  rootElementIds: string[];
}

export function collectVisibleFrameRoots(
  rendererInput: SkiaRendererInput,
): VisibleFrameRootBuildResult {
  const rootElementIds: string[] = [];
  const bodyPagePositions: Record<string, { x: number; y: number }> = {};

  if (rendererInput.editMode !== "layout") {
    return { rootElementIds, bodyPagePositions };
  }

  if (rendererInput.frameAreas.length === 0) {
    return { rootElementIds, bodyPagePositions };
  }

  for (const area of rendererInput.frameAreas) {
    const frameScope = rendererInput.frameElementScopes.get(area.frameId);
    const bodyId = frameScope?.bodyElementId ?? null;
    if (!bodyId) continue;
    const bodyElement = rendererInput.sceneNodesMap.get(bodyId);
    if (!bodyElement || bodyElement.deleted || bodyElement.type !== "body") {
      continue;
    }

    rootElementIds.push(bodyId);
    bodyPagePositions[bodyId] = { x: area.x, y: area.y };
  }

  return { rootElementIds, bodyPagePositions };
}
