// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasGestureSession } from "../interaction/canvasGestureSession";
import {
  getPagePositionPresentationSnapshot,
  resetPagePositionPresentation,
} from "../interaction/pagePositionPresentation";
import { usePageDrag } from "./usePageDrag";

const { getStateMock, subscribeMock, updatePagePositionMock } = vi.hoisted(
  () => ({
    getStateMock: vi.fn(),
    subscribeMock: vi.fn(),
    updatePagePositionMock: vi.fn(),
  }),
);

vi.mock("../../../stores", () => ({
  useStore: {
    getState: getStateMock,
    subscribe: subscribeMock,
  },
}));

function createPointerEvent(
  type: string,
  pointerId: number,
  clientX = 0,
  clientY = 0,
): Event {
  const event = new Event(type);
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: pointerId },
  });
  return event;
}

describe("usePageDrag", () => {
  let session: CanvasGestureSession;
  let rafCallback: FrameRequestCallback | null;
  let rafId = 0;

  beforeEach(() => {
    session = new CanvasGestureSession();
    getStateMock.mockReturnValue({
      activeBreakpoint: "desktop",
      pagePositions: {
        "page-1": { x: 100, y: 200 },
      },
      snapToGrid: false,
      gridSize: 8,
      updatePagePosition: updatePagePositionMock,
    });
    subscribeMock.mockImplementation(() => () => {});
    updatePagePositionMock.mockReset();
    rafCallback = null;
    rafId = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      rafCallback = callback;
      rafId += 1;
      return rafId;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      rafCallback = null;
    });
  });

  afterEach(() => {
    cleanup();
    resetPagePositionPresentation();
    vi.unstubAllGlobals();
  });

  it("pointercancel은 pending RAF와 page owner를 함께 정리하고 canonical write를 하지 않는다", () => {
    session.tryClaimPage(1, "page-1", "desktop");
    const { result } = renderHook(() => usePageDrag(1, session));

    act(() => {
      result.current.startDrag("page-1", 1, 10, 20);
      window.dispatchEvent(createPointerEvent("pointermove", 1, 30, 50));
      window.dispatchEvent(createPointerEvent("pointercancel", 1, 30, 50));
    });

    expect(rafCallback).toBeNull();
    expect(updatePagePositionMock).not.toHaveBeenCalled();
    expect(session.ownerFor(1)).toBe("idle");
    expect(getPagePositionPresentationSnapshot().isActive).toBe(false);
  });

  it("Escape는 page owner를 취소하고 다음 pointer가 다시 claim할 수 있게 한다", () => {
    session.tryClaimPage(1, "page-1", "desktop");
    const { result } = renderHook(() => usePageDrag(1, session));

    act(() => {
      result.current.startDrag("page-1", 1, 10, 20);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(session.ownerFor(1)).toBe("idle");
    expect(getPagePositionPresentationSnapshot().isActive).toBe(false);
    expect(session.tryClaimPage(2, "page-1", "desktop")).toBe(true);
  });

  it("unmount는 active page owner를 cancel 경로로 해제한다", () => {
    session.tryClaimPage(1, "page-1", "desktop");
    const { result, unmount } = renderHook(() => usePageDrag(1, session));

    act(() => {
      result.current.startDrag("page-1", 1, 10, 20);
    });
    unmount();

    expect(session.ownerFor(1)).toBe("idle");
    expect(updatePagePositionMock).not.toHaveBeenCalled();
    expect(getPagePositionPresentationSnapshot().isActive).toBe(false);
  });

  it("pointerup은 pending RAF를 취소하고 canonical writer를 한 번만 호출한다", () => {
    session.tryClaimPage(1, "page-1", "desktop");
    const { result } = renderHook(() => usePageDrag(1, session));

    act(() => {
      result.current.startDrag("page-1", 1, 10, 20);
      window.dispatchEvent(createPointerEvent("pointermove", 1, 25, 35));
      window.dispatchEvent(createPointerEvent("pointerup", 1, 30, 40));
    });

    expect(rafCallback).toBeNull();
    expect(updatePagePositionMock).toHaveBeenCalledTimes(1);
    expect(updatePagePositionMock).toHaveBeenCalledWith("page-1", 120, 220);
    expect(session.ownerFor(1)).toBe("idle");
    expect(getPagePositionPresentationSnapshot().isActive).toBe(false);
  });

  it("raw pointer move는 latest position 하나만 한 RAF에서 presentation에 publish한다", () => {
    session.tryClaimPage(1, "page-1", "desktop");
    const { result } = renderHook(() => usePageDrag(1, session));

    act(() => {
      result.current.startDrag("page-1", 1, 10, 20);
      for (let index = 0; index < 100; index += 1) {
        window.dispatchEvent(
          createPointerEvent("pointermove", 1, 10 + index, 20 + index),
        );
      }
    });

    expect(rafId).toBe(1);
    expect(updatePagePositionMock).not.toHaveBeenCalled();

    act(() => {
      rafCallback?.(0);
    });

    expect(getPagePositionPresentationSnapshot().activeOverride).toEqual({
      x: 199,
      y: 299,
    });
    expect(updatePagePositionMock).not.toHaveBeenCalled();
  });

  it("breakpoint이 바뀐 pointerup은 stale canonical commit을 생략한다", () => {
    session.tryClaimPage(1, "page-1", "desktop");
    const { result } = renderHook(() => usePageDrag(1, session));

    act(() => {
      result.current.startDrag("page-1", 1, 10, 20);
      getStateMock.mockReturnValue({
        activeBreakpoint: "mobile",
        pagePositions: {
          "page-1": { x: 100, y: 200 },
        },
        snapToGrid: false,
        gridSize: 8,
        updatePagePosition: updatePagePositionMock,
      });
      window.dispatchEvent(createPointerEvent("pointerup", 1, 30, 40));
    });

    expect(updatePagePositionMock).not.toHaveBeenCalled();
    expect(session.ownerFor(1)).toBe("idle");
  });

  it("외부 canonical positions reference 교체는 active page drag를 cancel한다", () => {
    let listener: ((state: unknown) => void) | null = null;
    subscribeMock.mockImplementation((nextListener) => {
      listener = nextListener;
      return () => {
        listener = null;
      };
    });

    session.tryClaimPage(1, "page-1", "desktop");
    const { result } = renderHook(() => usePageDrag(1, session));

    act(() => {
      result.current.startDrag("page-1", 1, 10, 20);
      window.dispatchEvent(createPointerEvent("pointermove", 1, 30, 40));
      listener?.({
        activeBreakpoint: "desktop",
        pagePositions: { "page-1": { x: 100, y: 200 } },
      });
    });

    expect(updatePagePositionMock).not.toHaveBeenCalled();
    expect(session.ownerFor(1)).toBe("idle");
    expect(getPagePositionPresentationSnapshot().isActive).toBe(false);
  });
});
