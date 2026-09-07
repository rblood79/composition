/**
 * ADR-194 — area 마크 = line + baseline 으로 닫기(`Z`).
 *
 * 값이 끊긴 구간은 line 과 같이 subpath 를 나눈다 — 이어 채우면 없는 데이터 위에
 * 면이 생긴다. 각 subpath 를 baseline 으로 내려 닫으므로 `fillRule` 은 기본
 * nonzero 로 충분하다 (subpath 가 겹치지 않는다).
 */
import { r2 } from "../scales";
import type { LinearScale, BandScale } from "../scales";
import type { SeriesGrid } from "../series";
import type { ChartOrientation, PathMark, Rect } from "../types";
import { bboxOf, seriesPoints } from "./line";

export interface AreaMarkInput {
  grid: SeriesGrid;
  band: BandScale;
  value: LinearScale;
  plot: Rect;
  orientation: ChartOrientation;
  strokeWidth: number;
}

export function buildAreaMarks(input: AreaMarkInput): PathMark[] {
  const { grid, band, value, orientation, strokeWidth } = input;
  const baseline = r2(value(0));
  const marks: PathMark[] = [];

  for (let si = 0; si < grid.series.length; si++) {
    const points = seriesPoints(grid, si, band, value, orientation);
    if (points.length === 0) continue;

    // 끊김 기준으로 subpath 분할
    const runs: Array<Array<(typeof points)[number]>> = [];
    let current: Array<(typeof points)[number]> = [];
    for (const p of points) {
      if (p.gapBefore && current.length > 0) {
        runs.push(current);
        current = [];
      }
      current.push(p);
    }
    if (current.length > 0) runs.push(current);

    let d = "";
    for (const run of runs) {
      const first = run[0];
      const last = run[run.length - 1];
      if (orientation === "horizontal") {
        d += `${d ? " " : ""}M ${baseline} ${first.y}`;
        for (const p of run) d += ` L ${p.x} ${p.y}`;
        d += ` L ${baseline} ${last.y} Z`;
      } else {
        d += `${d ? " " : ""}M ${first.x} ${baseline}`;
        for (const p of run) d += ` L ${p.x} ${p.y}`;
        d += ` L ${last.x} ${baseline} Z`;
      }
    }

    const bbox = bboxOf(points);
    // baseline 까지 닫히므로 bbox 도 baseline 을 포함해야 한다 (R9 — 컬링 상위집합).
    const extended: Rect =
      orientation === "horizontal"
        ? (() => {
            const left = Math.min(bbox.x, baseline);
            const right = Math.max(bbox.x + bbox.w, baseline);
            return { x: r2(left), y: bbox.y, w: r2(right - left), h: bbox.h };
          })()
        : (() => {
            const top = Math.min(bbox.y, baseline);
            const bottom = Math.max(bbox.y + bbox.h, baseline);
            return { x: bbox.x, y: r2(top), w: bbox.w, h: r2(bottom - top) };
          })();

    marks.push({
      kind: "path",
      d,
      bbox: extended,
      fillSeries: grid.series[si].seriesIndex,
      strokeSeries: grid.series[si].seriesIndex,
      strokeWidth,
    });
  }

  return marks;
}
