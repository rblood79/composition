import { useViewportSyncStore } from "../canvas/stores";
import {
  getViewportController,
  type ViewportState,
} from "../canvas/viewport/ViewportController";
import {
  calculateWorldBounds,
  type ContentRect,
  type WorldBounds,
} from "./calculateWorldBounds";

export interface ViewportVisibleWorldBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface ScrollbarViewportMetrics {
  containerSize: { height: number; width: number };
  visibleViewport: ViewportVisibleWorldBounds;
  viewportState: ViewportState;
  world: WorldBounds;
}

export interface ScrollbarAxisMetrics {
  scrollableTrack: number;
  scrollableWorld: number;
  thumbSize: number;
  viewportSize: number;
  viewportStart: number;
  worldMax: number;
  worldMin: number;
  worldSize: number;
}

export function getViewportAuthoritativeState(): ViewportState {
  const controller = getViewportController();

  // 구 판정은 legacy renderer 연결 상태였고 현재는 항상 거짓이라
  //   pan 중에도 React mirror 를 읽었다 — mirror 는 endPan 에서만 동기화되므로
  //   드래그하는 내내 thumb 이 제자리에 멈췄다. 그 심볼은 2026-08-15 에 삭제됐다.
  if (controller.hasLiveState()) {
    return controller.getState();
  }

  const { panOffset, zoom } = useViewportSyncStore.getState();
  return {
    scale: zoom,
    x: panOffset.x,
    y: panOffset.y,
  };
}

/**
 * `contentRects`: the artboards the scroll range covers (the Canvas's page frames).
 */
export function getScrollbarViewportMetrics(
  viewportState = getViewportAuthoritativeState(),
  contentRects: readonly ContentRect[],
): ScrollbarViewportMetrics | null {
  const { canvasSize, containerSize } = useViewportSyncStore.getState();
  if (containerSize.width <= 0 || containerSize.height <= 0) {
    return null;
  }

  const visibleWidth = containerSize.width;
  const visibleHeight = containerSize.height;
  if (visibleWidth <= 0 || visibleHeight <= 0 || viewportState.scale <= 0) {
    return null;
  }

  const visibleViewport = {
    height: visibleHeight / viewportState.scale,
    width: visibleWidth / viewportState.scale,
    x: -viewportState.x / viewportState.scale,
    y: -viewportState.y / viewportState.scale,
  };

  const world = calculateWorldBounds(contentRects, visibleViewport);

  return {
    containerSize,
    viewportState,
    visibleViewport,
    world,
  };
}

export function getScrollbarAxisMetrics(
  metrics: ScrollbarViewportMetrics,
  direction: "horizontal" | "vertical",
  trackLength: number,
): ScrollbarAxisMetrics | null {
  if (trackLength <= 0) {
    return null;
  }

  const isHorizontal = direction === "horizontal";
  const worldSize = isHorizontal ? metrics.world.width : metrics.world.height;
  const viewportSize = isHorizontal
    ? metrics.visibleViewport.width
    : metrics.visibleViewport.height;
  if (worldSize <= 0 || viewportSize <= 0) {
    return null;
  }

  // world 확장이 한 화면으로 제한되므로 뷰포트가 world 를 넘을 수 있다 —
  //   thumb 이 트랙을 넘지 않도록 상한을 건다.
  const thumbSize = Math.min(
    trackLength,
    Math.max(30, (viewportSize / worldSize) * trackLength),
  );
  const scrollableWorld = worldSize - viewportSize;
  const rawStart = isHorizontal
    ? metrics.visibleViewport.x - metrics.world.minX
    : metrics.visibleViewport.y - metrics.world.minY;

  return {
    scrollableTrack: trackLength - thumbSize,
    scrollableWorld,
    thumbSize,
    viewportSize,
    // content 밖 overscroll 은 트랙 끝에 머문다 (world 밖 위치를 그리지 않는다)
    viewportStart:
      scrollableWorld > 0
        ? Math.min(Math.max(rawStart, 0), scrollableWorld)
        : rawStart,
    worldMax: isHorizontal ? metrics.world.maxX : metrics.world.maxY,
    worldMin: isHorizontal ? metrics.world.minX : metrics.world.minY,
    worldSize,
  };
}
