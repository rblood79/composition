/**
 * ADR-306 Phase 0 — ztd-charts 0.5.0 의 채널 · 옵션 key 전부를 세 갈래 (+ 사용자 결정 1) 로 분류한다
 * (breakdown §3). key 목록은 `ztdRegistry.pinned.ts` (원본 텍스트에서 옮긴 외부 oracle) 이고, 이
 * 파일은 분류만 적는다 — 분류되지 않은 key · 없는 key 의 분류는 `ztdCoverage.test.ts` 가 막는다.
 *
 * - adopt: 종류를 정의하는 것 (encoding 채널 전부 · 데이터의 뜻이나 형태를 바꾸는 옵션) → Chart prop
 * - map: 같은 일을 하는 기존 prop · 기구가 있다
 * - exclude: ztd runtime 고유 기구 — 종류의 정의가 아니다
 * - decision: 공통 상호작용 (사용자 결정 1 — Phase 6 에 포함)
 *
 * `provided` 는 ztd 항목 → composition 의 chartType · family (breakdown §2). family `null` = 기존 type.
 */
import type { ChartType } from "../types";

export type ZtdClass =
  | { kind: "adopt"; props: readonly string[] }
  | { kind: "map"; to: string }
  | { kind: "exclude"; reason: string }
  | { kind: "decision" };

const A = (...props: string[]): ZtdClass => ({ kind: "adopt", props });
const M = (to: string): ZtdClass => ({ kind: "map", to });
const X = (reason: string): ZtdClass => ({ kind: "exclude", reason });
const D: ZtdClass = { kind: "decision" };

export type ChartFamilyId =
  "category" | "kpi" | "distribution" | "matrix" | "network";

export interface ZtdEntryClass {
  /** 기존 type 은 그 값, 새 type 은 Phase 2 이후 `ChartType` 에 더해질 값. */
  chartType: ChartType | NewChartType;
  family: ChartFamilyId | null;
  channels: Record<string, ZtdClass>;
  options: Record<string, ZtdClass>;
}

/** breakdown §2.2 — Phase 2 가 `CHART_TYPES` 에 더한다. */
export type NewChartType =
  | "lollipop"
  | "segmented"
  | "waffle"
  | "funnel"
  | "pareto"
  | "waterfall"
  | "sparkline"
  | "marimekko"
  | "stream"
  | "bump"
  | "slope"
  | "skyline"
  | "gauge"
  | "bullet"
  | "dumbbell"
  | "histogram"
  | "box"
  | "beeswarm"
  | "ridgeline"
  | "heatmap"
  | "calendar"
  | "candlestick"
  | "parallel"
  | "treemap"
  | "sunburst"
  | "sankey"
  | "chord";

const RUNTIME_BUDGET = X("표시 예산 (ADR-211 rowCap · markBudget) 이 맡는다");
const CANVAS_SWITCH = X(
  "ztd 의 SVG→canvas 전환 기구 — Canvas 는 Skia scene 이 맡는다",
);
const AXIS_TITLE = M("seriesConfig label · 축 제목");
const VALUE_RANGE = A("valueMin", "valueMax");
const ZERO = A("includeZero");

export const ZTD_COMMON_CLASS: Record<string, ZtdClass> = {
  height: M("Layout height (aspect-ratio 16/9 기본 — ADR-306 F9)"),
  width: M("Layout width"),
  highlight: D,
  format: M("valueFormat (ADR-210)"),
  unit: M("valueFormat 계열 (valuePercentUnit · valueCurrency)"),
  locale: M("valueLocale"),
  animate: M("isAnimationActive"),
  duration: M("animationDuration"),
  easing: M("animationEasing (spring 은 제외)"),
  stagger: X("ztd 의 종류별 순차 등장 — 재현하지 않는다 (breakdown §5.3)"),
  reducedMotion: M("prefers-reduced-motion (host 가 끈다 — breakdown §5.3)"),
  animateOnView: X("viewport 진입 재생 — ztd runtime 기구"),
  showLabels: M("showValueLabels"),
  tooltip: M("showTooltip"),
  syncId: D,
  ariaLabel: M("aria-label"),
  description: X("자동 설명 문장 — ztd runtime 기구 (Decision 8)"),
};

const LABEL_VALUE = { label: A("dimension"), value: A("metric") };
const SIGN_DECISION = {
  brush: D,
  annotations: D,
  signColors: D,
  baseline: D,
  downColor: D,
  bandFrom: D,
  outside: D,
};
const LINE_AREA_CHANNELS = {
  x: A("dimension"),
  y: A("metric", "valueFields"),
  series: A("color"),
  lower: A("lowerFields"),
  upper: A("upperFields"),
};

export const ZTD_CLASS: Record<string, ZtdEntryClass> = {
  pie: {
    chartType: "pie",
    family: null,
    channels: LABEL_VALUE,
    options: {
      colorMode: M("colorBy"),
      sort: A("sort"),
      startAngle: M("startAngle"),
      labelMode: M("labelKey"),
    },
  },
  donut: {
    chartType: "pie",
    family: null,
    channels: LABEL_VALUE,
    options: {
      innerRadius: M("innerRadius"),
      centerValue: M("showTotal"),
      centerLabel: A("centerLabel"),
      legend: M("showLegend · legendPosition"),
      sort: A("sort"),
    },
  },
  funnel: {
    chartType: "funnel",
    family: "category",
    channels: LABEL_VALUE,
    options: {
      showRates: A("showRates"),
      rateBase: A("rateBase"),
      rateLabel: A("rateLabel"),
    },
  },
  waffle: {
    chartType: "waffle",
    family: "category",
    channels: LABEL_VALUE,
    options: {
      cells: A("cells"),
      columns: A("columns"),
      total: A("valueMax"),
      summary: M("showTotal"),
      summaryLabel: A("centerLabel"),
      summaryNote: X("ChartCard 류 보조 문장 — 페이지의 Text 로 둔다"),
    },
  },
  treemap: {
    chartType: "treemap",
    family: "network",
    channels: {
      label: A("pathFields"),
      value: A("metric"),
      group: A("pathFields"),
    },
    options: {
      path: A("pathFields"),
      labelMode: M("labelKey"),
      sort: A("sort"),
    },
  },
  sunburst: {
    chartType: "sunburst",
    family: "network",
    channels: {
      label: A("pathFields"),
      value: A("metric"),
      group: A("pathFields"),
    },
    options: { path: A("pathFields"), sort: A("sort"), hole: M("innerRadius") },
  },
  waterfall: {
    chartType: "waterfall",
    family: "category",
    channels: { ...LABEL_VALUE, type: A("kindField") },
    options: {
      startTotal: A("startTotal"),
      endTotal: A("endTotal"),
      connectors: A("connectors"),
    },
  },
  pareto: {
    chartType: "pareto",
    family: "category",
    channels: LABEL_VALUE,
    options: {
      threshold: A("threshold"),
      sort: A("sort"),
      rankLabels: A("rankLabels"),
    },
  },
  marimekko: {
    chartType: "marimekko",
    family: "category",
    channels: { x: A("dimension"), series: A("color"), value: A("metric") },
    options: {},
  },
  heatmap: {
    chartType: "heatmap",
    family: "matrix",
    channels: { x: A("dimension"), y: A("rowField"), value: A("metric") },
    options: {
      showValues: M("showValueLabels"),
      legend: M("showLegend"),
      legendLabels: A("legendLabels"),
      canvasThreshold: CANVAS_SWITCH,
    },
  },
  radar: {
    chartType: "radar",
    family: null,
    channels: {
      axis: A("dimension"),
      value: A("metric", "valueFields"),
      series: A("color"),
    },
    options: {
      max: A("valueMax"),
      levels: M("gridRings"),
      circular: M("gridType"),
    },
  },
  bubble: {
    chartType: "scatter",
    family: null,
    channels: {
      x: A("dimension"),
      y: A("metric"),
      size: A("sizeField"),
      label: A("labelField"),
    },
    options: {
      sizeRange: A("sizeRange"),
      xLabel: AXIS_TITLE,
      yLabel: AXIS_TITLE,
      zero: ZERO,
      maxLabels: RUNTIME_BUDGET,
      canvasThreshold: CANVAS_SWITCH,
      xFormat: M("dimensionFormat"),
    },
  },
  line: {
    chartType: "line",
    family: null,
    channels: LINE_AREA_CHANNELS,
    options: {
      curve: M("curve"),
      xType: M("dimensionScale (ADR-216)"),
      dots: M("showDots"),
      area: M("fillArea"),
      zero: ZERO,
      endLabels: A("endLabels"),
      colorMode: M("colorBy"),
      yDomain: VALUE_RANGE,
      maxPoints: RUNTIME_BUDGET,
      referenceLines: M("referenceLines (ADR-217)"),
      yLabel: AXIS_TITLE,
      ...SIGN_DECISION,
      connectNulls: A("connectNulls"),
    },
  },
  area: {
    chartType: "area",
    family: null,
    channels: LINE_AREA_CHANNELS,
    options: {
      stack: M("stackType"),
      curve: M("curve"),
      xType: M("dimensionScale (ADR-216)"),
      zero: ZERO,
      endLabels: A("endLabels"),
      yDomain: VALUE_RANGE,
      maxPoints: RUNTIME_BUDGET,
      ...SIGN_DECISION,
      connectNulls: A("connectNulls"),
    },
  },
  stream: {
    chartType: "stream",
    family: "category",
    channels: {
      x: A("dimension"),
      y: A("metric", "valueFields"),
      series: A("color"),
    },
    options: {
      offset: A("offset"),
      reorder: A("reorder"),
      curve: M("curve"),
      xType: M("dimensionScale (ADR-216)"),
    },
  },
  bar: {
    chartType: "bar",
    family: null,
    channels: {
      x: A("dimension"),
      y: A("metric", "valueFields"),
      series: A("color"),
    },
    options: {
      layout: M("stackType"),
      orientation: M("orientation"),
      sort: A("sort"),
      annotations: D,
    },
  },
  radialBar: {
    chartType: "radial",
    family: null,
    channels: LABEL_VALUE,
    options: { max: A("valueMax"), sweep: M("startAngle · endAngle") },
  },
  gauge: {
    chartType: "gauge",
    family: "kpi",
    channels: { value: A("metric"), target: A("goalField") },
    options: {
      min: A("valueMin"),
      max: A("valueMax"),
      label: A("centerLabel"),
      variant: A("shape"),
      bands: A("bands"),
      ticks: X("눈금 수는 상자 크기로 정한다 (ztd 기본 동작) — 별도 prop 없음"),
    },
  },
  bullet: {
    chartType: "bullet",
    family: "kpi",
    channels: { ...LABEL_VALUE, target: A("goalField") },
    options: { ranges: A("rangeFields"), independent: A("independent") },
  },
  sparkline: {
    chartType: "sparkline",
    family: "category",
    channels: { x: A("dimension"), y: A("metric") },
    options: {
      variant: A("shape"),
      showValue: M("showTotal"),
      showExtremes: A("showExtremes"),
      mark: D,
    },
  },
  slope: {
    chartType: "slope",
    family: "category",
    channels: { label: A("color"), x: A("dimension"), value: A("metric") },
    options: {
      start: A("valueFields"),
      end: A("valueFields"),
      periodLabels: A("periodLabels"),
    },
  },
  dumbbell: {
    chartType: "dumbbell",
    family: "kpi",
    channels: {
      label: A("dimension"),
      start: A("startField"),
      end: A("endField"),
    },
    options: { labels: AXIS_TITLE, sort: A("sort"), zero: ZERO },
  },
  lollipop: {
    chartType: "lollipop",
    family: "category",
    channels: LABEL_VALUE,
    options: { orientation: M("orientation"), sort: A("sort") },
  },
  beeswarm: {
    chartType: "beeswarm",
    family: "distribution",
    channels: {
      value: A("metric"),
      group: A("dimension"),
      label: A("labelField"),
    },
    options: {
      radius: A("dotRadius"),
      showMedian: A("showMedian"),
      canvasThreshold: CANVAS_SWITCH,
    },
  },
  ridgeline: {
    chartType: "ridgeline",
    family: "distribution",
    channels: { group: A("dimension"), value: A("metric") },
    options: {
      overlap: A("overlap"),
      bandwidth: A("bandwidth"),
      sort: A("sort"),
    },
  },
  sankey: {
    chartType: "sankey",
    family: "network",
    channels: {
      source: A("sourceField"),
      target: A("targetField"),
      value: A("metric"),
    },
    options: { nodeWidth: A("nodeWidth"), nodePadding: A("nodePadding") },
  },
  chord: {
    chartType: "chord",
    family: "network",
    channels: {
      source: A("sourceField"),
      target: A("targetField"),
      value: A("metric"),
    },
    options: { padAngle: A("padAngle") },
  },
  calendar: {
    chartType: "calendar",
    family: "matrix",
    channels: { date: A("dimension"), value: A("metric") },
    options: {
      weekStart: A("weekStart"),
      gap: A("cellGap"),
      canvasThreshold: CANVAS_SWITCH,
    },
  },
  bump: {
    chartType: "bump",
    family: "category",
    channels: {
      x: A("dimension"),
      series: A("color"),
      rank: A("rankField"),
      value: A("metric"),
    },
    options: {},
  },
  box: {
    chartType: "box",
    family: "distribution",
    channels: { group: A("dimension"), value: A("metric") },
    options: {
      variant: A("shape"),
      outliers: A("outliers"),
      zero: ZERO,
      whiskers: A("whiskers"),
    },
  },
  parallel: {
    chartType: "parallel",
    family: "matrix",
    channels: { label: A("labelField") },
    options: {
      dimensions: A("valueFields"),
      dimensionLabels: AXIS_TITLE,
      invert: A("invertFields"),
      canvasThreshold: CANVAS_SWITCH,
    },
  },
  candlestick: {
    chartType: "candlestick",
    family: "matrix",
    channels: {
      x: A("dimension"),
      open: A("openField"),
      high: A("highField"),
      low: A("lowField"),
      close: A("closeField"),
      volume: A("volumeField"),
    },
    options: {
      ma: A("movingAverages"),
      upColor: M("paint 역할 accent (breakdown §5.1)"),
      downColor: M("paint 역할 neutral (breakdown §5.1)"),
      maxCandles: RUNTIME_BUDGET,
      brush: D,
      yDomain: VALUE_RANGE,
      annotations: D,
    },
  },
  segmented: {
    chartType: "segmented",
    family: "category",
    channels: LABEL_VALUE,
    options: { variant: A("shape"), sort: A("sort"), list: M("showLegend") },
  },
  skyline: {
    chartType: "skyline",
    family: "category",
    channels: {
      x: A("dimension"),
      y: A("metric", "valueFields"),
      series: A("color"),
      front: A("frontFields"),
    },
    options: {
      depth: A("depth"),
      wall: A("wall"),
      texture: A("texture"),
      frontRate: A("frontRate"),
    },
  },
  histogram: {
    chartType: "histogram",
    family: "distribution",
    channels: {
      value: A("metric"),
      group: A("color"),
      x0: A("binStartField"),
      x1: A("binEndField"),
      count: A("countField"),
    },
    options: {
      variant: A("shape"),
      marks: A("percentiles"),
      threshold: A("threshold"),
      edges: A("edges"),
      binWidth: A("binWidth"),
      bins: A("bins"),
      log: A("log"),
      kde: A("kde"),
    },
  },
  scatter: {
    chartType: "scatter",
    family: null,
    channels: {
      x: A("dimension"),
      y: A("metric"),
      series: A("color"),
      label: A("labelField"),
    },
    options: {
      xLabel: AXIS_TITLE,
      yLabel: AXIS_TITLE,
      zero: ZERO,
      maxLabels: RUNTIME_BUDGET,
      canvasThreshold: CANVAS_SWITCH,
      xFormat: M("dimensionFormat"),
      hidden: X("ztd 의 계열 숨김 상태 — 범례 토글 runtime 기구"),
      fit: A("fit"),
      refLines: M("referenceLines (ADR-217)"),
      quadrants: A("quadrants"),
      jitter: X("겹침 흩뿌림 — 값 위치를 바꾸는 runtime 기구"),
    },
  },
};
