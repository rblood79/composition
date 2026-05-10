import type { CanvasSceneNode } from "./canvasSceneNode";
import type { CullingResult } from "../hooks/useViewportCulling";

const CULLING_CACHE_LIMIT = 24;
const cullingResultCache = new Map<string, CullingResult>();
const renderIdSetCache = new Map<string, Set<string>>();
const topLevelCandidateCache = new Map<string, Set<string>>();

function maintainCacheLimit<T>(cache: Map<string, T>): void {
  while (cache.size > CULLING_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    cache.delete(oldestKey);
  }
}

export function getCachedCullingResult(
  cacheKey: string,
  compute: () => CullingResult,
): CullingResult {
  const cached = cullingResultCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const result = compute();
  cullingResultCache.set(cacheKey, result);
  maintainCacheLimit(cullingResultCache);
  return result;
}

interface GetCachedRenderIdSetInput {
  cacheKey: string;
  elementById: Map<string, CanvasSceneNode>;
  visibleElements: CanvasSceneNode[];
}

export function getCachedRenderIdSet({
  cacheKey,
  elementById,
  visibleElements,
}: GetCachedRenderIdSetInput): Set<string> {
  const cached = renderIdSetCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const ids = new Set<string>();

  for (const element of visibleElements) {
    let current: CanvasSceneNode | undefined = element;
    while (current) {
      if (ids.has(current.id)) {
        break;
      }
      ids.add(current.id);
      if (!current.parent_id) {
        break;
      }
      current = elementById.get(current.parent_id);
    }
  }

  renderIdSetCache.set(cacheKey, ids);
  maintainCacheLimit(renderIdSetCache);
  return ids;
}

interface GetCachedTopLevelCandidateIdsInput {
  bodyElementId: string | null;
  cacheKey: string;
  pageChildrenMap: Map<string | null, CanvasSceneNode[]>;
}

export function getCachedTopLevelCandidateIds({
  bodyElementId,
  cacheKey,
  pageChildrenMap,
}: GetCachedTopLevelCandidateIdsInput): Set<string> {
  const cached = topLevelCandidateCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const candidateIds = new Set<string>();
  const roots = pageChildrenMap.get(bodyElementId) ?? [];

  const visitSubtree = (element: CanvasSceneNode): void => {
    candidateIds.add(element.id);
    const children = pageChildrenMap.get(element.id) ?? [];
    for (const child of children) {
      visitSubtree(child);
    }
  };

  for (const root of roots) {
    visitSubtree(root);
  }

  topLevelCandidateCache.set(cacheKey, candidateIds);
  maintainCacheLimit(topLevelCandidateCache);
  return candidateIds;
}
