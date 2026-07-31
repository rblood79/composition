import { describe, expect, it, vi } from "vitest";
import { ViewportController, type ViewportState } from "./ViewportController";
import {
  ViewportInteractionSession,
  type ViewportFrameScheduler,
} from "./ViewportInteractionSession";

function createFrameScheduler(): ViewportFrameScheduler & {
  flush(): void;
  pendingCount(): number;
} {
  let nextId = 0;
  const callbacks = new Map<number, FrameRequestCallback>();

  return {
    request(callback) {
      nextId += 1;
      callbacks.set(nextId, callback);
      return nextId;
    },
    cancel(id) {
      callbacks.delete(id);
    },
    flush() {
      const pending = [...callbacks.values()];
      callbacks.clear();
      for (const callback of pending) {
        callback(0);
      }
    },
    pendingCount() {
      return callbacks.size;
    },
  };
}

function createSession(initial: ViewportState = { x: 0, y: 0, scale: 1 }) {
  const controller = new ViewportController();
  controller.setPosition(initial.x, initial.y, initial.scale);
  const scheduler = createFrameScheduler();
  let mirror = initial;
  const commitMirror = vi.fn((next: ViewportState) => {
    mirror = next;
  });
  const session = new ViewportInteractionSession({
    controller,
    scheduler,
    readMirror: () => mirror,
    commitMirror,
  });

  return { commitMirror, controller, scheduler, session };
}

describe("ViewportInteractionSession", () => {
  it("coalesces raw pan input into one listener dispatch and one final mirror commit", () => {
    const { commitMirror, controller, scheduler, session } = createSession();
    const listener = vi.fn();
    controller.addUpdateListener(listener);

    session.begin("wheel-pan");
    session.queuePan({ x: 2, y: 3 });
    session.queuePan({ x: 5, y: -1 });
    session.queuePan({ x: -4, y: 7 });

    expect(listener).not.toHaveBeenCalled();
    expect(scheduler.pendingCount()).toBe(1);

    scheduler.flush();

    expect(controller.getState()).toEqual({ x: 3, y: 9, scale: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(commitMirror).not.toHaveBeenCalled();

    session.finish("idle");

    expect(commitMirror).toHaveBeenCalledTimes(1);
    expect(commitMirror).toHaveBeenLastCalledWith({ x: 3, y: 9, scale: 1 });
  });

  it("preserves pan and zoom arrival order for a moving anchor", () => {
    const { controller, scheduler, session } = createSession();

    session.begin("wheel-zoom");
    session.queuePan({ x: 10, y: 0 });
    session.queueZoomAt({ delta: 1, anchor: { x: 100, y: 0 } });
    scheduler.flush();

    expect(controller.getState()).toEqual({ x: -80, y: 0, scale: 2 });
  });

  it("flushes pending work once and skips an equal mirror during finish", () => {
    const { commitMirror, controller, scheduler, session } = createSession();

    session.begin("wheel-pan");
    session.queuePan({ x: 12, y: 0 });

    session.finish("interrupted");

    expect(scheduler.pendingCount()).toBe(0);
    expect(controller.getState()).toEqual({ x: 12, y: 0, scale: 1 });
    expect(commitMirror).toHaveBeenCalledTimes(1);

    session.finish("interrupted");

    expect(commitMirror).toHaveBeenCalledTimes(1);
  });

  it("reports one transient apply per scheduled frame", () => {
    const controller = new ViewportController();
    const scheduler = createFrameScheduler();
    const onControllerApply = vi.fn();
    const onFrame = vi.fn();
    const session = new ViewportInteractionSession({
      controller,
      scheduler,
      commitMirror: vi.fn(),
      onControllerApply,
      onFrame,
      readMirror: () => ({ x: 0, y: 0, scale: 1 }),
    });

    session.begin("wheel-pan");
    session.queuePan({ x: 2, y: 0 });
    session.queuePan({ x: 3, y: 0 });
    scheduler.flush();

    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(onControllerApply).toHaveBeenCalledTimes(1);
    expect(onControllerApply).toHaveBeenLastCalledWith({
      x: 5,
      y: 0,
      scale: 1,
    });
  });

  it("commits an interrupted session before applying an external command", () => {
    const { commitMirror, controller, session } = createSession();

    session.begin("wheel-pan");
    session.queuePan({ x: 20, y: 0 });

    session.runCommand((state) => ({ ...state, scale: 2 }));

    expect(controller.getState()).toEqual({ x: 20, y: 0, scale: 2 });
    expect(commitMirror).toHaveBeenCalledTimes(2);
    expect(commitMirror.mock.calls).toEqual([
      [{ x: 20, y: 0, scale: 1 }],
      [{ x: 20, y: 0, scale: 2 }],
    ]);
  });

  it("does not notify listeners when an external mirror repeats controller state", () => {
    const controller = new ViewportController();
    const listener = vi.fn();
    controller.addUpdateListener(listener);

    controller.setPosition(24, 48, 1.5);
    controller.setPosition(24, 48, 1.5);

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
