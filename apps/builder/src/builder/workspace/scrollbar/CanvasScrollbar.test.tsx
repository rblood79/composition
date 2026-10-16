/**
 * Canvas 스크롤바는 뷰포트가 움직일 때만 잠깐 보인다 — 문서 편집 · 선택 (content 알림) · 크기 변화는
 * thumb 만 조용히 맞춘다. 전에는 content 가 step · session 변경마다 알려 편집 · 선택마다 1 초씩 깜빡였다.
 */
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const viewportListeners: Array<() => void> = [];
vi.mock("../canvas/viewport/ViewportController", () => ({
  getViewportController: () => ({
    addUpdateListener: (listener: () => void) => {
      viewportListeners.push(listener);
      return () => {};
    },
    getState: () => ({ x: 0, y: 0, scale: 1 }),
  }),
}));
vi.mock("../canvas/stores", () => ({
  useViewportSyncStore: { subscribe: () => () => {} },
}));
vi.mock("../canvas/viewport/viewportActions", () => ({
  applyViewportState: vi.fn(),
  beginViewportInteraction: vi.fn(),
}));
vi.mock("./viewportMetrics", () => ({
  getScrollbarViewportMetrics: () => null,
  getScrollbarAxisMetrics: () => null,
}));

import { CanvasScrollbar } from "./CanvasScrollbar";

let frames: FrameRequestCallback[] = [];
const flushFrames = () =>
  act(() => {
    const queued = frames;
    frames = [];
    for (const frame of queued) frame(0);
  });

beforeEach(() => {
  viewportListeners.length = 0;
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => {
    frames.push(frame);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mount() {
  const contentListeners: Array<() => void> = [];
  const content = {
    rects: () => [],
    subscribe: (notify: () => void) => {
      contentListeners.push(notify);
      return () => {};
    },
  };
  const { container } = render(
    <CanvasScrollbar direction="horizontal" content={content} />,
  );
  const track = container.querySelector(".canvas-scrollbar")!;
  return { track, notifyContent: () => contentListeners.forEach((n) => n()) };
}

describe("CanvasScrollbar 보이기", () => {
  it("문서 · 선택 변경 (content 알림) 은 스크롤바를 보이지 않는다", () => {
    const { track, notifyContent } = mount();
    flushFrames();
    notifyContent();
    flushFrames();
    expect(track.classList.contains("canvas-scrollbar--visible")).toBe(false);
  });

  it("뷰포트가 움직이면 보인다 — 같은 프레임에 content 알림이 겹쳐도", () => {
    const { track, notifyContent } = mount();
    flushFrames();
    notifyContent();
    viewportListeners.forEach((listener) => listener());
    flushFrames();
    expect(track.classList.contains("canvas-scrollbar--visible")).toBe(true);
  });
});
