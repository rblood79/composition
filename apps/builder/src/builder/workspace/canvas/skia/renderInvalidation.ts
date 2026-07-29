/**
 * Render Invalidation Model — ADR-035 Phase 3
 *
 * 기존 version 카운터(registryVersion, layoutVersion 등)를 유지하면서,
 * 무효화 이유를 명시적으로 추적 가능하게 한다.
 *
 * 목적:
 * - 어떤 변경이 어떤 캐시를 무효화하는지 추적
 * - 불필요한 재렌더링 원인 진단
 * - Phase 4 frame build pipeline 분리의 기반
 */

import { canvasDebug } from "../utils/canvasDebug";

// ---------------------------------------------------------------------------
// InvalidationReason — 무효화 이유 분류
// ---------------------------------------------------------------------------

export const INVALIDATION_REASONS = [
  "content",
  "layout",
  "viewport",
  "overlay",
  "theme",
  "resource",
  "workflow",
] as const;

export type InvalidationReason = (typeof INVALIDATION_REASONS)[number];

// ---------------------------------------------------------------------------
// Version → Reason → Cache 매핑
// ---------------------------------------------------------------------------

/**
 * 무효화 매핑 테이블 (문서화 + 런타임 참조)
 *
 * ┌───────────────────────┬───────────┬──────────────────────────────────────────────┐
 * │ Version / Source      │ Reason    │ 무효화 캐시                                  │
 * ├───────────────────────┼───────────┼──────────────────────────────────────────────┤
 * │ registryVersion       │ content   │ _cachedTree, commandStreamCache, contentNode  │
 * │ registryVersion       │ resource  │ (폰트/이미지 로드 → notifyLayoutChange)       │
 * │ layoutVersion         │ layout    │ fullTreeLayoutMap (useMemo)                   │
 * │ visibleContentVersion │ content   │ visible page contentNode + commandStreamCache │
 * │ visiblePagePosition   │ viewport  │ visible page content cache + stale 보정        │
 * │ allPageFrameVersion   │ workflow  │ document overlay(workflow/minimap/page frame)  │
 * │ overlayVersion        │ overlay   │ overlayNode (selection/pageFrames)            │
 * │ overlayVersion        │ workflow  │ overlayNode (workflow edges/hover/focus)      │
 * │ themeVersion          │ theme     │ 전체 Skia 트리 (색상 재계산)                  │
 * │ containerResize       │ content   │ Surface 재생성 + contentNode 무효화          │
 * │ dprChange             │ resource  │ Surface 재생성 (devicePixelRatio 변경)        │
 * │ contextRestored       │ resource  │ WebGL context loss → restore 후 전체 재렌더   │
 * │ pageSwitch            │ overlay   │ 페이지 타이틀/selection highlight 갱신        │
 * │ imageLoaded           │ resource  │ contentNode + layoutVersion (fit-content 용)  │
 * └───────────────────────┴───────────┴──────────────────────────────────────────────┘
 *
 * stale 보정:
 * - _pagePosStaleFrames: viewport 변경 후 3프레임간 강제 무효화
 *   (React ↔ PixiJS Container 동기화 지연 회피)
 *
 * 카메라 유발 vs 콘텐츠 유발 (ADR-173 Phase 2):
 * - 위 표의 visibleContentVersion / visiblePagePosition 행은 **두 축이 섞여
 *   있다** — 편집(페이지 contentVersion 변경)과 카메라 이동(가시 집합 진입/이탈)
 *   이 같은 version 을 흔든다. 카메라 축은 제스처 중 65ms 급 재래스터를 매
 *   경계 통과마다 꽂으므로, `BuilderCanvas` 의 sceneVisibility 게이트
 *   (`scene/cameraStableVisibility.ts`)가 **카메라 유발 갱신만** 제스처 종료까지
 *   미룬다. 판정 축은 SceneStructureCore identity — 편집은 core 를 바꾸므로
 *   게이트를 통과해 즉시 반영된다.
 * - 즉 이연된 프레임에서는 위 표의 무효화가 **일어나지 않는다**. 제스처 중
 *   남는 재래스터 사유는 SkiaRenderer.classifyFrame 의 기하 조건
 *   (zoom-refresh / coverage-refresh) 뿐이다.
 */

// ---------------------------------------------------------------------------
// Invalidation Tracker — 런타임 추적
// ---------------------------------------------------------------------------

export interface InvalidationEntry {
  reason: InvalidationReason;
  timestamp: number;
  source: string;
}

const HISTORY_LIMIT = 100;
const recentInvalidations: InvalidationEntry[] = [];

function shouldTrackInvalidation(): boolean {
  return (
    process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test"
  );
}

/**
 * 무효화 이유를 기록한다.
 * canvasDebug.invalidation 카테고리가 활성화되어 있으면 콘솔에도 출력한다.
 */
export function recordInvalidation(
  reason: InvalidationReason,
  source: string,
): void {
  if (!shouldTrackInvalidation()) return;

  const entry: InvalidationEntry = {
    reason,
    timestamp: performance.now(),
    source,
  };

  recentInvalidations.push(entry);
  if (recentInvalidations.length > HISTORY_LIMIT) {
    recentInvalidations.shift();
  }

  canvasDebug.invalidation(reason, { source });
}

/**
 * 최근 무효화 이력을 반환한다. 디버깅 용도.
 */
export function getInvalidationHistory(): readonly InvalidationEntry[] {
  return recentInvalidations;
}

/**
 * 최근 N밀리초 내 특정 reason의 무효화 횟수를 반환한다.
 */
export function countRecentInvalidations(
  reason: InvalidationReason,
  withinMs: number = 1000,
): number {
  const cutoff = performance.now() - withinMs;
  let count = 0;
  for (let i = recentInvalidations.length - 1; i >= 0; i--) {
    const entry = recentInvalidations[i];
    if (entry.timestamp < cutoff) break;
    if (entry.reason === reason) count++;
  }
  return count;
}

export function resetInvalidationHistory(): void {
  recentInvalidations.length = 0;
}

// 개발 콘솔에서 접근
if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__invalidationHistory =
    getInvalidationHistory;
  (window as unknown as Record<string, unknown>).__countInvalidations =
    countRecentInvalidations;
}
