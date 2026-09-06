import { describe, expect, it, vi } from "vitest";
import { createFrameScheduler, subscribeCanvasFrames } from "./frameScheduler";
import { AnimationEngine } from "./animationEngine";
import { TransitionManager } from "./transitionManager";
import {
  updateAnimationTargets,
  tickAnimations,
  getInterpolatedOffsets,
  clearAllAnimations,
} from "./dragAnimator";
import { setDragVisualOffset, setDragSiblingOffsets } from "./nodeRendererTree";
import { notifyLayoutChange } from "./useSkiaNode";

describe("presentation wake producers", () => {
  it("wakes once for a layout and drag burst, then releases the subscription", () => {
    const queue = new Map<number, FrameRequestCallback>();
    let id = 0;
    const render = vi.fn();
    const scheduler = createFrameScheduler(
      render,
      (cb) => {
        queue.set(++id, cb);
        return id;
      },
      (id) => {
        queue.delete(id);
      },
    );
    const unsubscribe = subscribeCanvasFrames(scheduler.invalidate);
    notifyLayoutChange();
    setDragVisualOffset("wake-node", 10, 20);
    setDragSiblingOffsets(new Map([["sibling", { dx: 3, dy: 0 }]]));
    expect(queue.size).toBe(1);
    for (const cb of queue.values()) cb(0);
    queue.clear();
    expect(render).toHaveBeenCalledTimes(1);
    unsubscribe();
    scheduler.dispose();
    setDragVisualOffset(null, 0, 0, true);
    setDragSiblingOffsets(null);
    expect(queue.size).toBe(0);
  });
  it("finishes a spring, presents its final value and can return to zero", () => {
    clearAllAnimations();
    updateAnimationTargets(new Map([["sibling", { dx: 20, dy: 0 }]]));
    let active = true;
    let frames = 0;
    while (active && frames++ < 100) active = tickAnimations();
    expect(active).toBe(false);
    expect(getInterpolatedOffsets().get("sibling")?.dx).toBe(20);
    updateAnimationTargets(null);
    active = true;
    frames = 0;
    while (active && frames++ < 100) active = tickAnimations();
    expect(active).toBe(false);
    expect(getInterpolatedOffsets().size).toBe(0);
    clearAllAnimations();
  });
  it("retains a forwards final value without requesting endless animation frames", () => {
    const engine = new AnimationEngine();
    engine.start("node", "fade", {
      keyframes: [
        { offset: 0, props: { opacity: 0 } },
        { offset: 1, props: { opacity: 1 } },
      ],
      duration: 100,
      delay: 0,
      easing: "linear",
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
    });
    expect(engine.isActive()).toBe(true);
    expect(engine.tick(performance.now() + 200).has("node")).toBe(true);
    expect(engine.isActive()).toBe(false);
    expect(engine.getCurrentValue("node", "opacity")).toBe(1);
  });
  it("wakes for a transition and stops once the endpoint is consumed", () => {
    const wake = vi.fn();
    const unsubscribe = subscribeCanvasFrames(wake);
    const manager = new TransitionManager();
    manager.start("node", "opacity", 0, 1, 100, "linear");
    expect(wake).toHaveBeenCalledTimes(1);
    expect(manager.isActive()).toBe(true);
    manager.tick(performance.now() + 200);
    expect(manager.isActive()).toBe(true);
    manager.tick(performance.now() + 201);
    expect(manager.isActive()).toBe(false);
    unsubscribe();
  });
});
