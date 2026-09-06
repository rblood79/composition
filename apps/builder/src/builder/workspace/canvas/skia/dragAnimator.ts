import { requestCanvasFrame } from "./frameScheduler";
/**
 * Drag Animator — Spring Interpolation for Sibling Offsets
 *
 * Pencil 패턴: 드래그 중 형제 요소가 ~120ms에 걸쳐 부드럽게 이동
 * SelectionLayer가 목표 오프셋을 설정하면, RAF 루프에서 매 프레임 보간.
 */

interface AnimatedOffset {
  targetDx: number;
  targetDy: number;
  currentDx: number;
  currentDy: number;
}

const LERP_FACTOR = 0.15; // 프레임당 15% 접근 → ~8프레임(~133ms @60Hz)
const SNAP_THRESHOLD = 0.5; // 0.5px 이하면 즉시 snap

const animatedOffsets = new Map<string, AnimatedOffset>();

/**
 * 목표 오프셋 갱신 (SelectionLayer의 onDragUpdate에서 호출)
 * computeSiblingOffsets() 결과를 target으로 설정.
 * null이면 모든 target을 0으로 설정 (드래그 종료 방향).
 */
export function updateAnimationTargets(
  targets: Map<string, { dx: number; dy: number }> | null,
): void {
  requestCanvasFrame();
  if (!targets) {
    // 모든 기존 오프셋의 target을 0으로 → lerp로 돌아감
    for (const [, offset] of animatedOffsets) {
      offset.targetDx = 0;
      offset.targetDy = 0;
    }
    return;
  }

  // 기존 항목 중 새 target에 없는 것은 target을 0으로
  for (const [id, offset] of animatedOffsets) {
    if (!targets.has(id)) {
      offset.targetDx = 0;
      offset.targetDy = 0;
    }
  }

  // 새 target 설정
  for (const [id, target] of targets) {
    const existing = animatedOffsets.get(id);
    if (existing) {
      existing.targetDx = target.dx;
      existing.targetDy = target.dy;
    } else {
      animatedOffsets.set(id, {
        targetDx: target.dx,
        targetDy: target.dy,
        currentDx: 0,
        currentDy: 0,
      });
    }
  }
}

/**
 * 매 프레임 보간 (SkiaOverlay RAF에서 호출)
 * current를 target 방향으로 LERP_FACTOR만큼 이동.
 * @returns true: 아직 애니메이션 진행 중 (다음 프레임에서 다시 호출 필요)
 */
export function tickAnimations(): boolean {
  let stillAnimating = false;
  const toRemove: string[] = [];

  for (const [id, offset] of animatedOffsets) {
    const diffX = offset.targetDx - offset.currentDx;
    const diffY = offset.targetDy - offset.currentDy;

    if (Math.abs(diffX) < SNAP_THRESHOLD && Math.abs(diffY) < SNAP_THRESHOLD) {
      offset.currentDx = offset.targetDx;
      offset.currentDy = offset.targetDy;
      // target이 0이고 current도 0이면 제거 가능
      if (offset.targetDx === 0 && offset.targetDy === 0) {
        toRemove.push(id);
      }
    } else {
      offset.currentDx += diffX * LERP_FACTOR;
      offset.currentDy += diffY * LERP_FACTOR;
      stillAnimating = true;
    }
  }

  for (const id of toRemove) {
    animatedOffsets.delete(id);
  }

  return stillAnimating;
}

// 매 프레임 new Map() 할당 방지 — 모듈 레벨 재사용
const _interpolatedCache = new Map<string, { dx: number; dy: number }>();

/**
 * 현재 보간된 오프셋 Map 반환 (setDragSiblingOffsets에 전달용)
 * 반환된 Map은 다음 호출 시 clear됨 — 호출자가 캐싱하지 말 것.
 */
export function getInterpolatedOffsets(): Map<
  string,
  { dx: number; dy: number }
> {
  _interpolatedCache.clear();
  for (const [id, offset] of animatedOffsets) {
    if (offset.currentDx !== 0 || offset.currentDy !== 0) {
      _interpolatedCache.set(id, {
        dx: offset.currentDx,
        dy: offset.currentDy,
      });
    }
  }
  return _interpolatedCache;
}

/**
 * 모든 애니메이션 즉시 제거 (드래그 종료/취소 시)
 */
export function clearAllAnimations(): void {
  animatedOffsets.clear();
  requestCanvasFrame();
}
