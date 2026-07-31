import { describe, expect, it, vi } from "vitest";
import {
  CanvasGestureSession,
  resolveCanvasGestureMode,
} from "./canvasGestureSession";

describe("resolveCanvasGestureMode", () => {
  it("Space를 누른 primary pointer는 요소 조작 대신 pan을 선택한다", () => {
    expect(resolveCanvasGestureMode({ button: 0, isSpacePressed: true })).toBe(
      "pan",
    );
  });

  it("Space 없이 시작한 primary pointer는 요소 조작을 유지한다", () => {
    expect(resolveCanvasGestureMode({ button: 0, isSpacePressed: false })).toBe(
      "element",
    );
  });
});

describe("CanvasGestureSession", () => {
  it("Space만 누른 시점부터 hover를 즉시 차단하고 상태 변화를 알린다", () => {
    const session = new CanvasGestureSession();
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);

    expect(session.shouldSuppressElementHover()).toBe(false);

    session.setSpacePressed(true);

    expect(session.shouldSuppressElementHover()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    session.setSpacePressed(false);

    expect(session.shouldSuppressElementHover()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("pan으로 시작한 pointer session 동안 요소 상호작용을 차단한다", () => {
    const session = new CanvasGestureSession();
    session.setSpacePressed(true);

    expect(session.beginPointer(7, 0)).toBe("pan");
    expect(session.shouldSuppressElementInteraction(7)).toBe(true);

    session.setSpacePressed(false);
    expect(session.shouldSuppressElementInteraction(7)).toBe(true);
    expect(session.shouldSuppressElementHover()).toBe(true);

    session.endPointer(7);
    expect(session.shouldSuppressElementInteraction(7)).toBe(false);
    expect(session.shouldSuppressElementHover()).toBe(false);
  });
});
