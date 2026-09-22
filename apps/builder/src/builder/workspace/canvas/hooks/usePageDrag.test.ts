// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasGestureSession } from "../interaction/canvasGestureSession";
import {
  getPagePositionPresentationSnapshot,
  resetPagePositionPresentation,
} from "../interaction/pagePositionPresentation";
import { usePageDrag } from "./usePageDrag";

const {
  getStateMock,
  subscribeMock,
  updatePagePositionMock,
  commitPointMock,
  commitPointsMock,
} = vi.hoisted(() => ({
  getStateMock: vi.fn(),
  subscribeMock: vi.fn(),
  updatePagePositionMock: vi.fn(),
  // ADR-232 — finish 는 좌표가 아니라 placement 를 쓴다.
  commitPointMock: vi.fn(() => true),
  commitPointsMock: vi.fn(() => true),
}));

vi.mock("../../../stores/utils/pagePlacementCommit", () => ({
  commitPagePlacementFromPoint: commitPointMock,
  commitPagePlacementsFromPoints: commitPointsMock,
}));

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
      derivedPagePositions: {
        "page-1": { x: 100, y: 200 },
      },
      updatePagePosition: updatePagePositionMock,
    });
    subscribeMock.mockImplementation(() => () => {});
    updatePagePositionMock.mockReset();
    commitPointMock.mockReset();
    commitPointMock.mockReturnValue(true);
    commitPointsMock.mockReset();
    commitPointsMock.mockReturnValue(true);
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

    expect(commitPointMock).not.toHaveBeenCalled();
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
    expect(commitPointMock).toHaveBeenCalledTimes(1);
    expect(commitPointMock).toHaveBeenCalledWith("page-1", { x: 120, y: 220 });
    expect(updatePagePositionMock).not.toHaveBeenCalled();
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
    expect(commitPointMock).not.toHaveBeenCalled();

    act(() => {
      rafCallback?.(0);
    });

    expect(
      getPagePositionPresentationSnapshot().activeOverrides?.get("page-1"),
    ).toEqual({
      x: 199,
      y: 299,
    });
    expect(commitPointMock).not.toHaveBeenCalled();
  });

  it("breakpoint이 바뀐 pointerup은 stale canonical commit을 생략한다", () => {
    session.tryClaimPage(1, "page-1", "desktop");
    const { result } = renderHook(() => usePageDrag(1, session));

    act(() => {
      result.current.startDrag("page-1", 1, 10, 20);
      getStateMock.mockReturnValue({
        activeBreakpoint: "mobile",
        derivedPagePositions: {
          "page-1": { x: 100, y: 200 },
        },
        updatePagePosition: updatePagePositionMock,
      });
      window.dispatchEvent(createPointerEvent("pointerup", 1, 30, 40));
    });

    expect(commitPointMock).not.toHaveBeenCalled();
    expect(session.ownerFor(1)).toBe("idle");
  });

  // ADR-232 — 취소 기준은 identity 가 아니라 **값** 이다. 파생 map 은 pan·크기·패널 변화마다
  //   새 객체가 되므로 identity 로 보면 드래그가 조용히 취소된다 (live 실측 09-22).
  it("같은 값의 새 map 은 드래그를 취소하지 않는다", () => {
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
      // 내용은 같고 참조만 다른 map
      listener?.({
        activeBreakpoint: "desktop",
        derivedPagePositions: { "page-1": { x: 100, y: 200 } },
      });
    });

    expect(session.ownerFor(1)).toBe("page");
    expect(getPagePositionPresentationSnapshot().isActive).toBe(true);
  });

  it("드래그 중인 페이지가 밖에서 실제로 움직이면 cancel 한다", () => {
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
        derivedPagePositions: { "page-1": { x: 555, y: 666 } },
      });
    });

    expect(commitPointMock).not.toHaveBeenCalled();
    expect(session.ownerFor(1)).toBe("idle");
    expect(getPagePositionPresentationSnapshot().isActive).toBe(false);
  });
});
