// @vitest-environment jsdom
/**
 * S2 Loupe (2026-11-18, 사용자 보고 「이동이 멈췄을 때만 나타나고 이동 중에는 나타나지 않는다」): the Loupe
 * re-renders on every move (the color · the place) with a new `onExited`. Its enter animation (125ms
 * from transparent) must run once per open — restarting it on each re-render kept it transparent
 * until the drag paused.
 */
import { act, createElement, createRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColorLoupe } from "../colorHandleDom.runtime";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }));

afterEach(() => {
  animate.mockClear();
  delete (Element.prototype as { animate?: unknown }).animate;
});

describe("S2 Loupe — the enter animation runs once while dragging", () => {
  it("re-renders with a new color and a new onExited do not restart it; closing runs the exit", () => {
    (Element.prototype as { animate?: unknown }).animate = animate;
    const host = document.createElement("div");
    const root = createRoot(host);
    const thumbRef = createRef<HTMLDivElement>();
    const render = (color: string, exiting: boolean) =>
      act(() =>
        root.render(
          createElement(ColorLoupe, {
            thumbRef,
            color,
            exiting,
            onExited: () => {},
          }),
        ),
      );
    render("rgb(10, 0, 0)", false);
    render("rgb(20, 0, 0)", false);
    render("rgb(30, 0, 0)", false);
    expect(animate).toHaveBeenCalledTimes(1);
    render("rgb(30, 0, 0)", true);
    expect(animate).toHaveBeenCalledTimes(2);
    act(() => root.unmount());
  });
});
