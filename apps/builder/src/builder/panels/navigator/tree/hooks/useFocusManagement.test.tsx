import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFocusManagement } from "./useFocusManagement";

describe("useFocusManagement", () => {
  const frameCallbacks = new Map<number, FrameRequestCallback>();
  let nextFrameId = 1;

  beforeEach(() => {
    frameCallbacks.clear();
    nextFrameId = 1;
    vi.stubGlobal(
      "requestAnimationFrame",
      (callback: FrameRequestCallback): number => {
        const frameId = nextFrameId++;
        frameCallbacks.set(frameId, callback);
        return frameId;
      },
    );
    vi.stubGlobal("cancelAnimationFrame", (frameId: number) => {
      frameCallbacks.delete(frameId);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function flushNextFrame(): void {
    const entry = frameCallbacks.entries().next().value as
      [number, FrameRequestCallback] | undefined;
    expect(entry).toBeDefined();
    const [frameId, callback] = entry!;
    frameCallbacks.delete(frameId);
    callback(performance.now());
  }

  it("재부모화가 반영된 다음 프레임에 같은 이동 키도 다시 포커스한다", async () => {
    const { result } = renderHook(() =>
      useFocusManagement({
        deferMoveFocusUntilLayout: true,
        nodeMap: new Map([
          ["moved", { parentId: "container" }],
          ["container", { parentId: null }],
        ]),
      }),
    );

    act(() => result.current.handleAfterMove(new Set(["moved"])));
    await act(async () => Promise.resolve());

    expect(result.current.focusedKey).toBeNull();
    act(flushNextFrame);
    expect(result.current.focusedKey).toBe("moved");

    act(() => result.current.handleAfterMove(new Set(["moved"])));
    expect(result.current.focusedKey).toBeNull();
    act(flushNextFrame);
    expect(result.current.focusedKey).toBe("moved");
  });

  it("opt-in하지 않은 Tree는 기존 microtask 포커스 시점을 유지한다", async () => {
    const { result } = renderHook(() =>
      useFocusManagement({
        nodeMap: new Map([["moved", { parentId: "container" }]]),
      }),
    );

    act(() => result.current.handleAfterMove(new Set(["moved"])));
    await act(async () => Promise.resolve());

    expect(result.current.focusedKey).toBe("moved");
    expect(frameCallbacks.size).toBe(0);
  });

  it("같은 frame 전의 이전 포커스 요청을 취소한다", () => {
    const { result } = renderHook(() =>
      useFocusManagement({
        deferMoveFocusUntilLayout: true,
        nodeMap: new Map([
          ["first", { parentId: "container" }],
          ["second", { parentId: "container" }],
        ]),
      }),
    );

    act(() => result.current.handleAfterMove(new Set(["first"])));
    act(() => result.current.handleAfterMove(new Set(["second"])));

    expect(frameCallbacks.size).toBe(1);
    act(flushNextFrame);
    expect(result.current.focusedKey).toBe("second");
  });

  it("unmount 때 pending 포커스 frame을 취소한다", () => {
    const { result, unmount } = renderHook(() =>
      useFocusManagement({
        deferMoveFocusUntilLayout: true,
        nodeMap: new Map([["moved", { parentId: "container" }]]),
      }),
    );

    act(() => result.current.handleAfterMove(new Set(["moved"])));
    expect(frameCallbacks.size).toBe(1);

    unmount();
    expect(frameCallbacks.size).toBe(0);
  });
});
