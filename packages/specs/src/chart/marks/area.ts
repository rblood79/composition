/**
 * ADR-194 — area 마크 = 위 경계선과 아래 경계선을 닫은 띠.
 *
 * 아래 경계는 누적 여부로 갈린다: 비누적이면 값 축의 0(baseline), 누적이면 앞
 * 시리즈까지의 누적합이다. 비누적 area 를 여러 시리즈에 쓰면 뒤 시리즈가 앞을
 * 가리므로 shadcn 의 `stacked` / `stacked-expand` 는 사실상 누적 전용이다.
 *
 * 위·아래 경계는 **같은 보간**을 쓴다 (위는 정방향, 아래는 역방향) — 한쪽만
 * 곡선이면 띠 두께가 데이터와 다른 자리에서 벌어진다.
 *
 * 값이 끊긴 구간은 line 과 같이 subpath 를 나눈다 — 이어 채우면 없는 데이터 위에
 * 면이 생긴다. 각 subpath 가 자기 위/아래 경계로 닫히므로 `fillRule` 은 기본
 * nonzero 로 충분하다.
 */
import { curveCommands, toScreen } from "../curves";
import type { AxialPoint, ScreenPoint } from "../curves";
import { r2 } from "../scales";
import type { LinearScale, BandScale } from "../scales";
import { stackRangesBySeries } from "../series";
import type { SeriesGrid, StackMode } from "../series";
import type { ChartCurve, ChartOrientation, PathMark, Rect } from "../types";
import { bandCenter, bboxOf, splitRuns } from "./line";

export interface AreaMarkInput {
  grid: SeriesGrid;
  band: BandScale;
  value: LinearScale;
  plot: Rect;
  orientation: ChartOrientation;
  strokeWidth: number;
  stackMode: StackMode;
  curve: ChartCurve;
}

export interface AreaMarks {
  marks: PathMark[];
  /** 시리즈별 위 경계 화면 좌표 — 점 표시(dots)가 여기 찍힌다. */
  upper: ScreenPoint[][];
}

interface AreaBand {
  categoryIndex: number;
  upper: AxialPoint;
  lower: AxialPoint;
}

export function buildAreaMarks(input: AreaMarkInput): AreaMarks {
  const { grid, band, value, orientation, strokeWidth, stackMode, curve } =
    input;
  const baseline = r2(value(0));
  const ranges =
    stackMode === "none" ? null : stackRangesBySeries(grid, stackMode);
  const marks: PathMark[] = [];
  const upperPoints: ScreenPoint[][] = [];

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
          upper: { along, across: value(range.to) },
          lower: { along, across: value(range.from) },
        });
        continue;
      }
      const v = series.values.get(ci);
      if (v === undefined) continue;
      bands.push({
        categoryIndex: ci,
        upper: { along, across: value(v) },
        lower: { along, across: baseline },
      });
    }

    if (bands.length === 0) {
      upperPoints.push([]);
      continue;
    }

    const d = splitRuns(bands)
      .map((run) => {
        const upper = run.map((b) => b.upper);
        const lower = run.map((b) => b.lower).reverse();
        return `${curveCommands(upper, curve, orientation, true)}${curveCommands(
          lower,
          curve,
          orientation,
          false,
        )} Z`;
      })
      .join(" ");

    const outline: ScreenPoint[] = [];
    for (const b of bands) {
      outline.push(toScreen(orientation, b.upper), toScreen(orientation, b.lower));
    }

    marks.push({
      kind: "path",
      d,
      // 위/아래 경계를 모두 포함한 bbox — 컬링은 상위집합이어야 한다 (R9).
      //   monotone 은 구간 안에서 단조라 끝점 범위를 넘지 않고, step 도 마찬가지다.
      bbox: bboxOf(outline),
      fillSeries: series.seriesIndex,
      strokeSeries: series.seriesIndex,
      strokeWidth,
    });
    upperPoints.push(bands.map((b) => toScreen(orientation, b.upper)));
  }

  return { marks, upper: upperPoints };
}
