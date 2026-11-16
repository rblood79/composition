/**
 * ADR-306 Phase 6 — 시리즈 종류 (line · area · bar) 의 주석 · 손익 색 · 예측 파선을 한 번에. **두 consumer
 * 가 같이 부른다** (Canvas `computeChartScene` · DOM `RechartsChart`) — 같은 격자 · 스케일 · 입력이면
 * 같은 마크다. 선 · 면을 나눌 때는 이 builder 가 시리즈 path 를 직접 만든다 (`buildLineMarks` ·
 * `buildAreaMarks` — scene 과 같은 함수 · 같은 입력) — DOM 은 Recharts 선 · 면을 숨기고 이것을 그린다.
 */
import type { BandScale, LinearScale } from "../scales";
import type { SeriesGrid, StackMode } from "../series";
import { seriesLabel } from "../series";
import type { ChartProps, Mark, Rect } from "../types";
import { resolveHighlight } from "../highlight";
import {
  annotationAxis,
  buildAnnotationMarks,
  forecastAt,
  forecastFrom,
  resolveAnnotations,
  signBaseline,
} from "./annotations";
import { buildAreaMarks } from "./area";
import { buildLineMarks, seriesAxialPoints } from "./line";
import { styleSeriesMarks } from "./seriesStyle";

export interface SeriesDecorInput {
  props: Pick<
    ChartProps,
    | "chartType"
    | "orientation"
    | "curve"
    | "connectNulls"
    | "annotations"
    | "highlight"
    | "signColors"
    | "baseline"
    | "dimensionFormat"
  >;
  grid: SeriesGrid;
  band: BandScale;
  value: LinearScale;
  plot: Rect;
  stackMode: StackMode;
  /** 시간 축이면 epoch → 범주 축 좌표 (`resolveCategoryBand` 의 `timeAxis.scale`). */
  timeScale: LinearScale | null;
  fontSize: number;
  strokeWidth: number;
}

export interface SeriesDecorMarks {
  /** 시리즈 마크 아래 (격자 위) — 구간 · 예측 · 주말 음영 · 손익 기준선. */
  under: Mark[];
  /** 시리즈 path 를 대신할 것 (나눠 칠한 선 · 면) — null 이면 시리즈 그대로. */
  series: Mark[] | null;
  /** 시리즈 마크 위 — 사건 · 예측 경계 · 추세선 · 이름. */
  over: Mark[];
}

const EMPTY: SeriesDecorMarks = { under: [], series: null, over: [] };

/** 손익 색 · 추세선이 고르는 시리즈 — `highlight`, 비면 첫 시리즈 (ztd line 기본). */
export function primarySeries(
  props: Pick<ChartProps, "highlight">,
  grid: SeriesGrid,
): Set<number> {
  const names = grid.series.map((s) => seriesLabel(s, "series"));
  const totals = grid.series.map((s) => {
    let t = 0;
    for (const v of s.values.values()) if (Number.isFinite(v)) t += v;
    return t;
  });
  return resolveHighlight(props.highlight, names, totals, "first");
}

export function buildSeriesDecor(input: SeriesDecorInput): SeriesDecorMarks {
  const { props, grid, band, value, plot, stackMode } = input;
  const t = props.chartType;
  if (t !== "line" && t !== "area" && t !== "bar") return EMPTY;
  const list = resolveAnnotations(props.annotations);
  const signOn = props.signColors === true && t !== "bar";
  if (list.length === 0 && !signOn) return EMPTY;
  const horizontal = props.orientation === "horizontal";
  const axis = annotationAxis({
    categories: grid.categories,
    band,
    range: horizontal ? [plot.y, plot.y + plot.h] : [plot.x, plot.x + plot.w],
    positions: grid.positions,
    timeScale: input.timeScale,
    props,
  });
  const primary = primarySeries(props, grid);
  const first = [...primary][0];
  const trendPoints =
    first === undefined ? [] : seriesAxialPoints(grid, first, band, value);
  const notes = buildAnnotationMarks({
    list,
    axis,
    value,
    plot,
    orientation: props.orientation,
    fontSize: input.fontSize,
    trendPoints,
    edge: t === "bar",
  });
  let series: Mark[] | null = null;
  const under = [...notes.under];
  // 누적은 나누지 않는다 (`styleSeriesMarks` 가 null) — 시리즈 path 를 만들지 않는다.
  if (t !== "bar" && stackMode === "none") {
    const xf = forecastAt(axis, forecastFrom(list));
    // 시리즈마다 따로 만든다 — 마크와 격자 자리를 짝짓는다 (겹치기에서는 시리즈 path 가 서로 독립이라
    //   한꺼번에 만든 scene 의 path 와 같다).
    const paths = grid.series.flatMap((_, si) => {
      const one = { ...grid, series: [grid.series[si]] };
      const marks =
        t === "line"
          ? buildLineMarks({
              grid: one,
              band,
              value,
              plot,
              orientation: props.orientation,
              strokeWidth: input.strokeWidth,
              curve: props.curve,
              showValueLabels: false,
              labelText: () => "",
              fontSize: input.fontSize,
              connectNulls: props.connectNulls === true,
            }).marks
          : buildAreaMarks({
              grid: one,
              band,
              value,
              plot,
              orientation: props.orientation,
              strokeWidth: input.strokeWidth,
              stackMode,
              curve: props.curve,
              showValueLabels: false,
              labelText: () => "",
              connectNulls: props.connectNulls === true,
            }).marks;
      return marks.map((mark) => ({ mark, si }));
    });
    const styled = styleSeriesMarks({
      marks: paths,
      grid,
      value,
      plot,
      orientation: props.orientation,
      stackMode,
      forecastAt: xf,
      signSeries: signOn ? primary : new Set(),
      baseline: signBaseline(props),
    });
    if (styled) {
      series = styled.marks;
      under.push(...styled.under);
    }
  }
  return { under, series, over: notes.over };
}
