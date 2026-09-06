import { requestCanvasFrame } from "./frameScheduler";
/**
 * CSS @keyframes 애니메이션 엔진.
 * 범용 엔진. UI (타임라인 에디터) 없이 API만 제공.
 * Pull 모델: tick(now) → dirty nodeIds.
 */
import { parseEasing } from "./transitionEngine";
import { interpolateProperty } from "./interpolators";

export interface Keyframe {
  offset: number; // 0-1
  props: Record<string, unknown>;
}

export interface KeyframeAnimation {
  keyframes: Keyframe[];
  duration: number; // ms
  delay: number;
  easing: string;
  iterationCount: number; // Infinity 가능
  direction: "normal" | "reverse" | "alternate" | "alternate-reverse";
  fillMode: "none" | "forwards" | "backwards" | "both";
}

interface ActiveAnimation {
  name: string;
  animation: KeyframeAnimation;
  startTime: number;
  easingFn: (t: number) => number;
  currentValues: Record<string, unknown>;
  done: boolean;
}

export class AnimationEngine {
  private animations = new Map<string, ActiveAnimation[]>(); // elementId → list

  start(elementId: string, name: string, animation: KeyframeAnimation): void {
    const list = this.animations.get(elementId) ?? [];
    const filtered = list.filter((a) => a.name !== name);
    filtered.push({
      name,
      animation,
      startTime: performance.now(),
      easingFn: parseEasing(animation.easing),
      currentValues: {},
      done: false,
    });
    this.animations.set(elementId, filtered);
    requestCanvasFrame();
  }

  stop(elementId: string, name?: string): void {
    requestCanvasFrame();
    if (!name) {
      this.animations.delete(elementId);
      return;
    }
    const list = this.animations.get(elementId);
    if (!list) return;
    const filtered = list.filter((a) => a.name !== name);
    if (filtered.length === 0) this.animations.delete(elementId);
    else this.animations.set(elementId, filtered);
  }

  tick(now: number): Set<string> {
    const dirty = new Set<string>();
    for (const [elementId, list] of this.animations) {
      for (const active of list) {
        if (active.done) continue;
        const { animation } = active;
        const elapsed = now - active.startTime - animation.delay;

        if (elapsed < 0) {
          // delay 중
          if (
            animation.fillMode === "backwards" ||
            animation.fillMode === "both"
          ) {
            this.applyKeyframeValues(active, 0);
            dirty.add(elementId);
          }
          continue;
        }

        const { duration, iterationCount, direction } = animation;
        if (duration <= 0) {
          active.done = true;
          continue;
        }

        const rawIteration = elapsed / duration;
        if (rawIteration >= iterationCount) {
          active.done = true;
          if (
            animation.fillMode === "forwards" ||
            animation.fillMode === "both"
          ) {
            const lastIter = Math.floor(iterationCount - 0.001);
            const lastProgress = this.resolveDirection(direction, lastIter, 1);
            this.applyKeyframeValues(active, lastProgress);
            dirty.add(elementId);
          } else {
            active.currentValues = {};
          }
          continue;
        }

        const iterIndex = Math.floor(rawIteration);
        const iterProgress = rawIteration - iterIndex;
        const directed = this.resolveDirection(
          direction,
          iterIndex,
          iterProgress,
        );
        const eased = active.easingFn(directed);
        this.applyKeyframeValues(active, eased);
        dirty.add(elementId);
      }

      // fillMode forwards/both 값 유지하는 done 애니메이션은 남김
      const remaining = list.filter(
        (a) => !a.done || Object.keys(a.currentValues).length > 0,
      );
      if (remaining.length === 0) this.animations.delete(elementId);
      else this.animations.set(elementId, remaining);
    }
    return dirty;
  }

  getCurrentValue(elementId: string, property: string): unknown {
    const list = this.animations.get(elementId);
    if (!list) return undefined;
    for (let i = list.length - 1; i >= 0; i--) {
      const val = list[i].currentValues[property];
      if (val !== undefined) return val;
    }
    return undefined;
  }

  isActive(): boolean {
    for (const animations of this.animations.values()) {
      if (animations.some((animation) => !animation.done)) return true;
    }
    return false;
  }

  clear(): void {
    this.animations.clear();
    requestCanvasFrame();
  }

  private resolveDirection(
    direction: KeyframeAnimation["direction"],
    iterIndex: number,
    progress: number,
  ): number {
    switch (direction) {
      case "reverse":
        return 1 - progress;
      case "alternate":
        return iterIndex % 2 === 0 ? progress : 1 - progress;
      case "alternate-reverse":
        return iterIndex % 2 === 0 ? 1 - progress : progress;
      default:
        return progress;
    }
  }

  private applyKeyframeValues(active: ActiveAnimation, progress: number): void {
    const { keyframes } = active.animation;
    if (keyframes.length === 0) return;

    let prev = keyframes[0];
    let next = keyframes[keyframes.length - 1];
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (
        progress >= keyframes[i].offset &&
        progress <= keyframes[i + 1].offset
      ) {
        prev = keyframes[i];
        next = keyframes[i + 1];
        break;
      }
    }

    const segLen = next.offset - prev.offset;
    const local = segLen > 0 ? (progress - prev.offset) / segLen : 0;

    const allProps = new Set([
      ...Object.keys(prev.props),
      ...Object.keys(next.props),
    ]);
    for (const prop of allProps) {
      const s = prev.props[prop] ?? next.props[prop];
      const e = next.props[prop] ?? prev.props[prop];
      active.currentValues[prop] = interpolateProperty(prop, s, e, local);
    }
  }
}
