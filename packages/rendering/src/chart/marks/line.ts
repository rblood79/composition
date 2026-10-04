/**
 * ADR-194 — line 마크. linear / monotone / step 보간 (curves.ts) × vertical / horizontal.
 *
 * 값이 없는 범주에서 선을 **끊는다** (M 으로 새 subpath). 이어 그으면 없는
 * 데이터를 통과하는 선분이 생겨 사용자가 준 적 없는 추세가 화면에 나온다.
 */
import { curveCommands, toScreen } from "../curves";
import type { AxialPoint, ScreenPoint } from "../curves";
import { r2 } from "../scales";
import type { LinearScale, BandScale } from "../scales";
import type { SeriesGrid } from "../series";
import type {
  ChartLabelFormatter,
  ChartCurve,
  ChartOrientation,
  PathMark,
  Rect,
  TextMark,
} from "../types";

export interface LineMarkInput {
  grid: SeriesGrid;
  band: BandScale;
  value: LinearScale;
  plot: Rect;
  orientation: ChartOrientation;
  strokeWidth: number;
  curve: ChartCurve;
  showValueLabels: boolean;
  /** 레이블 텍스트 생성기 (값/범주명 판정은 `computeChartScene`) */
  labelText: ChartLabelFormatter;
  fontSize: number;
}

export interface LineMarks {
  marks: PathMark[];
  labels: TextMark[];
}

/** 범주 i 의 밴드 중앙 (선/영역의 꼭짓점 위치). */
export function bandCenter(band: BandScale, index: number): number {
  return band.at(index) + band.bandwidth / 2;
}

export type SeriesPoint = ScreenPoint;

/** 범주 축 위의 한 점 — 보간은 이 좌표계에서 한다 (curves.ts §머리말). */
export interface AxialSeriesPoint extends AxialPoint {
  categoryIndex: number;
  /** 원래 데이터 값 — 값 레이블이 읽는다 (스케일 적용 전) */
  raw: number;
}

/** 한 시리즈의 (있는 값만) 점 목록. 없는 범주는 아예 빠진다. */
export function seriesAxialPoints(
  grid: SeriesGrid,
  seriesIdx: number,
  band: BandScale,
  value: LinearScale,
): AxialSeriesPoint[] {
  const series = grid.series[seriesIdx];
  const points: AxialSeriesPoint[] = [];
  for (let ci = 0; ci < grid.categories.length; ci++) {
    const v = series.values.get(ci);
    if (v === undefined) continue;
    points.push({
      categoryIndex: ci,
      along: bandCenter(band, ci),
      across: value(v),
      raw: v,
    });
  }
  return points;
}

/** 범주 인덱스가 끊긴 자리에서 subpath 를 나눈다. */
export function splitRuns<T extends { categoryIndex: number }>(
  points: readonly T[],
): T[][] {
  const runs: T[][] = [];
  let current: T[] = [];
  for (const point of points) {
    const previous = current[current.length - 1];
    if (previous && point.categoryIndex !== previous.categoryIndex + 1) {
      runs.push(current);
      current = [];
    }
    current.push(point);
  }
  if (current.length > 0) runs.push(current);
  return runs;
}

/** 화면 좌표 + 끊김 표시 — 외부 소비자용 (기하 내부는 axial 을 쓴다). */
export function seriesPoints(
  grid: SeriesGrid,
  seriesIdx: number,
  band: BandScale,
  value: LinearScale,
  orientation: ChartOrientation,
): Array<SeriesPoint & { gapBefore: boolean }> {
  const axial = seriesAxialPoints(grid, seriesIdx, band, value);
  return axial.map((point, i) => ({
    ...toScreen(orientation, point),
    gapBefore: i > 0 && point.categoryIndex !== axial[i - 1].categoryIndex + 1,
  }));
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

/**
 * 점 위 값 레이블. 세로 차트는 점 위에, 가로 차트는 점 오른쪽에 둔다 —
 * 값이 커지는 방향 반대쪽에 놓으면 선과 겹친다.
 */
export function pointValueLabel(
  point: ScreenPoint,
  text: string,
  orientation: ChartOrientation,
): TextMark | null {
  if (text === "") return null;
  return orientation === "horizontal"
    ? {
        kind: "text",
        x: r2(point.x + 6),
        y: point.y,
        text,
        anchor: "start",
        baseline: "middle",
        role: "value",
      }
    : {
        kind: "text",
        x: point.x,
        y: r2(point.y - 6),
        text,
        anchor: "middle",
        baseline: "bottom",
        role: "value",
      };
}

export function buildLineMarks(input: LineMarkInput): LineMarks {
  const {
    grid,
    band,
    value,
    orientation,
    strokeWidth,
    curve,
    showValueLabels,
    labelText,
  } = input;
  const marks: PathMark[] = [];
  const labels: TextMark[] = [];
  for (let si = 0; si < grid.series.length; si++) {
    const points = seriesAxialPoints(grid, si, band, value);
    if (points.length === 0) continue;
    const screen = points.map((p) => toScreen(orientation, p));
    // 점 1개면 선이 안 보인다 — 길이 0 의 선분을 round cap 으로 찍어 점을 남긴다.
    const d =
      points.length === 1
        ? `M ${screen[0].x} ${screen[0].y} L ${screen[0].x} ${screen[0].y}`
        : splitRuns(points)
            .map((run) => curveCommands(run, curve, orientation, true))
            .join(" ");
    marks.push({
      kind: "path",
      d,
      bbox: bboxOf(screen),
      strokeSeries: grid.series[si].seriesIndex,
      strokeWidth,
    });
    if (showValueLabels) {
      screen.forEach((point, i) => {
        const label = pointValueLabel(
          point,
          labelText(points[i].categoryIndex, points[i].raw),
          orientation,
        );
        if (label) labels.push(label);
      });
    }
  }
  return { marks, labels };
}
