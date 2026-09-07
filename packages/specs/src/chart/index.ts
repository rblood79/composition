/**
 * ADR-194 — 차트 기하 SSOT 배럴.
 *
 * `packages/specs` 에 사는 이유: workspace 의존이 shared→specs 단방향이라
 * (`packages/shared/package.json`, specs 는 shared 미의존) Skia primitive 가 사는
 * specs 에 두어야 shared 의 DOM 렌더러가 import 할 수 있다. shared 에 두면
 * skiaPrimitives → shared 가 순환이 된다 (review round 1 h1).
 */
export * from "./types";
export {
  approxTextWidth,
  bandScale,
  formatTick,
  linearScale,
  niceTicks,
  r2,
  toFiniteNumber,
} from "./scales";
export type { BandScale, LinearScale, TickResult } from "./scales";
export { buildSeriesGrid, stackBands, valueExtent } from "./series";
export type { SeriesData, SeriesGrid } from "./series";
export { buildBarMarks } from "./marks/bar";
export { bandCenter, buildLineMarks, seriesPoints } from "./marks/line";
export { buildAreaMarks } from "./marks/area";
export { arcPath, buildPieMarks } from "./marks/pie";
export { buildAxes, labelStride } from "./axes";
export {
  buildLegend,
  legendExtent,
  legendItemWidth,
  LEGEND_GAP,
  LEGEND_ITEM_GAP,
  LEGEND_SWATCH,
} from "./legend";
export {
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
  CHART_DEFAULT_SERIES_COUNT,
  CHART_SAMPLE_ROWS,
  CHART_TICK_COUNT,
  computeChartScene,
  resolveChartMetrics,
} from "./computeChartScene";
export type { ChartRuleChannel } from "./computeChartScene";
