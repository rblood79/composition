import { requestCanvasFrame } from "./frameScheduler";
/**
 * CSS Transition 렌더 루프 통합 (Pull 모델).
 *
 * StoreRenderBridge에서 스타일 변경 감지 → start() 호출.
 * SkiaRenderer.renderFrame()에서 tick() 호출 → dirty nodeIds 반환.
 */
import { parseEasing } from "./transitionEngine";

interface ActiveTransition {
  property: string;
  startValue: number;
  endValue: number;
  startTime: number;
  duration: number;
  easing: (t: number) => number;
  done: boolean;
}

export class TransitionManager {
  private transitions = new Map<string, ActiveTransition[]>(); // elementId → transitions

  /**
   * 새 transition 시작.
   * 동일 element+property의 기존 transition은 현재 보간값에서 대체.
   */
  start(
    elementId: string,
    property: string,
    startValue: number,
    endValue: number,
    duration: number,
    easing: string,
  ): void {
    const list = this.transitions.get(elementId) ?? [];
    const filtered = list.filter((t) => t.property !== property);
    filtered.push({
      property,
      startValue,
      endValue,
      startTime: performance.now(),
      duration,
      easing: parseEasing(easing),
      done: false,
    });
    this.transitions.set(elementId, filtered);
    requestCanvasFrame();
  }

  /**
   * 매 프레임 호출. dirty elementId Set 반환.
   */
  tick(now: number): Set<string> {
    const dirty = new Set<string>();
    for (const [elementId, list] of this.transitions) {
      let hasActive = false;
      for (const t of list) {
        if (t.done) continue;
        const elapsed = now - t.startTime;
        if (elapsed >= t.duration) {
          t.done = true;
        }
        hasActive = true;
        dirty.add(elementId);
      }
      if (!hasActive) {
        this.transitions.delete(elementId);
      }
    }
    return dirty;
  }

  /** element+property의 현재 보간값 */
  getCurrentValue(elementId: string, property: string): number | undefined {
    const list = this.transitions.get(elementId);
    if (!list) return undefined;
    const t = list.find((tr) => tr.property === property);
    if (!t) return undefined;
    const elapsed = performance.now() - t.startTime;
    const progress = Math.min(1, Math.max(0, elapsed / t.duration));
    const eased = t.easing(progress);
    return t.startValue + (t.endValue - t.startValue) * eased;
  }

  /** 요소 삭제 시 정리 */
  remove(elementId: string): void {
    this.transitions.delete(elementId);
  }

  isActive(): boolean {
    return this.transitions.size > 0;
  }

  clear(): void {
    this.transitions.clear();
    requestCanvasFrame();
  }
}
