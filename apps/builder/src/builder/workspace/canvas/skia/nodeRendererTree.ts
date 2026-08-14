/**
 * 드래그 시각 오프셋 모듈 (구 nodeRendererTree 잔존 현역부)
 *
 * 구 tree-walk 렌더러(renderNode/renderNodeInternal — command stream 이전의
 * 계층 트리 재귀 렌더)는 ADR-900 완결 후 도달 불가로 남았다가 2026-08-14
 * simplify 에서 제거됨. 남은 것은 Pencil deferred-drop 패턴의 드래그 시각
 * 오프셋 상태뿐이다 (renderCommands / useDragBridge / SkiaCanvas 가 소비).
 */
import { notifyLayoutChange } from "./useSkiaNode";

// ============================================
// Drag Visual Offset (Pencil deferred-drop 패턴)
// globalThis 사용 — HMR 모듈 인스턴스 분리 방지
// ============================================

// ADR-178: 다중 선택 드래그 — 대상 집합 + 공유 델타. 전 대상이 같은 델타로
// 움직이므로 Map<id, {dx,dy}> 대신 Set + 공유 {dx,dy} 로 둔다 (조회 O(1) 유지,
// 프레임당 갱신은 델타 2필드뿐 — HC3 "전체 맵 clone 금지" 충족).
interface DragVisualOffsetData {
  elementIds: ReadonlySet<string>;
  dx: number;
  dy: number;
}

const G = globalThis as unknown as {
  __composition_dragVisualOffset?: DragVisualOffsetData | null;
  __composition_dragSiblingOffsets?: Map<
    string,
    { dx: number; dy: number }
  > | null;
};

function _get(): DragVisualOffsetData | null {
  return G.__composition_dragVisualOffset ?? null;
}

function sameIdSet(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): boolean {
  if (left === right) return true;
  if (left.size !== right.size) return false;
  for (const id of left) {
    if (!right.has(id)) return false;
  }
  return true;
}

export function getSiblingOffset(
  elementId: string,
): { dx: number; dy: number } | undefined {
  return G.__composition_dragSiblingOffsets?.get(elementId);
}

/**
 * 드래그 중인 요소(들)의 시각적 오프셋을 설정한다.
 * Store는 변경하지 않고, 렌더링 시점에만 canvas.translate로 적용.
 *
 * ADR-178: 다중 선택 드래그는 정규화된 대상 집합(ReadonlySet)을 넘긴다 —
 * 세션 동안 같은 Set 참조를 재사용할 것 (동등성 비교가 참조 우선). 단일
 * 대상은 string 그대로 받는다 (기존 호출/테스트 호환).
 *
 * @param skipInvalidation true면 notifyLayoutChange() 호출 스킵 (drop 시 store 갱신이 별도로 트리거)
 */
export function setDragVisualOffset(
  target: ReadonlySet<string> | string | null,
  dx = 0,
  dy = 0,
  skipInvalidation = false,
): void {
  const prev = _get();
  const elementIds =
    target === null
      ? null
      : typeof target === "string"
        ? new Set([target])
        : target;
  G.__composition_dragVisualOffset =
    elementIds !== null && elementIds.size > 0 ? { elementIds, dx, dy } : null;

  if (skipInvalidation) return;

  const next = G.__composition_dragVisualOffset;
  const changed =
    (prev === null) !== (next === null) ||
    (prev &&
      next &&
      (prev.dx !== next.dx ||
        prev.dy !== next.dy ||
        !sameIdSet(prev.elementIds, next.elementIds)));
  if (changed) {
    notifyLayoutChange();
  }
}

/**
 * 드래그 중 형제 요소들의 시각적 오프셋을 설정한다.
 * Pencil deferred-drop 패턴: vacate(빈 자리 채움) + insertion(공간 열기).
 *
 * @param offsets elementId → {dx, dy} 맵. null이면 모든 형제 오프셋 제거.
 */
export function setDragSiblingOffsets(
  offsets: Map<string, { dx: number; dy: number }> | null,
): void {
  G.__composition_dragSiblingOffsets = offsets;
  notifyLayoutChange();
}

/** 현재 드래그 시각적 오프셋 반환 */
export function getDragVisualOffset() {
  return _get();
}
