/**
 * ADR-194 — bar 마크. dodged(나란히) / stacked(누적) × vertical / horizontal.
 *
 * 막대는 `RectMark` 다 — path 로 만들 수도 있지만, Skia 가 rect 를 직접 그리는
 * 경로(`RectShape`)가 이미 있고 DOM 도 `<rect>` 가 있어 양쪽 다 path 파싱을
 * 건너뛴다. 좌표는 같은 기하가 낸 같은 숫자다.
 */
import { r2 } from "../scales";
import type { LinearScale, BandScale } from "../scales";
import { stackBands } from "../series";
import type { SeriesGrid } from "../series";
import type { ChartOrientation, Rect, RectMark } from "../types";

export interface BarMarkInput {
  grid: SeriesGrid;
  band: BandScale;
  value: LinearScale;
  plot: Rect;
  orientation: ChartOrientation;
  stacked: boolean;
}

function rect(
  orientation: ChartOrientation,
  bandStart: number,
  bandSize: number,
  valueFrom: number,
  valueTo: number,
  seriesIndex: number,
): RectMark {
  const lo = Math.min(valueFrom, valueTo);
  const hi = Math.max(valueFrom, valueTo);
  if (orientation === "horizontal") {
    return {
      kind: "rect",
      x: r2(lo),
      y: r2(bandStart),
      w: r2(hi - lo),
      h: r2(bandSize),
      seriesIndex,
    };
  }
  return {
    kind: "rect",
    x: r2(bandStart),
    y: r2(lo),
    w: r2(bandSize),
    h: r2(hi - lo),
    seriesIndex,
  };
}

export function buildBarMarks(input: BarMarkInput): RectMark[] {
  const { grid, band, value, orientation, stacked } = input;
  const marks: RectMark[] = [];
  const zero = value(0);

  for (let ci = 0; ci < grid.categories.length; ci++) {
    if (stacked) {
      for (const { series, from, to } of stackBands(grid, ci)) {
        marks.push(
          rect(
            orientation,
            band.at(ci),
            band.bandwidth,
            value(from),
            value(to),
            series.seriesIndex,
          ),
        );
      }
      continue;
    }

    // dodged — 밴드를 시리즈 수로 균등 분할. 값이 없는 시리즈도 자리는 차지한다
    //   (자리를 접으면 같은 범주가 시리즈 유무에 따라 다른 폭이 돼 축이 흔들린다).
    const n = Math.max(1, grid.series.length);
    const slot = band.bandwidth / n;
    for (let si = 0; si < grid.series.length; si++) {
      const series = grid.series[si];
      const v = series.values.get(ci);
      if (v === undefined) continue;
      marks.push(
        rect(
          orientation,
          band.at(ci) + slot * si,
          slot,
          zero,
          value(v),
          series.seriesIndex,
        ),
      );
    }
  }

  return marks;
}
