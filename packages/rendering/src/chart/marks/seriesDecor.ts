/**
 * ADR-306 Phase 6 — 시리즈 종류 (line · area · bar) 의 주석 · 손익 색 · 예측 파선을 한 번에. **두 consumer
 * 가 같이 부른다** (Canvas `computeChartScene` · DOM `RechartsChart`) — 같은 격자 · 스케일 · 입력이면
 * 같은 마크다. 선 · 면을 나눌 때는 이 builder 가 시리즈 path 를 직접 만든다 (`buildLineMarks` ·
 * `buildAreaMarks` — scene 과 같은 함수 · 같은 입력) — DOM 은 Recharts 선 · 면을 숨기고 이것을 그린다.
 */
import type { BandScale, LinearScale } from "../scales";
import type { SeriesGrid, StackMode } from "../series";
import type { ChartProps, Mark, PathMark, Rect } from "../types";
import { seriesHighlight } from "../highlightGrid";
import {
  annotationAxis,
  buildAnnotationMarks,
  forecastAt,
  forecastFrom,
  isAnnotatedType,
  resolveAnnotations,
  signBaseline,
  signColorsOn,
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
    | "valueLocale"
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
  /** scene 이 이미 만든 시리즈 path (같은 builder) — 없으면 나눠 칠할 때 여기서 만든다 (DOM). */
  paths?: SeriesPaths;
}

/** 시리즈 path 와 그 격자 시리즈 자리 (`LineMarks` · `AreaMarks` 의 앞 두 칸). */
export interface SeriesPaths {
  marks: readonly PathMark[];
  seriesOf: readonly number[];
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
  return seriesHighlight(props.highlight, grid, "first");
}

/** 겹치기 선 · 면의 시리즈 path — scene 과 같은 builder · 같은 입력 (값 레이블은 쓰지 않는다). */
function seriesPaths(input: SeriesDecorInput): SeriesPaths {
  const { props, grid, band, value, plot } = input;
  const common = {
    grid,
    band,
    value,
    plot,
    orientation: props.orientation,
    strokeWidth: input.strokeWidth,
    curve: props.curve,
    showValueLabels: false,
    labelText: () => "",
    connectNulls: props.connectNulls === true,
  };
  return props.chartType === "line"
    ? buildLineMarks({ ...common, fontSize: input.fontSize })
    : buildAreaMarks({ ...common, stackMode: "none" });
}

export function buildSeriesDecor(input: SeriesDecorInput): SeriesDecorMarks {
  const { props, grid, band, value, plot, stackMode } = input;
  const t = props.chartType;
  if (!isAnnotatedType(t)) return EMPTY;
  const list = resolveAnnotations(props.annotations);
  const signOn = signColorsOn(props, stackMode);
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
  const xf = t === "bar" ? null : forecastAt(axis, forecastFrom(list));
  // 나눌 것 (예측 · 손익 색) 이 있을 때만 시리즈 path 를 쓴다 — 누적은 나누지 않는다 (`signColorsOn` ·
  //   `styleSeriesMarks`). scene 은 이미 만든 path 를 넘기고, DOM 은 여기서 한 번 만든다 (같은 builder ·
  //   같은 입력).
  if (stackMode === "none" && (xf !== null || signOn)) {
    const built = input.paths ?? seriesPaths(input);
    const styled = styleSeriesMarks({
      marks: built.marks.map((mark, k) => ({ mark, si: built.seriesOf[k] })),
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
