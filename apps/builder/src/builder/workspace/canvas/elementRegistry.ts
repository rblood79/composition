/**
 * Element Registry
 *
 * Element Bounds Registry (DirectContainer 배치 지원)
 *
 * PixiJS Container 참조를 저장하여 getBounds() 호출을 가능하게 합니다.
 * layoutResult.positions 대신 실제 DisplayObject의 bounds를 사용할 수 있습니다.
 *
 * @since 2025-01-06 Phase 1 ElementRegistry
 * @updated 2026-02-18 Phase 11 - DirectContainer 전환 완료
 */

import { notifyLayoutChange } from "./skia/useSkiaNode";
import { getSceneBounds } from "./skia/renderCommands";

// ============================================
// Types
// ============================================

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================
// Registry (Module-level singleton)
// ============================================

/**
 * Element ID → PixiJS Container 매핑 (legacy — UNIFIED_ENGINE에서는 미사용)
 * React 리렌더링을 트리거하지 않는 단순 Map 사용
 */
const elementRegistry = new Map<string, unknown>();

/**
 * Element ID → 직접 계산된 layout bounds 매핑
 * getBounds()가 layout 적용 전 0,0을 반환하는 문제 해결용.
 * LayoutContainer에서 layout prop 변경 시 직접 저장.
 */
const layoutBoundsRegistry = new Map<string, ElementBounds>();

// ============================================
// Registry API
// ============================================

/**
 * Container를 registry에 등록
 *
 * @param id - Element ID
 * @param container - PixiJS Container 인스턴스 (legacy, any type)
 */
export function registerElement(id: string, container: unknown): void {
  elementRegistry.set(id, container);
}

/**
 * 요소의 layout bounds를 직접 저장
 * LayoutContainer에서 layout prop이 변경될 때 호출.
 * getBounds()의 타이밍 문제를 우회.
 */
export function updateElementBounds(id: string, bounds: ElementBounds): void {
  const prev = layoutBoundsRegistry.get(id);
  if (prev) {
    const eps = 0.01;
    const unchanged =
      Math.abs(prev.x - bounds.x) < eps &&
      Math.abs(prev.y - bounds.y) < eps &&
      Math.abs(prev.width - bounds.width) < eps &&
      Math.abs(prev.height - bounds.height) < eps;
    if (unchanged) return;
  }

  layoutBoundsRegistry.set(id, bounds);

  // Phase 6+: 레이아웃 엔진(Taffy/Dropflow) 재계산 후 Skia 렌더 루프에 알림
  // DirectContainer의 레이아웃 콜백에서 호출되므로, registryVersion 증가로
  // 다음 프레임에서 container.width가 반영된 Skia 트리가 재구축된다.
  notifyLayoutChange();
  // NOTE: SpatialIndex 동기화는 renderCommands.ts의 syncSpatialIndex()에서 수행.
  // 이 함수에서 스크린 좌표(pan/zoom 미반영)로 동기화하면 pan 시 stale 좌표가 발생하므로 제거.
}

/**
 * Container를 registry에서 해제
 *
 * @param id - Element ID
 */
export function unregisterElement(id: string): void {
  elementRegistry.delete(id);
  layoutBoundsRegistry.delete(id);
  // NOTE: 다음 frame의 renderCommands.syncSpatialIndex()가 full snapshot diff로
  // SpatialIndex 항목을 제거한다. 별도 screen-coordinate remove는 하지 않는다.
}

/**
 * Element ID로 Container 조회
 *
 * @param id - Element ID
 * @returns Container 또는 undefined (UNIFIED_ENGINE에서는 항상 undefined)
 */
export function getElementContainer(id: string): unknown | undefined {
  return elementRegistry.get(id);
}

/**
 * Element ID로 bounds 조회 (getBounds() 호출)
 *
 * @param id - Element ID
 * @returns ElementBounds 또는 null
 */
export function getElementBounds(id: string): ElementBounds | null {
  const container = elementRegistry.get(id) as
    | {
        getBounds?: () => {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      }
    | undefined;
  if (!container) return null;

  try {
    const b = container.getBounds?.();
    if (!b) return null;
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  } catch {
    // Container가 아직 렌더링되지 않았거나 destroyed된 경우
    return null;
  }
}

/**
 * Element ID로 bounds 조회 (간단한 객체 형태)
 *
 * @param id - Element ID
 * @returns ElementBounds 또는 null
 */
export function getElementBoundsSimple(id: string): ElementBounds | null {
  // 직접 저장된 layout bounds 우선 사용 (getBounds() 타이밍 문제 우회)
  const layoutBounds = layoutBoundsRegistry.get(id);
  if (layoutBounds) return layoutBounds;

  const sceneBounds = getSceneBounds(id);
  if (sceneBounds) return sceneBounds;

  // fallback: PixiJS Container의 getBounds()
  const bounds = getElementBounds(id);
  if (!bounds) return null;

  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

/**
 * Registry에 등록된 모든 element ID 조회
 *
 * @returns Element ID 배열
 */
export function getRegisteredElementIds(): string[] {
  return Array.from(elementRegistry.keys());
}

/**
 * Registry 크기 조회
 *
 * @returns 등록된 element 수
 */
export function getRegistrySize(): number {
  return elementRegistry.size;
}

/**
 * Registry 초기화 (테스트 또는 페이지 전환 시 사용)
 */
export function clearRegistry(): void {
  elementRegistry.clear();
  layoutBoundsRegistry.clear();
  // NOTE: SpatialIndex는 renderCommands.ts의 syncSpatialIndex()가 다음 렌더
  // 프레임에 full snapshot diff로 재구성·stale 항목 제거한다.
}

// ============================================
// Debug Utilities
// ============================================

/**
 * Registry 상태 로깅 (개발 환경)
 */
export function logRegistryStats(): void {
  if (process.env.NODE_ENV !== "development") return;

  console.log(
    `📦 [ElementRegistry] registered: ${elementRegistry.size} elements`,
    Array.from(elementRegistry.keys()).slice(0, 5),
  );
}

/**
 * 좌표 기반 요소 히트 테스트 (Pencil-style)
 *
 * Pencil의 `findNodeAtPosition` 대응.
 * layoutBoundsRegistry의 screen 좌표 bounds를 사용하여
 * z-order 역순(render order 역순)으로 히트 판정.
 *
 * @param screenX - 스크린 좌표 X (panOffset 포함)
 * @param screenY - 스크린 좌표 Y (panOffset 포함)
 * @param candidateIds - 히트 테스트 대상 요소 ID (render order 순)
 * @param excludeIds - 히트 테스트에서 제외할 요소 ID (예: Body)
 * @returns 히트된 요소 ID 또는 null
 */
export function findElementAtPosition(
  screenX: number,
  screenY: number,
  candidateIds: string[],
  excludeIds?: Set<string>,
): string | null {
  // 히트된 모든 요소 수집 후, 가장 작은 영역(가장 구체적인 요소) 반환
  // PixiJS EventBoundary의 "가장 깊은 자식 우선" 동작을 flat 히트 테스트로 근사
  let bestId: string | null = null;
  let bestArea = Infinity;

  for (let i = candidateIds.length - 1; i >= 0; i--) {
    const id = candidateIds[i];
    if (excludeIds?.has(id)) continue;

    const bounds = layoutBoundsRegistry.get(id);
    if (!bounds) continue;

    if (
      screenX >= bounds.x &&
      screenX <= bounds.x + bounds.width &&
      screenY >= bounds.y &&
      screenY <= bounds.y + bounds.height
    ) {
      const area = bounds.width * bounds.height;
      if (area < bestArea) {
        bestArea = area;
        bestId = id;
      }
    }
  }
  return bestId;
}

export default {
  registerElement,
  unregisterElement,
  getElementContainer,
  getElementBounds,
  getElementBoundsSimple,
  getRegisteredElementIds,
  getRegistrySize,
  clearRegistry,
  logRegistryStats,
  findElementAtPosition,
};
