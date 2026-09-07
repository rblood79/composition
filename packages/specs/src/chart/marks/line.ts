/**
 * ADR-194 — line 마크. v1 은 직선 polyline (곡선 보간은 비스코프 §7).
 *
 * 값이 없는 범주에서 선을 **끊는다** (M 으로 새 subpath). 이어 그으면 없는
 * 데이터를 통과하는 선분이 생겨 사용자가 준 적 없는 추세가 화면에 나온다.
 */
import { r2 } from "../scales";
import type { LinearScale, BandScale } from "../scales";
import type { SeriesGrid } from "../series";
import type { ChartOrientation, PathMark, Rect } from "../types";

export interface LineMarkInput {
  grid: SeriesGrid;
  band: BandScale;
  value: LinearScale;
  plot: Rect;
  orientation: ChartOrientation;
  strokeWidth: number;
}

/** 범주 i 의 밴드 중앙 (선/영역의 꼭짓점 x). */
export function bandCenter(band: BandScale, index: number): number {
  return band.at(index) + band.bandwidth / 2;
}

export interface SeriesPoint {
  x: number;
  y: number;
}

/** 한 시리즈의 (있는 값만) 점 목록. 끊김은 `gapAfter` 로 표시. */
export function seriesPoints(
  grid: SeriesGrid,
  seriesIdx: number,
  band: BandScale,
  value: LinearScale,
  orientation: ChartOrientation,
): Array<SeriesPoint & { gapBefore: boolean }> {
  const series = grid.series[seriesIdx];
  const points: Array<SeriesPoint & { gapBefore: boolean }> = [];
  let previousIndex = -2;
  for (let ci = 0; ci < grid.categories.length; ci++) {
    const v = series.values.get(ci);
    if (v === undefined) continue;
    const along = bandCenter(band, ci);
    const across = value(v);
    points.push({
      x: r2(orientation === "horizontal" ? across : along),
      y: r2(orientation === "horizontal" ? along : across),
      gapBefore: previousIndex >= 0 && ci !== previousIndex + 1,
    });
    previousIndex = ci;
  }
  return points;
}

export function pointsToPath(
  points: ReadonlyArray<SeriesPoint & { gapBefore: boolean }>,
): string {
  let d = "";
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    d += i === 0 || p.gapBefore ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`;
    if (i < points.length - 1 && !points[i + 1].gapBefore) continue;
    if (i < points.length - 1) d += " ";
  }
  return d;
}

export function bboxOf(points: ReadonlyArray<SeriesPoint>): Rect {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: r2(minX), y: r2(minY), w: r2(maxX - minX), h: r2(maxY - minY) };
}

export function buildLineMarks(input: LineMarkInput): PathMark[] {
  const { grid, band, value, orientation, strokeWidth } = input;
  const marks: PathMark[] = [];
  for (let si = 0; si < grid.series.length; si++) {
    const points = seriesPoints(grid, si, band, value, orientation);
    if (points.length === 0) continue;
    // 점 1개면 선이 안 보인다 — 길이 0 의 선분을 round cap 으로 찍어 점을 남긴다.
    const d =
      points.length === 1
        ? `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`
        : pointsToPath(points);
    marks.push({
      kind: "path",
      d,
      bbox: bboxOf(points),
      strokeSeries: grid.series[si].seriesIndex,
      strokeWidth,
    });
  }
  return marks;
}
