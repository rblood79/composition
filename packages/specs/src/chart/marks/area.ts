/**
 * ADR-194 — area 마크 = 위 경계선과 아래 경계선을 닫은 띠.
 *
 * 아래 경계는 누적 여부로 갈린다: 비누적이면 값 축의 0(baseline), 누적이면 앞
 * 시리즈까지의 누적합이다. 비누적 area 를 여러 시리즈에 쓰면 뒤 시리즈가 앞을
 * 가리므로 shadcn 의 `stacked` / `stacked-expand` 는 사실상 누적 전용이다.
 *
 * 값이 끊긴 구간은 line 과 같이 subpath 를 나눈다 — 이어 채우면 없는 데이터 위에
 * 면이 생긴다. 각 subpath 가 자기 위/아래 경계로 닫히므로 `fillRule` 은 기본
 * nonzero 로 충분하다.
 */
import { r2 } from "../scales";
import type { LinearScale, BandScale } from "../scales";
import { stackRangesBySeries } from "../series";
import type { SeriesGrid, StackMode } from "../series";
import type { ChartOrientation, PathMark, Rect } from "../types";
import { bandCenter, bboxOf } from "./line";
import type { SeriesPoint } from "./line";

export interface AreaMarkInput {
  grid: SeriesGrid;
  band: BandScale;
  value: LinearScale;
  plot: Rect;
  orientation: ChartOrientation;
  strokeWidth: number;
  stackMode: StackMode;
}

/** 범주 축 위치(along) + 값 축 위치(across) → 화면 좌표. */
function toPoint(
  orientation: ChartOrientation,
  along: number,
  across: number,
): SeriesPoint {
  return orientation === "horizontal"
    ? { x: r2(across), y: r2(along) }
    : { x: r2(along), y: r2(across) };
}

interface AreaBand {
  categoryIndex: number;
  upper: SeriesPoint;
  lower: SeriesPoint;
}

function runPath(run: readonly AreaBand[]): string {
  let d = `M ${run[0].upper.x} ${run[0].upper.y}`;
  for (let i = 1; i < run.length; i++) {
    d += ` L ${run[i].upper.x} ${run[i].upper.y}`;
  }
  for (let i = run.length - 1; i >= 0; i--) {
    d += ` L ${run[i].lower.x} ${run[i].lower.y}`;
  }
  return `${d} Z`;
}

export function buildAreaMarks(input: AreaMarkInput): PathMark[] {
  const { grid, band, value, orientation, strokeWidth, stackMode } = input;
  const baseline = r2(value(0));
  const ranges =
    stackMode === "none" ? null : stackRangesBySeries(grid, stackMode);
  const marks: PathMark[] = [];

  for (let si = 0; si < grid.series.length; si++) {
    const series = grid.series[si];
    const bands: AreaBand[] = [];

    for (let ci = 0; ci < grid.categories.length; ci++) {
      const along = bandCenter(band, ci);
      if (ranges) {
        const range = ranges[si].get(ci);
        if (range === undefined) continue;
        bands.push({
          categoryIndex: ci,
          upper: toPoint(orientation, along, value(range.to)),
          lower: toPoint(orientation, along, value(range.from)),
        });
        continue;
      }
      const v = series.values.get(ci);
      if (v === undefined) continue;
      bands.push({
        categoryIndex: ci,
        upper: toPoint(orientation, along, value(v)),
        lower: toPoint(orientation, along, baseline),
      });
    }

    if (bands.length === 0) continue;

    // 끊김(범주 인덱스 불연속) 기준으로 subpath 분할
    const runs: AreaBand[][] = [];
    let current: AreaBand[] = [];
    for (const b of bands) {
      const previous = current[current.length - 1];
      if (previous && b.categoryIndex !== previous.categoryIndex + 1) {
        runs.push(current);
        current = [];
      }
      current.push(b);
    }
    if (current.length > 0) runs.push(current);

    const d = runs.map(runPath).join(" ");
    const outline: SeriesPoint[] = [];
    for (const b of bands) {
      outline.push(b.upper, b.lower);
    }

    marks.push({
      kind: "path",
      d,
      // 위/아래 경계를 모두 포함한 bbox — 컬링은 상위집합이어야 한다 (R9).
      bbox: bboxOf(outline),
      fillSeries: series.seriesIndex,
      strokeSeries: series.seriesIndex,
      strokeWidth,
    });
  }

  return marks;
}
