import { describe, expect, it, vi } from "vitest";
import {
  createFrameScheduler,
  requestCanvasFrame,
  subscribeCanvasFrames,
} from "./frameScheduler";

function fixture(render = vi.fn()) {
  let id = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  const scheduler = createFrameScheduler(
    render,
    (cb) => {
      callbacks.set(++id, cb);
      return id;
    },
    (id) => {
      callbacks.delete(id);
    },
  );
  const tick = () => {
    const batch = [...callbacks.values()];
    callbacks.clear();
    for (const cb of batch) cb(0);
  };
  return { scheduler, callbacks, tick, render };
}
describe("event-driven frame scheduler", () => {
  it("coalesces a burst and stops after the frame", () => {
    const f = fixture();
    for (let i = 0; i < 100; i++) f.scheduler.invalidate();
    expect(f.callbacks.size).toBe(1);
    f.tick();
    expect(f.render).toHaveBeenCalledTimes(1);
    expect(f.callbacks.size).toBe(0);
  });
  it("preserves invalidation during render as one subsequent frame", () => {
    let first = true;
    const f = fixture(
      vi.fn(() => {
        if (first) {
          first = false;
          f.scheduler.invalidate();
          f.scheduler.invalidate();
        }
      }),
    );
    f.scheduler.invalidate();
    f.tick();
    expect(f.callbacks.size).toBe(1);
    f.tick();
    expect(f.render).toHaveBeenCalledTimes(2);
    expect(f.callbacks.size).toBe(0);
  });
  it("retains dirty work across hidden/context loss without rendering", () => {
    const f = fixture();
    f.scheduler.invalidate();
    f.scheduler.setPaused(true);
    f.scheduler.invalidate();
    f.tick();
    expect(f.render).not.toHaveBeenCalled();
    f.scheduler.setPaused(false);
    f.tick();
    expect(f.render).toHaveBeenCalledTimes(1);
  });
  it("unsubscribes wake producers and cancels pending work on disposal", () => {
    const f = fixture();
    const unsubscribe = subscribeCanvasFrames(f.scheduler.invalidate);
    requestCanvasFrame();
    expect(f.callbacks.size).toBe(1);
    unsubscribe();
    f.scheduler.dispose();
    requestCanvasFrame();
    f.tick();
    expect(f.render).not.toHaveBeenCalled();
    expect(f.callbacks.size).toBe(0);
  });
});
