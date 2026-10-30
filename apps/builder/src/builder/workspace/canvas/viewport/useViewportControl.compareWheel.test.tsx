// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasGestureSession } from "../interaction/canvasGestureSession";
import { useViewportSyncStore } from "../stores";
import {
  getViewportController,
  resetViewportController,
} from "./ViewportController";
import {
  finishActiveViewportInteraction,
  resetViewportInteractionSession,
} from "./ViewportInteractionSession";
import { useViewportControl } from "./useViewportControl";
import {
  forwardPreviewWheel,
  readPreviewWheelMessage,
  registerCatalogPreviewWheel,
} from "../../../../preview/catalog/catalogPreviewWheel";

vi.mock("../../../hooks/useKeyboardShortcutsRegistry", () => ({
  useKeyboardShortcutsRegistry: () => {},
}));

function Harness({
  container,
  routeWheel,
}: {
  container: HTMLElement;
  routeWheel?: (x: number, y: number) => boolean;
}) {
  useViewportControl({
    containerEl: container,
    gestureSession: new CanvasGestureSession(),
    routeWheel,
  });
  return null;
}

describe("Compare CSS 휠 → 공용 Canvas 카메라", () => {
  let scope: HTMLDivElement;
  let canvas: HTMLDivElement;
  let frame: HTMLIFrameElement;
  beforeEach(() => {
    resetViewportInteractionSession();
    resetViewportController();
    useViewportSyncStore.getState().reset();
    scope = document.createElement("div");
    scope.className = "workspace--compare-mode";
    canvas = document.createElement("div");
    frame = document.createElement("iframe");
    frame.src = "/preview.html?catalog=1&compare=1";
    scope.append(canvas, frame);
    document.body.append(scope);
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 20,
      top: 40,
    } as DOMRect);
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 120,
      width: 500,
      height: 400,
    } as DOMRect);
  });
  afterEach(() => {
    cleanup();
    resetViewportInteractionSession();
    resetViewportController();
    scope.remove();
    vi.restoreAllMocks();
  });
  const message = {
    type: "CATALOG_PREVIEW_WHEEL",
    clientX: 200,
    clientY: 160,
    viewportWidth: 1000,
    viewportHeight: 800,
    deltaX: 12,
    deltaY: 30,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
  };
  function forward(overrides = {}) {
    forwardPreviewWheel(
      frame,
      readPreviewWheelMessage({ ...message, ...overrides })!,
    );
    finishActiveViewportInteraction();
    return getViewportController().getState();
  }
  it("CSS 여백과 Canvas는 한 번씩만 pan하고 해제 후 입력을 받지 않는다", () => {
    const view = render(<Harness container={canvas} />);
    const event = new WheelEvent("wheel", {
      deltaY: 30,
      bubbles: true,
      cancelable: true,
    });
    scope.dispatchEvent(event);
    finishActiveViewportInteraction();
    expect(event.defaultPrevented).toBe(true);
    expect(getViewportController().getState().y).toBe(-30);
    fireEvent.wheel(canvas, { deltaY: 30 });
    finishActiveViewportInteraction();
    expect(getViewportController().getState().y).toBe(-60);
    view.unmount();
    fireEvent.wheel(scope, { deltaY: 30 });
    expect(getViewportController().getState().y).toBe(-60);
  });
  it("iframe 일반/Shift 휠은 zoom에 상관없이 동일 이동량을 쓴다", () => {
    render(<Harness container={canvas} />);
    expect(forward()).toMatchObject({ x: -12, y: -30, scale: 1 });
    expect(forward({ shiftKey: true })).toMatchObject({
      x: -42,
      y: -30,
      scale: 1,
    });
  });
  it.each(["metaKey", "ctrlKey"])(
    "%s 줌은 변환된 포인터 아래 world 좌표를 유지한다",
    (key) => {
      render(<Harness container={canvas} />);
      const state = forward({ [key]: true, deltaY: -10 });
      // iframe (200,160) * 0.5 + (100,120) - Canvas (20,40) = (180,160)
      expect(state.scale).toBeGreaterThan(1);
      expect((180 - state.x) / state.scale).toBeCloseTo(180);
      expect((160 - state.y) / state.scale).toBeCloseTo(160);
    },
  );
  it("CSS에서도 기존 선택 요소 스크롤 라우팅을 유지한다", () => {
    const route = vi.fn(() => true);
    render(<Harness container={canvas} routeWheel={route} />);
    expect(forward()).toMatchObject({ x: 0, y: 0, scale: 1 });
    expect(route).toHaveBeenCalledWith(12, 30);
  });
  it("compare iframe만 기본 휠을 소비하고 정확한 origin에 전송한다", () => {
    const child = frame.contentWindow!;
    child.document.appendChild(child.document.createElement("html"));
    const post = vi
      .spyOn(child.parent, "postMessage")
      .mockImplementation(() => {});
    const off = registerCatalogPreviewWheel(child);
    const event = new WheelEvent("wheel", {
      deltaY: 30,
      metaKey: true,
      cancelable: true,
    });
    child.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CATALOG_PREVIEW_WHEEL",
        metaKey: true,
        deltaY: 30,
      }),
      child.location.origin,
    );
    off();
    post.mockClear();
    child.dispatchEvent(new WheelEvent("wheel"));
    expect(post).not.toHaveBeenCalled();
    const offStandalone = registerCatalogPreviewWheel(window);
    const standalone = new WheelEvent("wheel", { cancelable: true });
    window.dispatchEvent(standalone);
    expect(standalone.defaultPrevented).toBe(false);
    offStandalone();
  });
  it("다른 타입·비유한 좌표·빈 viewport 메시지는 거부한다", () => {
    for (const invalid of [
      { type: "OTHER" },
      { deltaY: NaN },
      { clientX: Infinity },
      { viewportWidth: 0 },
      { metaKey: "true" },
    ]) {
      expect(
        readPreviewWheelMessage({ ...message, ...invalid }),
      ).toBeUndefined();
    }
  });
});
