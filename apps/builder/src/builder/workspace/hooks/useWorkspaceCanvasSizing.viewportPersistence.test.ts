// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useViewportSyncStore } from "../canvas/stores";
import { useWorkspaceCanvasSizing } from "./useWorkspaceCanvasSizing";
import { WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY } from "./workspaceCanvasViewportPersistence";

const BREAKPOINTS = [
  { id: "desktop", label: "Desktop", max_width: 1920, max_height: 1080 },
  { id: "tablet", label: "Tablet", max_width: 768, max_height: 1024 },
  { id: "mobile", label: "Mobile", max_width: 390, max_height: 844 },
];

function createRefElement(width = 1000, height = 700) {
  const element = document.createElement("div");
  Object.defineProperties(element, {
    clientWidth: { configurable: true, value: width },
    clientHeight: { configurable: true, value: height },
  });
  return { current: element };
}

function readStoredViewports() {
  return JSON.parse(
    window.localStorage.getItem(WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY) ?? "{}",
  );
}

describe("useWorkspaceCanvasSizing viewport persistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    useViewportSyncStore.getState().reset();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function renderSizing(initialBreakpoint = "desktop") {
    const containerRef = createRefElement();
    const canvasAreaRef = createRefElement();
    const result = renderHook(
      ({ breakpoint }) =>
        useWorkspaceCanvasSizing({
          breakpoint: new Set([breakpoint]),
          breakpoints: BREAKPOINTS,
          canvasAreaRef,
          compareMode: false,
          containerRef,
        }),
      { initialProps: { breakpoint: initialBreakpoint } },
    );
    return { ...result, containerRef, canvasAreaRef };
  }

  it("restores the persisted desktop viewport after initial sizing", () => {
    window.localStorage.setItem(
      WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY,
      JSON.stringify({ desktop: { x: 120, y: 80, scale: 1.25 } }),
    );

    renderSizing();

    expect(useViewportSyncStore.getState()).toMatchObject({
      panOffset: { x: 120, y: 80 },
      zoom: 1.25,
    });
  });

  it("flushes the active viewport and keeps snapshots isolated by breakpoint", () => {
    const rendered = renderSizing();

    act(() => {
      useViewportSyncStore.getState().setViewportSnapshot({
        panOffset: { x: 120, y: 80 },
        zoom: 1.25,
      });
      vi.advanceTimersByTime(200);
    });

    expect(readStoredViewports().desktop).toEqual({
      x: 120,
      y: 80,
      scale: 1.25,
    });

    act(() => {
      rendered.rerender({ breakpoint: "tablet" });
    });

    act(() => {
      useViewportSyncStore.getState().setViewportSnapshot({
        panOffset: { x: -40, y: 30 },
        zoom: 0.8,
      });
      vi.advanceTimersByTime(200);
    });

    expect(readStoredViewports()).toEqual({
      desktop: { x: 120, y: 80, scale: 1.25 },
      tablet: { x: -40, y: 30, scale: 0.8 },
    });

    act(() => {
      rendered.rerender({ breakpoint: "desktop" });
    });
    expect(useViewportSyncStore.getState()).toMatchObject({
      panOffset: { x: 120, y: 80 },
      zoom: 1.25,
    });

    act(() => {
      rendered.rerender({ breakpoint: "tablet" });
    });
    expect(useViewportSyncStore.getState()).toMatchObject({
      panOffset: { x: -40, y: 30 },
      zoom: 0.8,
    });
  });

  it("flushes the latest active snapshot on unmount", () => {
    const rendered = renderSizing();

    act(() => {
      useViewportSyncStore.getState().setViewportSnapshot({
        panOffset: { x: 55, y: -12 },
        zoom: 1,
      });
    });

    rendered.unmount();

    expect(readStoredViewports().desktop).toEqual({
      x: 55,
      y: -12,
      scale: 1,
    });
  });
});
