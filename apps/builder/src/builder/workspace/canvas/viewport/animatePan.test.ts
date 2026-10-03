import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useViewportSyncStore } from "../stores";
import {
  animatePanTo,
  cancelPanAnimation,
  PAN_ANIMATION_DURATION_MS,
} from "./animatePan";
import {
  getViewportController,
  resetViewportController,
} from "./ViewportController";
import { resetViewportInteractionSession } from "./ViewportInteractionSession";
import { beginViewportInteraction } from "./viewportActions";

/** rAF queue driven by hand, with `performance.now()` advanced per frame. */
let now = 0;
let frames: FrameRequestCallback[] = [];
const step = (ms: number) => {
  now += ms;
  const run = frames;
  frames = [];
  for (const callback of run) callback(now);
};

beforeEach(() => {
  now = 0;
  frames = [];
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frames = [];
  });
});

afterEach(() => {
  cancelPanAnimation();
  resetViewportInteractionSession();
  resetViewportController();
  useViewportSyncStore.getState().reset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("animatePanTo (Pages tree select — the old panToPage glide)", () => {
  it("moves the camera over 300 ms with ease-out, keeping the zoom", () => {
    getViewportController().setPosition(0, 0, 0.5);
    animatePanTo(400, -200);

    // Nothing jumps on the call itself.
    expect(getViewportController().getState()).toEqual({
      x: 0,
      y: 0,
      scale: 0.5,
    });

    const seen: number[] = [];
    for (let t = 0; t < PAN_ANIMATION_DURATION_MS; t += 50) {
      step(50);
      // The session applies the queued pan on its own frame.
      step(0);
      seen.push(getViewportController().getState().x);
    }
    step(50);
    step(0);

    expect(getViewportController().getState()).toEqual({
      x: 400,
      y: -200,
      scale: 0.5,
    });
    // In between: strictly increasing and never past the target; ease-out = big first step.
    expect(seen[0]).toBeGreaterThan(0);
    expect(seen[0]).toBeLessThan(400);
    for (let i = 1; i < seen.length; i++)
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    expect(seen[0]).toBeGreaterThan(400 - seen[seen.length - 1]);
  });

  it("stops where it is when another viewport interaction starts", () => {
    getViewportController().setPosition(0, 0, 1);
    animatePanTo(300, 0);
    step(50);
    step(0);
    const atInterrupt = getViewportController().getState().x;
    expect(atInterrupt).toBeGreaterThan(0);

    const wheel = beginViewportInteraction("wheel-pan");
    for (let i = 0; i < 10; i++) step(50);
    wheel.finish("idle");

    expect(getViewportController().getState().x).toBe(atInterrupt);
  });
});
