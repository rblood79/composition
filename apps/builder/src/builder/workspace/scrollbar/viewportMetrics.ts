import { useStore } from "../../stores";
import { useEditModeStore } from "../../stores/editMode";
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

/**
 * 스크롤 대상이 되는 아트보드 rect 목록.
 *
 * 아트보드 크기는 `canvasSize`(= breakpoint 페이지 크기)다 — `panToPage` 가 페이지 중심을
 * `pos + canvasSize/2` 로 잡는 것과 같은 의미. frame 편집 모드에서는 캔버스가 페이지를
 * 비우고 프레임만 그리므로(`BuilderCanvas` 의 `isFrameEditMode ? [] : pages`) 대상도 그에
 * 맞춰 갈린다 — 섞으면 프레임 편집 중 스크롤 범위가 전 페이지로 부풀어 오른다.
 */
function collectContentRects(canvasSize: {
  width: number;
  height: number;
}): ContentRect[] {
  const { pagePositions, framePositions } = useStore.getState();
  const isFrameEditMode = useEditModeStore.getState().mode === "layout";
  const positions = isFrameEditMode ? framePositions : pagePositions;

  const rects: ContentRect[] = [];
  for (const position of Object.values(positions ?? {})) {
    if (!position) continue;
    rects.push({
      x: position.x,
      y: position.y,
      width: canvasSize.width,
      height: canvasSize.height,
    });
  }
  return rects;
}

export interface ViewportInsets {
  left: number;
  right: number;
}

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

  if (controller.isAttached()) {
    return controller.getState();
  }

  const { panOffset, zoom } = useViewportSyncStore.getState();
  return {
    scale: zoom,
    x: panOffset.x,
    y: panOffset.y,
  };
}

export function getScrollbarViewportMetrics(
  insets: ViewportInsets,
  viewportState = getViewportAuthoritativeState(),
): ScrollbarViewportMetrics | null {
  const { canvasSize, containerSize } = useViewportSyncStore.getState();
  if (containerSize.width <= 0 || containerSize.height <= 0) {
    return null;
  }

  const visibleWidth = containerSize.width - insets.left - insets.right;
  const visibleHeight = containerSize.height;
  if (visibleWidth <= 0 || visibleHeight <= 0 || viewportState.scale <= 0) {
    return null;
  }

  const visibleViewport = {
    height: visibleHeight / viewportState.scale,
    width: visibleWidth / viewportState.scale,
    x: (insets.left - viewportState.x) / viewportState.scale,
    y: -viewportState.y / viewportState.scale,
  };

  const world = calculateWorldBounds(
    collectContentRects(canvasSize),
    visibleViewport,
  );

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

  const thumbSize = Math.max(30, (viewportSize / worldSize) * trackLength);

  return {
    scrollableTrack: trackLength - thumbSize,
    scrollableWorld: worldSize - viewportSize,
    thumbSize,
    viewportSize,
    viewportStart: isHorizontal
      ? metrics.visibleViewport.x - metrics.world.minX
      : metrics.visibleViewport.y - metrics.world.minY,
    worldMax: isHorizontal ? metrics.world.maxX : metrics.world.maxY,
    worldMin: isHorizontal ? metrics.world.minX : metrics.world.minY,
    worldSize,
  };
}
