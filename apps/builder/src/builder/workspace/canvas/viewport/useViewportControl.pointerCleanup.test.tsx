// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/builder/hooks", () => ({
  useKeyboardShortcutsRegistry: () => {},
}));

import { CanvasGestureSession } from "../interaction/canvasGestureSession";
import { useViewportSyncStore } from "../stores";
import { useViewportControl } from "./useViewportControl";

/**
 * ADR-226 R2 — 카메라 제스처 종료 계약: pointer pan 이 진행 중인데 control 이 unmount
 * (컨테이너 교체 · Compare Mode 전환) 되면 effect cleanup 이 session 을 finish 하고
 * **`onInteractionEnd` 도 1회** 호출해 `cameraGestureActive` 를 false 로 돌린다.
 * 누락 시 헤더 층이 동결 + 숨김 상태로 남는다 (reviews/226 round 1 m3).
 */
function Harness({
  containerEl,
  gestureSession,
  onInteractionStart,
  onInteractionEnd,
}: {
  containerEl: HTMLElement | null;
  gestureSession: CanvasGestureSession;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}) {
  useViewportControl({
    containerEl,
    gestureSession,
    onInteractionStart,
    onInteractionEnd,
  });
  return null;
}

describe("useViewportControl — pointer pan 중 unmount 는 onInteractionEnd 1회", () => {
  let container: HTMLDivElement;
  beforeEach(() => {
    useViewportSyncStore.getState().reset();
    container = document.createElement("div");
    document.body.appendChild(container);
  });
  afterEach(() => {
    cleanup();
    container.remove();
  });

  function mountWithStoreGate() {
    const store = useViewportSyncStore.getState();
    const onInteractionStart = vi.fn(() => store.setCameraGestureActive(true));
    const onInteractionEnd = vi.fn(() => store.setCameraGestureActive(false));
    const gestureSession = new CanvasGestureSession();
    const view = render(
      <Harness
        containerEl={container}
        gestureSession={gestureSession}
        onInteractionStart={onInteractionStart}
        onInteractionEnd={onInteractionEnd}
      />,
    );
    return { view, onInteractionStart, onInteractionEnd, gestureSession };
  }

  it("중클릭 pan 시작 → unmount → onInteractionEnd 1회 · store false", () => {
    const { view, onInteractionStart, onInteractionEnd } =
      mountWithStoreGate();
    fireEvent.pointerDown(container, { button: 1, pointerId: 5 });
    expect(onInteractionStart).toHaveBeenCalledTimes(1);
    expect(useViewportSyncStore.getState().cameraGestureActive).toBe(true);

    view.unmount();
    expect(onInteractionEnd).toHaveBeenCalledTimes(1);
    expect(useViewportSyncStore.getState().cameraGestureActive).toBe(false);
  });

  it("pan 이 아닐 때 unmount 는 onInteractionEnd 0 · pointercancel 대조군은 1", () => {
    const first = mountWithStoreGate();
    first.view.unmount();
    expect(first.onInteractionEnd).not.toHaveBeenCalled();

    const second = mountWithStoreGate();
    fireEvent.pointerDown(container, { button: 1, pointerId: 9 });
    fireEvent(
      window,
      new PointerEvent("pointercancel", { pointerId: 9, bubbles: true }),
    );
    expect(second.onInteractionEnd).toHaveBeenCalledTimes(1);
    expect(useViewportSyncStore.getState().cameraGestureActive).toBe(false);
    // 이미 종료된 뒤 unmount 는 중복 호출 없음
    second.view.unmount();
    expect(second.onInteractionEnd).toHaveBeenCalledTimes(1);
  });
});
