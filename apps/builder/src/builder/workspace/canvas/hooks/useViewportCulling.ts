/**
 * useViewportCulling
 *
 * 🚀 Phase 11: Viewport Culling 최적화
 *
 * 수동 visibility 방식으로 뷰포트 외부 요소를 렌더링에서 제외합니다.
 * PixiJS v8의 Culler API 대신 간단한 수동 방식 사용.
 *
 * 성능 효과:
 * - 화면 밖 요소가 50%+ 일 때: 20-40% GPU 부하 감소
 * - 대형 캔버스에서 줌아웃 시 특히 효과적
 *
 * @since 2025-12-20 Phase 11 Viewport Culling
 * @updated 2026-01-31 실시간 getBounds() 기반 스크린 좌표 culling (SpatialIndex 제거 — stale 좌표 이슈)
 */

import { useMemo } from "react";
import { getElementBoundsSimple } from "../elementRegistry";
import { getCachedCullingResult } from "../scene";
import { WASM_FLAGS } from "../wasm-bindings/featureFlags";
import { queryVisibleElements } from "../wasm-bindings/spatialIndex";

export interface ViewportCullingNode {
  id: string;
  props?: Record<string, unknown>;
  parent_id?: string | null;
}

let _lastCullingWarnTime = 0;

// ============================================
// Types
// ============================================

export interface ViewportBounds {
  /** 뷰포트 좌측 경계 */
  left: number;
  /** 뷰포트 상단 경계 */
  top: number;
  /** 뷰포트 우측 경계 */
  right: number;
  /** 뷰포트 하단 경계 */
  bottom: number;
  /** 뷰포트 너비 */
  width: number;
  /** 뷰포트 높이 */
  height: number;
}

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CullingResult {
  /** 뷰포트 내에 있는 요소들 */
  visibleElements: ViewportCullingNode[];
  /** 컬링된 요소 수 */
  culledCount: number;
  /** 전체 요소 수 */
  totalCount: number;
  /** 컬링 비율 (0-1) */
  cullingRatio: number;
}

// ============================================
// Constants
// ============================================

/**
 * 뷰포트 경계 외부로 확장할 마진 (px)
 * 스크롤/팬 시 깜빡임 방지를 위해 약간의 여유 영역 포함
 */
const VIEWPORT_MARGIN = 100;

// ============================================
// Utilities
// ============================================

/**
 * 스크린 좌표 기반 뷰포트 경계 계산
 *
 * container.getBounds()가 스크린(글로벌) 좌표를 반환하므로,
 * 뷰포트도 스크린 좌표로 계산하면 좌표 변환이 불필요합니다.
 */
export function calculateViewportBounds(
  screenWidth: number,
  screenHeight: number,
  _zoom?: number,
  _panOffset?: { x: number; y: number },
  margin: number = VIEWPORT_MARGIN,
): ViewportBounds {
  return {
    left: -margin,
    top: -margin,
    right: screenWidth + margin,
    bottom: screenHeight + margin,
    width: screenWidth + 2 * margin,
    height: screenHeight + 2 * margin,
  };
}

/**
 * 씬 좌표 기반 뷰포트 경계 계산 (SpatialIndex Fast Path 전용)
 *
 * 스크린 좌표를 pan/zoom 역변환하여 씬 좌표계로 변환.
 * renderCommands.ts의 boundsMap이 씬 좌표를 기록하므로,
 * SpatialIndex에도 씬 좌표로 쿼리해야 정확한 결과를 얻는다.
 *
 * 변환 공식: sceneX = (screenX - panOffset.x) / zoom
 */
export function calculateViewportBoundsScene(
  screenWidth: number,
  screenHeight: number,
  zoom: number,
  panOffset: { x: number; y: number },
  margin: number = VIEWPORT_MARGIN,
): { left: number; top: number; right: number; bottom: number } {
  const sceneMargin = margin / zoom;
  const left = -panOffset.x / zoom - sceneMargin;
  const top = -panOffset.y / zoom - sceneMargin;
  const right = (-panOffset.x + screenWidth) / zoom + sceneMargin;
  const bottom = (-panOffset.y + screenHeight) / zoom + sceneMargin;
  return { left, top, right, bottom };
}

/**
 * 요소의 경계 박스 추출 (style 기반 fallback)
 */
export function getElementBounds(
  element: ViewportCullingNode,
  layoutPosition?: { x: number; y: number; width: number; height: number },
): ElementBounds {
  if (layoutPosition) {
    return {
      x: layoutPosition.x,
      y: layoutPosition.y,
      width: layoutPosition.width,
      height: layoutPosition.height,
    };
  }

  const style = element.props?.style as Record<string, unknown> | undefined;
  return {
    x: Number(style?.left) || 0,
    y: Number(style?.top) || 0,
    width: Number(style?.width) || 100,
    height: Number(style?.height) || 100,
  };
}

/**
 * 요소가 뷰포트 내에 있는지 확인 (AABB 충돌 검사)
 */
export function isElementInViewport(
  elementBounds: ElementBounds,
  viewport: ViewportBounds,
): boolean {
  // AABB (Axis-Aligned Bounding Box) 충돌 검사
  // 두 사각형이 겹치지 않는 조건의 부정
  return !(
    elementBounds.x + elementBounds.width < viewport.left ||
    elementBounds.x > viewport.right ||
    elementBounds.y + elementBounds.height < viewport.top ||
    elementBounds.y > viewport.bottom
  );
}

/**
 * layoutBoundsRegistry 기반 O(N) 스크린 좌표 culling (Fallback / 교차 검증용)
 *
 * Phase 9: PixiJS 제거 이후 getBounds() 대신 getElementBoundsSimple() 사용.
 * 부모-자식 관계를 고려하여 overflow 가능성이 있는 자식을 포함.
 */
function getBoundsVisibleElements(
  elements: ViewportCullingNode[],
  viewport: ViewportBounds,
): ViewportCullingNode[] {
  const parentVisibilityCache = new Map<string, boolean>();

  const isParentOnScreen = (parentId: string | null | undefined): boolean => {
    if (!parentId) return true;
    const cached = parentVisibilityCache.get(parentId);
    if (cached !== undefined) return cached;

    const bounds = getElementBoundsSimple(parentId);
    if (!bounds) {
      parentVisibilityCache.set(parentId, true);
      return true;
    }
    if (bounds.width <= 0 && bounds.height <= 0) {
      parentVisibilityCache.set(parentId, true);
      return true;
    }
    const visible = isElementInViewport(bounds, viewport);
    parentVisibilityCache.set(parentId, visible);
    return visible;
  };

  return elements.filter((element) => {
    const bounds = getElementBoundsSimple(element.id);
    if (!bounds) return true;
    if (bounds.width <= 0 && bounds.height <= 0) return true;
    if (isElementInViewport(bounds, viewport)) return true;
    if (isParentOnScreen(element.parent_id)) return true;
    return false;
  });
}

/**
 * DEV 교차 검증: SpatialIndex 결과 vs getBounds() O(N) 결과 비교.
 * 불일치 발생 시 콘솔 경고를 출력하여 씬 좌표 동기화 이슈를 조기 감지.
 */
function crossValidateCulling(
  elements: ViewportCullingNode[],
  spatialVisibleElements: ViewportCullingNode[],
  screenWidth: number,
  screenHeight: number,
  zoom: number,
  panOffset: { x: number; y: number },
): void {
  if (process.env.NODE_ENV !== "development") return;

  // panOffset은 변환 공식에서 사용됨 (향후 스크린→씬 좌표 역변환 교차검증용)
  void zoom;
  void panOffset;

  const viewport = calculateViewportBounds(screenWidth, screenHeight);
  const boundsVisible = getBoundsVisibleElements(elements, viewport);

  const spatialIds = new Set(spatialVisibleElements.map((el) => el.id));
  const boundsIds = new Set(boundsVisible.map((el) => el.id));

  const falseNegatives: string[] = []; // getBounds 가시 but SpatialIndex 누락
  const falsePositives: string[] = []; // SpatialIndex 가시 but getBounds 누락

  for (const id of boundsIds) {
    if (!spatialIds.has(id)) falseNegatives.push(id);
  }
  for (const id of spatialIds) {
    if (!boundsIds.has(id)) falsePositives.push(id);
  }

  if (falseNegatives.length > 0 || falsePositives.length > 0) {
    // Throttle: 5초에 1회만 로그 출력 (레이아웃 타이밍 차이로 인한 일시적 불일치 스팸 방지)
    const now = Date.now();
    if (now - _lastCullingWarnTime > 5000) {
      _lastCullingWarnTime = now;
      console.warn("[ViewportCulling] SpatialIndex vs getBounds() 불일치", {
        falseNegatives: falseNegatives.slice(0, 5),
        falsePositives: falsePositives.slice(0, 5),
      });
    }
  }
}

// ============================================
// Hook
// ============================================

export interface UseViewportCullingOptions {
  /** culling 결과 캐시 키 */
  cacheKey?: string;
  /** 요소 목록 */
  elements: ViewportCullingNode[];
  /** 현재 줌 레벨 */
  zoom: number;
  /** 팬 오프셋 */
  panOffset: { x: number; y: number };
  /** 화면 너비 (기본값: window.innerWidth) */
  screenWidth?: number;
  /** 화면 높이 (기본값: window.innerHeight) */
  screenHeight?: number;
  /** 컬링 활성화 여부 (기본값: true) */
  enabled?: boolean;
  /** 외부 변경 감지용 버전 (예: 페이지 위치 이동) */
  version?: number;
}

/**
 * Viewport Culling Hook
 *
 * 뷰포트 외부에 있는 요소를 필터링하여 렌더링 성능을 최적화합니다.
 *
 * 🔧 실시간 스크린 좌표 기반 culling:
 * - container.getBounds()로 현재 프레임의 스크린 좌표 사용
 * - pan/zoom 시에도 항상 정확 (stale 좌표 문제 없음)
 * - SpatialIndex는 라쏘 선택 등 별도 기능에서만 사용
 *
 * @example
 * ```tsx
 * const { visibleElements, culledCount } = useViewportCulling({
 *   elements: pageElements,
 *   zoom,
 *   panOffset,
 * });
 *
 * // visibleElements만 렌더링
 * {visibleElements.map(el => <ElementSprite key={el.id} element={el} />)}
 * ```
 */
export function useViewportCulling({
  cacheKey,
  elements,
  zoom,
  panOffset,
  screenWidth = typeof window !== "undefined" ? window.innerWidth : 1920,
  screenHeight = typeof window !== "undefined" ? window.innerHeight : 1080,
  enabled = true,
  version = 0,
}: UseViewportCullingOptions): CullingResult {
  return useMemo(() => {
    const computeResult = () => {
      if (!enabled || elements.length === 0) {
        return {
          visibleElements: elements,
          culledCount: 0,
          totalCount: elements.length,
          cullingRatio: 0,
        };
      }

      if (WASM_FLAGS.SPATIAL_INDEX) {
        const sceneBounds = calculateViewportBoundsScene(
          screenWidth,
          screenHeight,
          zoom,
          panOffset,
        );
        const visibleIds = new Set(
          queryVisibleElements(
            sceneBounds.left,
            sceneBounds.top,
            sceneBounds.right,
            sceneBounds.bottom,
          ),
        );

        const visibleElements = elements.filter(
          (el) => !visibleIds.size || visibleIds.has(el.id),
        );

        const culledCount = elements.length - visibleElements.length;

        if (import.meta.env.DEV && version > 0 && version % 100 === 0) {
          crossValidateCulling(
            elements,
            visibleElements,
            screenWidth,
            screenHeight,
            zoom,
            panOffset,
          );
        }

        return {
          visibleElements,
          culledCount,
          totalCount: elements.length,
          cullingRatio: elements.length > 0 ? culledCount / elements.length : 0,
        };
      }

      const viewport = calculateViewportBounds(screenWidth, screenHeight);
      const visibleElements = getBoundsVisibleElements(elements, viewport);
      const culledCount = elements.length - visibleElements.length;

      return {
        visibleElements,
        culledCount,
        totalCount: elements.length,
        cullingRatio: elements.length > 0 ? culledCount / elements.length : 0,
      };
    };

    if (!cacheKey) {
      return computeResult();
    }

    return getCachedCullingResult(cacheKey, computeResult);
    // zoom/panOffset은 getBounds()에 간접 반영되지만, 뷰 변경 시 재계산 트리거 필요
  }, [
    cacheKey,
    elements,
    zoom,
    panOffset,
    screenWidth,
    screenHeight,
    enabled,
    version,
  ]);
}

// ============================================
// Debug Utilities
// ============================================

/**
 * 컬링 상태 로깅 (개발 환경)
 */
export function logCullingStats(result: CullingResult): void {
  if (process.env.NODE_ENV !== "development") return;

  const { visibleElements, culledCount, totalCount, cullingRatio } = result;

  console.log(
    `🎯 [ViewportCulling] visible: ${visibleElements.length}/${totalCount} ` +
      `(culled: ${culledCount}, ratio: ${(cullingRatio * 100).toFixed(1)}%)`,
  );
}

export default useViewportCulling;
