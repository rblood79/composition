/**
 * ADR-306 Phase 0 — ztd-charts 0.5.0 의 항목 · encoding 채널 · 옵션 key (외부 oracle).
 *
 * 출처: https://github.com/Junhan2/ztd-charts `3c4376cda61361d630ae4cc7bd472af64ba30d2e` (MIT)
 *   `packages/ztd-charts/src/spec/registry.ts` (COMMON_OPTIONS · ENTRIES 의 options) ·
 *   `spec/meta.ts` (CHANNELS). 원본 소스 텍스트에서 이름만 옮겼다 — 이 파일은 손으로 고치지 않는다.
 *   분류는 `ztdCoverage.fixture.ts` 가 따로 적는다 (분류가 key 목록을 만들지 않게 두 파일로 나눈다).
 *   ztd 를 의존성으로 두지 않는다 (ADR-306 Hard constraints).
 */
export const ZTD_COMMON_OPTIONS = [
  "height",
  "width",
  "highlight",
  "format",
  "unit",
  "locale",
  "animate",
  "duration",
  "easing",
  "stagger",
  "reducedMotion",
  "animateOnView",
  "showLabels",
  "tooltip",
  "syncId",
  "ariaLabel",
  "description",
] as const;

export const ZTD_REGISTRY: Record<
  string,
  { channels: readonly string[]; options: readonly string[] }
> = {
  pie: {
    channels: ["label", "value"],
    options: ["colorMode", "sort", "startAngle", "labelMode"],
  },
  donut: {
    channels: ["label", "value"],
    options: ["innerRadius", "centerValue", "centerLabel", "legend", "sort"],
  },
  funnel: {
    channels: ["label", "value"],
    options: ["showRates", "rateBase", "rateLabel"],
  },
  waffle: {
    channels: ["label", "value"],
    options: [
      "cells",
      "columns",
      "total",
      "summary",
      "summaryLabel",
      "summaryNote",
    ],
  },
  treemap: {
    channels: ["label", "value", "group"],
    options: ["path", "labelMode", "sort"],
  },
  sunburst: {
    channels: ["label", "value", "group"],
    options: ["path", "sort", "hole"],
  },
  waterfall: {
    channels: ["label", "value", "type"],
    options: ["startTotal", "endTotal", "connectors"],
  },
  pareto: {
    channels: ["label", "value"],
    options: ["threshold", "sort", "rankLabels"],
  },
  marimekko: { channels: ["x", "series", "value"], options: [] },
  heatmap: {
    channels: ["x", "y", "value"],
    options: ["showValues", "legend", "legendLabels", "canvasThreshold"],
  },
  radar: {
    channels: ["axis", "value", "series"],
    options: ["max", "levels", "circular"],
  },
  bubble: {
    channels: ["x", "y", "size", "label"],
    options: [
      "sizeRange",
      "xLabel",
      "yLabel",
      "zero",
      "maxLabels",
      "canvasThreshold",
      "xFormat",
    ],
  },
  line: {
    channels: ["x", "y", "series", "lower", "upper"],
    options: [
      "curve",
      "xType",
      "dots",
      "area",
      "zero",
      "endLabels",
      "colorMode",
      "yDomain",
      "maxPoints",
      "referenceLines",
      "yLabel",
      "brush",
      "annotations",
      "signColors",
      "baseline",
      "downColor",
      "bandFrom",
      "outside",
      "connectNulls",
    ],
  },
  area: {
    channels: ["x", "y", "series", "lower", "upper"],
    options: [
      "stack",
      "curve",
      "xType",
      "zero",
      "endLabels",
      "yDomain",
      "maxPoints",
      "brush",
      "annotations",
      "signColors",
      "baseline",
      "downColor",
      "bandFrom",
      "outside",
      "connectNulls",
    ],
  },
  stream: {
    channels: ["x", "y", "series"],
    options: ["offset", "reorder", "curve", "xType"],
  },
  bar: {
    channels: ["x", "y", "series"],
    options: ["layout", "orientation", "sort", "annotations"],
  },
  radialBar: { channels: ["label", "value"], options: ["max", "sweep"] },
  gauge: {
    channels: ["value", "target"],
    options: ["min", "max", "label", "variant", "bands", "ticks"],
  },
  bullet: {
    channels: ["label", "value", "target"],
    options: ["ranges", "independent"],
  },
  sparkline: {
    channels: ["x", "y"],
    options: ["variant", "showValue", "showExtremes", "mark"],
  },
  slope: {
    channels: ["label", "x", "value"],
    options: ["start", "end", "periodLabels"],
  },
  dumbbell: {
    channels: ["label", "start", "end"],
    options: ["labels", "sort", "zero"],
  },
  lollipop: { channels: ["label", "value"], options: ["orientation", "sort"] },
  beeswarm: {
    channels: ["value", "group", "label"],
    options: ["radius", "showMedian", "canvasThreshold"],
  },
  ridgeline: {
    channels: ["group", "value"],
    options: ["overlap", "bandwidth", "sort"],
  },
  sankey: {
    channels: ["source", "target", "value"],
    options: ["nodeWidth", "nodePadding"],
  },
  chord: { channels: ["source", "target", "value"], options: ["padAngle"] },
  calendar: {
    channels: ["date", "value"],
    options: ["weekStart", "gap", "canvasThreshold"],
  },
  bump: { channels: ["x", "series", "rank", "value"], options: [] },
  box: {
    channels: ["group", "value"],
    options: ["variant", "outliers", "zero", "whiskers"],
  },
  parallel: {
    channels: ["label"],
    options: ["dimensions", "dimensionLabels", "invert", "canvasThreshold"],
  },
  candlestick: {
    channels: ["x", "open", "high", "low", "close", "volume"],
    options: [
      "ma",
      "upColor",
      "downColor",
      "maxCandles",
      "brush",
      "yDomain",
      "annotations",
    ],
  },
  segmented: {
    channels: ["label", "value"],
    options: ["variant", "sort", "list"],
  },
  skyline: {
    channels: ["x", "y", "series", "front"],
    options: ["depth", "wall", "texture", "frontRate"],
  },
  histogram: {
    channels: ["value", "group", "x0", "x1", "count"],
    options: [
      "variant",
      "marks",
      "threshold",
      "edges",
      "binWidth",
      "bins",
      "log",
      "kde",
    ],
  },
  scatter: {
    channels: ["x", "y", "series", "label"],
    options: [
      "xLabel",
      "yLabel",
      "zero",
      "maxLabels",
      "canvasThreshold",
      "xFormat",
      "hidden",
      "fit",
      "refLines",
      "quadrants",
      "jitter",
    ],
  },
};
