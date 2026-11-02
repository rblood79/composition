import { r2 } from "./scales";
import type { Rect } from "./types";

/** 점들의 경계 상자. 선·면·극좌표 mark가 같은 반올림 규칙을 사용한다. */
export function boundsOfPoints(
  points: ReadonlyArray<{ x: number; y: number }>,
): Rect {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = points[0].x;
  let maxX = minX;
  let minY = points[0].y;
  let maxY = minY;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return { x: r2(minX), y: r2(minY), w: r2(maxX - minX), h: r2(maxY - minY) };
}
