// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/builder/hooks", () => ({
  useKeyboardShortcutsRegistry: () => {},
}));

import { CanvasGestureSession } from "../interaction/canvasGestureSession";
import { useViewportSyncStore } from "../stores";
import { useViewportControl } from "./useViewportControl";

/**
 * 캔버스 휠 팬 중 트랙패드 왼쪽 스와이프가 브라우저 뒤로가기 (대시보드) 로 새던 결함.
 * wheel `preventDefault` 는 모든 방향에서 호출되지만 macOS 스와이프 history 이동은
 * root scroller 의 `overscroll-behavior-x` 로만 막힌다. 휠 핸들러가 붙어 있는 동안
 * root 에 `none` 을 걸고, 떼면 원래 값으로 되돌린다 (대시보드 스와이프는 유지).
 */
function Harness({ containerEl }: { containerEl: HTMLElement | null }) {
  useViewportControl({
    containerEl,
    gestureSession: new CanvasGestureSession(),
  });
  return null;
}

const root = () => document.documentElement.style;

describe("useViewportControl — 트랙패드 스와이프 history 이동 차단", () => {
  let container: HTMLDivElement;
  beforeEach(() => {
    useViewportSyncStore.getState().reset();
    root().removeProperty("overscroll-behavior-x");
    container = document.createElement("div");
    document.body.appendChild(container);
  });
  afterEach(() => {
    cleanup();
    container.remove();
    root().removeProperty("overscroll-behavior-x");
  });

  it("휠 핸들러가 붙어 있는 동안 root overscroll-behavior-x 는 none", () => {
    const view = render(<Harness containerEl={container} />);
    expect(root().getPropertyValue("overscroll-behavior-x")).toBe("none");

    view.unmount();
    expect(root().getPropertyValue("overscroll-behavior-x")).toBe("");
  });

  it("unmount 는 이전 inline 값을 복원한다", () => {
    root().setProperty("overscroll-behavior-x", "contain");
    const view = render(<Harness containerEl={container} />);
    expect(root().getPropertyValue("overscroll-behavior-x")).toBe("none");

    view.unmount();
    expect(root().getPropertyValue("overscroll-behavior-x")).toBe("contain");
  });

  it("containerEl 이 없으면 root 를 건드리지 않는다", () => {
    render(<Harness containerEl={null} />);
    expect(root().getPropertyValue("overscroll-behavior-x")).toBe("");
  });
});
