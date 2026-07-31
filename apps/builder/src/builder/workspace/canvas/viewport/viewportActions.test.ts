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

  it("attached controller에서는 discrete command session으로 controller와 mirror를 함께 갱신한다", () => {
    const controller = getViewportController();
    controller.attach({
      x: 0,
      y: 0,
      scale: { set: () => {}, x: 1 },
    });

    applyViewportState({ x: 40, y: 80, scale: 1.5 });

    expect(controller.getState()).toEqual({ x: 40, y: 80, scale: 1.5 });
    expect(useViewportSyncStore.getState()).toMatchObject({
      panOffset: { x: 40, y: 80 },
      zoom: 1.5,
    });
  });

  it("unattached controller에서도 discrete command는 session mirror를 사용한다", () => {
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
    const controller = getViewportController();
    controller.attach({
      x: 0,
      y: 0,
      scale: { set: () => {}, x: 1 },
    });
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
