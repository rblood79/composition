import { useViewportSyncStore } from "../stores";
import {
  getViewportController,
  type ViewportState,
} from "./ViewportController";
import {
  getViewportInteractionSession,
  type ViewportInteractionKind,
  type ViewportInteractionSession,
} from "./ViewportInteractionSession";
import { recordViewportInteractionMirrorCommit } from "./viewportInteractionMetrics";

export interface ViewportCanvasSize {
  height: number;
  width: number;
}

export interface ViewportContainerSize {
  height: number;
  width: number;
}

export interface ComputeCenteredViewportOptions {
  canvasSize: ViewportCanvasSize;
  containerSize: ViewportContainerSize;
  zoom: number;
}

export interface ComputeFitViewportOptions {
  canvasSize: ViewportCanvasSize;
  containerSize: ViewportContainerSize;
  fitPaddingRatio?: number;
}

export interface ComputeFillViewportOptions {
  canvasSize: ViewportCanvasSize;
  containerSize: ViewportContainerSize;
}

export interface ResolveBreakpointViewportOptions {
  canvasSize: ViewportCanvasSize;
  containerSize: ViewportContainerSize;
  zoom: number;
  savedViewport?: ViewportState;
}

export function clampViewportZoom(zoom: number): number {
  return Math.max(0.1, Math.min(5, zoom));
}

export function computeCenteredViewport({
  canvasSize,
  containerSize,
  zoom,
}: ComputeCenteredViewportOptions): ViewportState {
  return {
    scale: zoom,
    x: (containerSize.width - canvasSize.width * zoom) / 2,
    y: (containerSize.height - canvasSize.height * zoom) / 2,
  };
}

export function computeFitViewport({
  canvasSize,
  containerSize,
  fitPaddingRatio = 0.9,
}: ComputeFitViewportOptions): ViewportState {
  const scaleX = containerSize.width / canvasSize.width;
  const scaleY = containerSize.height / canvasSize.height;
  const zoom = clampViewportZoom(Math.min(scaleX, scaleY) * fitPaddingRatio);

  return computeCenteredViewport({
    canvasSize,
    containerSize,
    zoom,
  });
}

export function computeFillViewport({
  canvasSize,
  containerSize,
}: ComputeFillViewportOptions): ViewportState {
  const scaleX = containerSize.width / canvasSize.width;
  const scaleY = containerSize.height / canvasSize.height;
  const zoom = clampViewportZoom(Math.max(scaleX, scaleY));

  return computeCenteredViewport({
    canvasSize,
    containerSize,
    zoom,
  });
}

/**
 * Breakpoint 전환 시 viewport 정책.
 *
 * 처음 방문하는 breakpoint는 사용자가 현재 선택한 zoom을 유지하고 새 아트보드만
 * 중앙 정렬한다. 이미 방문한 breakpoint는 해당 breakpoint에서 마지막으로 보던
 * zoom/pan snapshot을 복원한다.
 */
export function resolveBreakpointViewport({
  canvasSize,
  containerSize,
  zoom,
  savedViewport,
}: ResolveBreakpointViewportOptions): ViewportState {
  if (savedViewport) return savedViewport;

  return computeCenteredViewport({ canvasSize, containerSize, zoom });
}

export function offsetViewportStateX(
  state: ViewportState,
  offsetX: number,
): ViewportState {
  return {
    ...state,
    x: state.x + offsetX,
  };
}

function getViewportSession(): ViewportInteractionSession {
  const controller = getViewportController();

  return getViewportInteractionSession({
    controller,
    commitMirror: (state) => {
      recordViewportInteractionMirrorCommit();
      useViewportSyncStore.getState().setViewportSnapshot({
        panOffset: { x: state.x, y: state.y },
        zoom: state.scale,
      });
    },
    readMirror: () => {
      const { panOffset, zoom } = useViewportSyncStore.getState();
      return { x: panOffset.x, y: panOffset.y, scale: zoom };
    },
  });
}

export function beginViewportInteraction(
  kind: ViewportInteractionKind,
): ViewportInteractionSession {
  const session = getViewportSession();
  session.begin(kind);
  return session;
}

export function runViewportCommand(
  command: (state: ViewportState) => ViewportState,
): void {
  getViewportSession().runCommand(command);
}

export function applyViewportState(nextState: ViewportState): void {
  runViewportCommand(() => nextState);
}

export function zoomViewportAtContainerCenter(nextZoom: number): void {
  const state = useViewportSyncStore.getState();
  const zoom = clampViewportZoom(nextZoom);

  runViewportCommand((current) => {
    if (state.containerSize.width === 0 || state.containerSize.height === 0) {
      return { scale: zoom, x: current.x, y: current.y };
    }

    const centerX = state.containerSize.width / 2;
    const centerY = state.containerSize.height / 2;
    const zoomRatio = zoom / current.scale;

    return {
      scale: zoom,
      x: centerX - (centerX - current.x) * zoomRatio,
      y: centerY - (centerY - current.y) * zoomRatio,
    };
  });
}
