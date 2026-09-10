/**
 * ADR-194 — 차트 기하 SSOT 배럴.
 *
 * `packages/specs` 에 사는 이유: workspace 의존이 shared→specs 단방향이라
 * (`packages/shared/package.json`, specs 는 shared 미의존) Skia primitive 가 사는
 * specs 에 두어야 shared 의 DOM 렌더러가 import 할 수 있다. shared 에 두면
 * skiaPrimitives → shared 가 순환이 된다 (review round 1 h1).
 */
export * from "./types";
export * from "./authoring";
export * from "./runtimeData";
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
export {
  buildSeriesGrid,
  seriesLabel,
  stackBands,
  stackRangesBySeries,
  valueExtent,
} from "./series";
export type {
  SeriesData,
  SeriesGrid,
  SeriesGridProps,
  StackMode,
  StackRange,
} from "./series";
export {
  CHART_AGGREGATE_SUFFIX,
  CHART_AUTO_NUMBER_FORMAT,
  CHART_BUDGET_AGGREGATES,
  CHART_BUDGET_AXES,
  CHART_BUDGET_OVERFLOWS,
  CHART_OTHERS_LABEL,
  CHART_CURRENCY_CANDIDATES,
  CHART_SERIES_TOKEN_PREFIX,
  formatChartNumber,
  isSupportedCurrency,
  parseSeriesIdentity,
  resolveChartPresentation,
  seriesIdentity,
  seriesTokenIndex,
  seriesTokenName,
} from "./presentation";
export type {
  ChartNumberContext,
  ChartSeriesSource,
  ResolvedBudgetSettings,
  ResolvedChartPresentation,
  ResolvedNumberFormat,
  ResolvedSeriesConfig,
} from "./presentation";
export { buildBarMarks } from "./marks/bar";
export type { BarMarks } from "./marks/bar";
export {
  bandCenter,
  buildLineMarks,
  seriesAxialPoints,
  seriesPoints,
  splitRuns,
} from "./marks/line";
export type { AxialSeriesPoint, LineMarks, SeriesPoint } from "./marks/line";
export { buildAreaMarks } from "./marks/area";
export type { AreaMarks } from "./marks/area";
export { buildDotMarks, circlePath, dotRadius } from "./marks/dots";
export {
  buildWindowTrackMarks,
  CHART_WINDOW_THUMB,
  CHART_WINDOW_TRACK_BAR,
} from "./marks/windowTrack";
export { curveCommands, monotoneTangents, toScreen } from "./curves";
export type { AxialPoint, ScreenPoint } from "./curves";
export {
  angleScale,
  circlePathAt,
  polarPoint,
  polygonPath,
  radiusScale,
} from "./polar";
export type { AngleScale, PolarPoint, RadiusScale } from "./polar";
export {
  buildPolarAxes,
  polarLabelAnchor,
  polarLabelStride,
} from "./polarAxes";
export type { PolarAxesInput, PolarCenter } from "./polarAxes";
export {
  arcPath,
  arcSlicePath,
  buildPieMarks,
  centerTotalLabels,
} from "./marks/pie";
export { buildRadarMarks } from "./marks/radar";
export { buildRadialMarks } from "./marks/radial";
export type { RadialMarkInput, RadialMarks, RadialRing } from "./marks/radial";
export type { RadarMarkInput, RadarMarks } from "./marks/radar";
export type { PieHit, PieMarks } from "./marks/pie";
export { buildAxes, labelStride } from "./axes";
export {
  buildBandTooltip,
  buildPolarBandTooltip,
  buildRadialTooltip,
  buildRingTooltip,
  hitTooltipBand,
} from "./tooltip";
export type { LegendEntry } from "./legend";
export type { TooltipValueFormatter } from "./tooltip";
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
  CHART_INVALID_SETTINGS_TEXT,
  CHART_TICK_COUNT,
  computeChartScene,
  resolveChartLayout,
  resolveChartMetrics,
  skiaTextAnchorX,
  toSkiaTextGeometry,
} from "./computeChartScene";
export type {
  ChartLayout,
  ChartRuleChannel,
  SkiaTextGeometry,
} from "./computeChartScene";
// ADR-211 — 표시 예산 · 모델 층
export {
  CHART_BUDGET_DEFAULTS,
  CHART_OTHERS_COLOR_INDEX,
  CHART_OTHERS_FALLBACK_TOKEN,
  CHART_OTHERS_KEY,
  aggregateBuckets,
  applyBudget,
  applyWindow,
  bucketBounds,
  bucketLabel,
  categoryColorIndex,
  groupOthers,
  parseIsoStrict,
  pickCategories,
  resolveAxisKind,
  selectExtrema,
  supportsBudgetMode,
  budgetSweep,
  capRows,
  clampWindowStart,
  defaultBudgetMode,
  markFactor,
  mergeBudgetMetrics,
  polarGeometry,
  resolveDisplayBudget,
  resolveFitEff,
  slotFit,
} from "./budget";
export type {
  AppliedBudget,
  ChartAxisKind,
  ChartBudgetGeometry,
  ChartBudgetMetrics,
  ChartBudgetMode,
  ExtremaSelection,
  ExtremaStep,
  OthersResult,
  ChartWindow,
  DisplayBudget,
  DisplayBudgetInput,
} from "./budget";
export { resolveChartModel } from "./model";
export type { ChartModel, ChartModelView } from "./model";
