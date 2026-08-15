import { afterEach, describe, expect, it } from "vitest";
import { useViewportSyncStore } from "../stores";
import {
  getViewportController,
  resetViewportController,
} from "./ViewportController";
import {
  getViewportInteractionSession,
  resetViewportInteractionSession,
} from "./ViewportInteractionSession";
import {
  getViewportInteractionMetricsSnapshot,
  resetViewportInteractionMetrics,
} from "./viewportInteractionMetrics";
import {
  applyViewportState,
  resolveBreakpointViewport,
  zoomViewportAtContainerCenter,
} from "./viewportActions";

afterEach(() => {
  resetViewportInteractionSession();
  resetViewportController();
  resetViewportInteractionMetrics();
  useViewportSyncStore.getState().reset();
});

describe("resolveBreakpointViewport", () => {
  it("처음 방문하는 breakpoint는 현재 zoom을 유지하고 중앙 정렬한다", () => {
    const viewport = resolveBreakpointViewport({
      canvasSize: { width: 390, height: 844 },
      containerSize: { width: 1000, height: 800 },
      zoom: 1,
    });

    expect(viewport).toEqual({
      scale: 1,
      x: 305,
      y: -22,
    });
  });

  it("기존 breakpoint snapshot은 zoom과 pan을 함께 복원한다", () => {
    const savedViewport = { x: 42, y: 84, scale: 1 };

    expect(
      resolveBreakpointViewport({
        canvasSize: { width: 1920, height: 1080 },
        containerSize: { width: 1000, height: 800 },
        zoom: 0.6,
        savedViewport,
      }),
    ).toEqual(savedViewport);
  });

  // 구 케이스명은 "attached / unattached controller" 였다. `attach()` 로 갈리는
  //   분기는 `viewportActions` 에 없었고(ADR-900 으로 PixiJS Container 소멸),
  //   2026-08-15 에 `attach()` 자체가 삭제되며 두 케이스는 같은 경로가 됐다.
  //   그래도 값 조합이 달라 회귀 감시로는 둘 다 유지한다.
  it("discrete command session 이 controller 와 mirror 를 함께 갱신한다", () => {
    const controller = getViewportController();

    applyViewportState({ x: 40, y: 80, scale: 1.5 });

    expect(controller.getState()).toEqual({ x: 40, y: 80, scale: 1.5 });
    expect(useViewportSyncStore.getState()).toMatchObject({
      panOffset: { x: 40, y: 80 },
      zoom: 1.5,
    });
  });

  it("discrete command 는 session mirror 를 사용한다 (commit 1회)", () => {
    const controller = getViewportController();

    applyViewportState({ x: 12, y: 24, scale: 1.1 });

    expect(controller.getState()).toEqual({ x: 12, y: 24, scale: 1.1 });
    expect(useViewportSyncStore.getState()).toMatchObject({
      panOffset: { x: 12, y: 24 },
      zoom: 1.1,
    });
    expect(getViewportInteractionMetricsSnapshot().mirrorCommitCount).toBe(1);
  });

  it("zoom command는 active session을 flush한 최신 controller state를 기준으로 계산한다", () => {
    // 구 코드의 `controller.attach({x:0,y:0,scale:{x:1}})` 는 fresh controller 의
    //   초기값과 동일해 상태상 no-op 이었다 (afterEach 가 매번 리셋한다).
    const controller = getViewportController();
    useViewportSyncStore
      .getState()
      .setContainerSize({ width: 1000, height: 800 });

    const session = getViewportInteractionSession({
      controller,
      commitMirror: (state) => {
        useViewportSyncStore.getState().setViewportSnapshot({
          panOffset: { x: state.x, y: state.y },
          zoom: state.scale,
        });
      },
      readMirror: () => ({ x: 0, y: 0, scale: 1 }),
      scheduler: {
        request: () => 1,
        cancel: () => {},
      },
    });
    session.begin("wheel-pan");
    session.queuePan({ x: 10, y: 0 });

    zoomViewportAtContainerCenter(2);

    expect(controller.getState()).toEqual({ x: -480, y: -400, scale: 2 });
    expect(useViewportSyncStore.getState()).toMatchObject({
      panOffset: { x: -480, y: -400 },
      zoom: 2,
    });
  });
});
