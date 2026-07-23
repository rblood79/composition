// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceCompareSplit } from "./useWorkspaceCompareSplit";

const STORAGE_KEY = "builder.workspace.compare-split.v1";

function createContainerRef(width = 1000) {
  const container = document.createElement("div");
  vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
    bottom: 600,
    height: 600,
    left: 100,
    right: 100 + width,
    toJSON: () => ({}),
    top: 0,
    width,
    x: 100,
    y: 0,
  });

  return { current: container };
}

function createPointerEvent(clientX = 100) {
  return {
    clientX,
    currentTarget: {
      setPointerCapture: vi.fn(),
    },
    pointerId: 1,
    preventDefault: vi.fn(),
  } as unknown as React.PointerEvent<HTMLDivElement>;
}

describe("useWorkspaceCompareSplit persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores a valid split percentage from localStorage", () => {
    window.localStorage.setItem(STORAGE_KEY, "68");

    const { result } = renderHook(() =>
      useWorkspaceCompareSplit({ containerRef: createContainerRef() }),
    );

    expect(result.current.compareSplit).toBe(68);
  });

  it.each(["not-a-number", "19", "81"])(
    "falls back to 50 for an invalid persisted value: %s",
    (storedValue) => {
      window.localStorage.setItem(STORAGE_KEY, storedValue);

      const { result } = renderHook(() =>
        useWorkspaceCompareSplit({ containerRef: createContainerRef() }),
      );

      expect(result.current.compareSplit).toBe(50);
    },
  );

  it("writes only the latest split after resize ends", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const containerRef = createContainerRef();
    const { result } = renderHook(() =>
      useWorkspaceCompareSplit({ containerRef }),
    );

    act(() => {
      result.current.handleResizeStart(createPointerEvent());
      result.current.handleResizeMove(createPointerEvent(760));
      result.current.handleResizeMove(createPointerEvent(840));
    });

    expect(result.current.compareSplit).toBe(74);
    expect(setItem).not.toHaveBeenCalled();

    act(() => {
      result.current.handleResizeEnd();
    });

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, "74");
  });

  it("ignores resize moves when the workspace width is zero", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const containerRef = createContainerRef(0);
    const { result } = renderHook(() =>
      useWorkspaceCompareSplit({ containerRef }),
    );

    act(() => {
      result.current.handleResizeStart(createPointerEvent());
      result.current.handleResizeMove(createPointerEvent(100));
      result.current.handleResizeEnd();
    });

    expect(result.current.compareSplit).toBe(50);
    expect(Number.isNaN(result.current.compareSplit)).toBe(false);
    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, "50");
  });
});
