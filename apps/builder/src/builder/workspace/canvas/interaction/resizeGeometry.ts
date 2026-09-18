import type { SizeAxis } from "@composition/shared";
import type { BoundingBox, HandlePosition } from "../selection/types";

/**
 * ADR-224 breakdown §4.3 — 핸들 드래그 → 요청 크기 (scene px).
 *
 * - 핸들이 닿는 축만 요청한다 (엣지 = 한 축, 코너 = 두 축). 닿지 않은 축은 손대지 않는다
 *   ("Ratio 없는 한 축 edit 은 반대 authored 축을 바꾸지 않는다").
 * - Ratio 잠금이 있으면 driver 축 하나만 요청한다. driver 축에 닿으면 그 값을, 종속 축에만
 *   닿으면 목표 종속 크기를 ratio 로 driver 로 환산한다 (세로 resize → 목표 H × ratio → Width).
 *   코너도 driver 하나만이다.
 * - 위치는 바꾸지 않는다 — 흐름 안에서는 부모가 놓고, absolute 도 이 phase 에서는 크기만이다.
 */
export interface ResizeRatioLockInput {
  driver: SizeAxis;
  /** width / height */
  ratio: number;
}

export interface ResizeRequest {
  width?: number;
  height?: number;
}

export const RESIZE_MIN_PX = 1;

export function resolveResizeAxes(handle: HandlePosition): {
  width: boolean;
  height: boolean;
} {
  return {
    width: handle.includes("left") || handle.includes("right"),
    height: handle.includes("top") || handle.includes("bottom"),
  };
}

function rawSize(
  handle: HandlePosition,
  start: BoundingBox,
  dx: number,
  dy: number,
): { width: number; height: number } {
  let width = start.width;
  let height = start.height;
  if (handle.includes("left")) width -= dx;
  else if (handle.includes("right")) width += dx;
  if (handle.includes("top")) height -= dy;
  else if (handle.includes("bottom")) height += dy;
  return { width, height };
}

const clamp = (v: number): number => Math.max(RESIZE_MIN_PX, Math.round(v));

export function resolveResizeRequest(input: {
  handle: HandlePosition;
  startBounds: BoundingBox;
  /** scene px (screen delta ÷ 시작 zoom) */
  dx: number;
  dy: number;
  lock: ResizeRatioLockInput | null;
}): ResizeRequest {
  const { handle, startBounds, dx, dy, lock } = input;
  const axes = resolveResizeAxes(handle);
  const raw = rawSize(handle, startBounds, dx, dy);
  if (!lock) {
    const request: ResizeRequest = {};
    if (axes.width) request.width = clamp(raw.width);
    if (axes.height) request.height = clamp(raw.height);
    return request;
  }
  if (lock.driver === "width") {
    const width = axes.width ? raw.width : raw.height * lock.ratio;
    return { width: clamp(width) };
  }
  const height = axes.height ? raw.height : raw.width / lock.ratio;
  return { height: clamp(height) };
}
