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
 * - 흐름 안 요소의 위치는 부모가 놓는다. absolute 요소 (`position` 입력 = 시작 CSS left/top px) 는
 *   left/top 핸들을 잡으면 반대 변이 고정되도록 left/top 을 같이 옮긴다 — 잡은 변만, 결과 크기 기준
 *   (Ratio 로 파생된 종속 축도 포함).
 */
export interface ResizeRatioLockInput {
  driver: SizeAxis;
  /** width / height */
  ratio: number;
}

export interface ResizeRequest {
  width?: number;
  height?: number;
  /** absolute 요소의 left/top 핸들 — CSS px */
  left?: number;
  top?: number;
}

export interface ResizeStartPosition {
  left: number;
  top: number;
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

function sizeRequest(
  handle: HandlePosition,
  raw: { width: number; height: number },
  lock: ResizeRatioLockInput | null,
): ResizeRequest {
  const axes = resolveResizeAxes(handle);
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

/** 요청 (+Ratio 파생) 뒤의 결과 크기 — left/top 이동량의 기준 */
function resultingSize(
  request: ResizeRequest,
  startBounds: BoundingBox,
  lock: ResizeRatioLockInput | null,
): { width: number; height: number } {
  let width = request.width ?? startBounds.width;
  let height = request.height ?? startBounds.height;
  if (lock?.driver === "width" && request.width !== undefined) {
    height = request.width / lock.ratio;
  } else if (lock?.driver === "height" && request.height !== undefined) {
    width = request.height * lock.ratio;
  }
  return { width, height };
}

export function resolveResizeRequest(input: {
  handle: HandlePosition;
  startBounds: BoundingBox;
  /** scene px (screen delta ÷ 시작 zoom) */
  dx: number;
  dy: number;
  lock: ResizeRatioLockInput | null;
  /** absolute 요소의 시작 CSS left/top (px) — 있으면 left/top 핸들이 위치도 옮긴다 */
  position?: ResizeStartPosition | null;
}): ResizeRequest {
  const { handle, startBounds, dx, dy, lock, position } = input;
  const request = sizeRequest(
    handle,
    rawSize(handle, startBounds, dx, dy),
    lock,
  );
  if (!position) return request;
  const result = resultingSize(request, startBounds, lock);
  if (handle.includes("left")) {
    request.left =
      Math.round((position.left + (startBounds.width - result.width)) * 100) /
      100;
  }
  if (handle.includes("top")) {
    request.top =
      Math.round((position.top + (startBounds.height - result.height)) * 100) /
      100;
  }
  return request;
}
