import { requestCanvasFrame } from "./frameScheduler";
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
  __composition_dragVisualOffsetRevision?: number;
  __composition_dragSiblingOffsets?: Map<
    string,
    { dx: number; dy: number }
  > | null;
  __composition_dragSiblingOffsetRevision?: number;
  __composition_dragPresentationRetained?: boolean;
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

/** registry와 분리된 sibling presentation 세대. SkiaCanvas가 content snapshot만 갱신한다. */
export function getDragSiblingOffsetRevision(): number {
  return G.__composition_dragSiblingOffsetRevision ?? 0;
}

/** registry와 분리된 drag offset presentation 세대. SkiaCanvas가 overlay frame만 갱신한다. */
export function getDragVisualOffsetRevision(): number {
  return G.__composition_dragVisualOffsetRevision ?? 0;
}

function bumpDragVisualOffsetRevision(): void {
  G.__composition_dragVisualOffsetRevision = getDragVisualOffsetRevision() + 1;
  requestCanvasFrame();
}

/** command tail 분리가 성립하지 않을 때 delta별 legacy invalidation으로 폴백한다. */
export function setDragPresentationRetained(retained: boolean): void {
  G.__composition_dragPresentationRetained = retained;
}

/**
 * 드래그 중인 요소(들)의 시각적 오프셋을 설정한다.
 * Store는 변경하지 않고, 렌더링 시점에만 canvas.translate로 적용.
 *
 * ADR-178: 다중 선택 드래그는 정규화된 대상 집합(ReadonlySet)을 넘긴다 —
 * 세션 동안 같은 Set 참조를 재사용할 것 (동등성 비교가 참조 우선). 단일
 * 대상은 string 그대로 받는다 (기존 호출/테스트 호환).
 *
 * target 집합 변경은 command stream의 top-layer 구성을 바꾸므로 항상
 * notifyLayoutChange() 한다. 같은 target의 dx/dy 변경은 render-time
 * presentation 값만 바꾸며, SkiaCanvas의 drag overlay frame이 소비한다.
 *
 * @param skipInvalidation 하위 호환 인자. target topology 변경은 이 값과 무관하게 invalidate한다.
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

  const next = G.__composition_dragVisualOffset;
  const targetChanged =
    (prev === null) !== (next === null) ||
    (prev && next && !sameIdSet(prev.elementIds, next.elementIds));
  if (targetChanged) {
    bumpDragVisualOffsetRevision();
    // 정상 command stream은 drag root를 tail로 유예하므로 optimistic true.
    // frame build가 불변식 실패를 발견하면 false로 내려 legacy invalidation한다.
    G.__composition_dragPresentationRetained = next !== null;
    notifyLayoutChange();
    return;
  }

  // 같은 drag target의 위치 변화는 retained subtree picture의 translate만
  // 갱신한다. registryVersion을 올리면 command stream/content surface 전체를
  // 매 pointermove마다 다시 기록하게 된다.
  const offsetChanged =
    prev !== null &&
    next !== null &&
    (prev.dx !== next.dx || prev.dy !== next.dy);
  if (offsetChanged) {
    bumpDragVisualOffsetRevision();
  }
  if (
    offsetChanged &&
    !skipInvalidation &&
    G.__composition_dragPresentationRetained === false
  ) {
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
  const current = G.__composition_dragSiblingOffsets ?? null;
  if (offsets === null) {
    if (current === null) return;
    G.__composition_dragSiblingOffsets = null;
    G.__composition_dragSiblingOffsetRevision =
      getDragSiblingOffsetRevision() + 1;
    requestCanvasFrame();
    return;
  }

  let changed = current === null || current.size !== offsets.size;
  if (!changed && current) {
    for (const [elementId, next] of offsets) {
      const prev = current.get(elementId);
      if (!prev || prev.dx !== next.dx || prev.dy !== next.dy) {
        changed = true;
        break;
      }
    }
  }
  if (!changed) return;

  // dragAnimator가 같은 Map을 매 RAF clear/reuse하므로 caller Map을 보관하지
  // 않는다. 전역 snapshot Map 자체는 재사용해 hot-path 할당을 제한한다.
  const snapshot = current ?? new Map<string, { dx: number; dy: number }>();
  snapshot.clear();
  for (const [elementId, offset] of offsets) {
    snapshot.set(elementId, { dx: offset.dx, dy: offset.dy });
  }
  G.__composition_dragSiblingOffsets = snapshot;
  G.__composition_dragSiblingOffsetRevision =
    getDragSiblingOffsetRevision() + 1;
  requestCanvasFrame();
}

/** 현재 드래그 시각적 오프셋 반환 */
export function getDragVisualOffset() {
  return _get();
}
