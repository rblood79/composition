/**
 * ADR-306 Phase 3 — category family 공용 조각: 상태 scene · 행 예산 · 값 축 · 범주 라벨 · 범례.
 * family 마다 축 자리를 스스로 정하므로 (breakdown §4.2) 시리즈 경로의 `axes.ts` 를 쓰지 않는다.
 */
import { chartBrushMode, chartSyncGroup } from "../../authoring";
import { chartFrame, type ChartFrame } from "../../frame";
import { approxTextWidth, linearScale, r2 } from "../../scales";
import {
  CHART_INVALID_SETTINGS_TEXT,
  CHART_NO_DATA_TEXT,
  chartEmptyScene,
} from "../../sceneStates";
import type {
  AxisScene,
  ChartMetrics,
  ChartProps,
  ChartRow,
  ChartScene,
  ChartSize,
  ChartSort,
  ChartTarget,
  LegendScene,
  LineMark,
  Mark,
  Rect,
  TextMark,
} from "../../types";
import { placeLegend } from "../../legend";
import { familyInput, type FamilyInput } from "../fields";
import { thinCentered } from "../shapes";
import { ticksFor } from "../niceScale";

export interface CategoryContext {
  props: ChartProps;
  rows: readonly ChartRow[];
  frame: ChartFrame;
  metrics: ChartMetrics;
  input: FamilyInput;
}

/**
 * 프레임 + 입력 + 행 상한 (`rowCap` — 넘으면 앞 행만 + `budget.rowsTruncated`). `capRows: false` 는
 * 원본 전체를 모델에 넣는다 — 분포 통계 · 칸 합계는 잘린 표본으로 내지 않고 (breakdown §4.2) 그리는
 * 요소 수만 종류마다 줄인다 (ADR-306 Phase 4 — distribution · matrix family 도 이 공용 조각을 쓴다).
 */
export function categoryContext(
  props: ChartProps,
  rows: readonly ChartRow[],
  size: ChartSize,
  metrics: ChartMetrics,
  capRows = true,
): CategoryContext {
  const input = familyInput(props);
  let capped = rows;
  if (capRows && rows.length > metrics.rowCap) {
    capped = rows.slice(0, metrics.rowCap);
    input.warning(
      "budget.rowsTruncated",
      `showing the first ${metrics.rowCap} rows`,
      String(rows.length),
    );
  }
  return {
    props,
    rows: capped,
    frame: chartFrame(size, metrics),
    metrics,
    input,
  };
}

export function invalidScene(ctx: CategoryContext): ChartScene {
  return chartEmptyScene(
    ctx.frame.size,
    ctx.frame.outer,
    CHART_INVALID_SETTINGS_TEXT,
    ctx.input.diagnostics,
  );
}

export function noDataScene(ctx: CategoryContext): ChartScene {
  return chartEmptyScene(
    ctx.frame.size,
    ctx.frame.outer,
    CHART_NO_DATA_TEXT,
    ctx.input.diagnostics,
  );
}

/** 그려지는 줄이 모자라 앞 항목만 낼 때의 진단. */
export function truncated(ctx: CategoryContext, shown: number, total: number) {
  if (shown < total)
    ctx.input.warning(
      "budget.rowsTruncated",
      `showing ${shown} of ${total} rows`,
      String(total),
    );
}

export function sceneOf(
  ctx: CategoryContext,
  parts: {
    marks: Mark[];
    axes?: AxisScene[];
    legend?: LegendScene | null;
    targets?: ChartTarget[];
  },
): ChartScene {
  return {
    size: ctx.frame.size,
    plot: ctx.frame.outer,
    marks: parts.marks,
    axes: parts.axes ?? [],
    legend: parts.legend ?? null,
    tooltip: null,
    empty: false,
    // ADR-306 Phase 6 — 범위 선택 · 동기화도 targets 를 읽는다 (툴팁 상자는 host 가 `showTooltip` 으로 가른다).
    targets:
      ctx.props.showTooltip ||
      chartBrushMode(ctx.props) !== null ||
      chartSyncGroup(ctx.props) !== ""
        ? (parts.targets ?? [])
        : [],
    ...(ctx.input.diagnostics.length > 0
      ? { diagnostics: ctx.input.diagnostics }
      : {}),
  };
}

export const SORTS: readonly ChartSort[] = ["none", "ascending", "descending"];

export function sortOf(props: ChartProps, fallback: ChartSort): ChartSort {
  return SORTS.includes(props.sort as ChartSort)
    ? (props.sort as ChartSort)
    : fallback;
}

/** 값으로 정렬 (none 은 그대로 — 결측은 0 자리). */
export function sortByValue<T extends { value: number }>(
  items: readonly T[],
  sort: ChartSort,
): T[] {
  if (sort === "none") return [...items];
  return [...items].sort((a, b) =>
    sort === "descending"
      ? (b.value || 0) - (a.value || 0)
      : (a.value || 0) - (b.value || 0),
  );
}

export function argMax(values: readonly number[]): number {
  let best = -1;
  let bv = -Infinity;
  values.forEach((v, i) => {
    if (Number.isFinite(v) && v > bv) {
      bv = v;
      best = i;
    }
  });
  return best;
}

export function argMin(values: readonly number[]): number {
  let best = -1;
  let bv = Infinity;
  values.forEach((v, i) => {
    if (Number.isFinite(v) && v < bv) {
      bv = v;
      best = i;
    }
  });
  return best;
}

export function finiteExtent(values: readonly number[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return Number.isFinite(lo) ? [lo, hi] : [0, 1];
}

/** 값 축 눈금 글자 열의 폭 (왼쪽 축). */
export function tickColumnWidth(
  ticks: readonly number[],
  format: (v: number) => string,
  fontSize: number,
): number {
  return (
    Math.max(...ticks.map((t) => approxTextWidth(format(t), fontSize)), 8) + 8
  );
}

/**
 * 세로 값 축 — 가로 격자선 + 왼쪽 눈금 글자. `x0` 은 그림 영역 왼쪽, 글자는 그 왼쪽에 끝 정렬.
 */
export function valueAxisY(
  ctx: CategoryContext,
  domain: readonly [number, number],
  ticks: readonly number[],
  y: (v: number) => number,
  x0: number,
  x1: number,
  format: (v: number) => string = ctx.input.formatValue,
): AxisScene {
  const grid: LineMark[] = [];
  const marks: TextMark[] = [];
  for (const t of ticks) {
    if (t < Math.min(domain[0], domain[1]) - 1e-9) continue;
    if (t > Math.max(domain[0], domain[1]) + 1e-9) continue;
    const ty = r2(y(t));
    if (ctx.props.showGrid !== false)
      grid.push({
        kind: "line",
        x1: r2(x0),
        y1: ty,
        x2: r2(x1),
        y2: ty,
        role: "grid",
      });
    marks.push({
      kind: "text",
      x: r2(x0 - 6),
      y: ty,
      text: format(t),
      anchor: "end",
      baseline: "middle",
      role: "tick",
    });
  }
  return { axis: "y", line: null, grid, ticks: marks };
}

/** 가로 값 축 — 세로 격자선 + 아래 눈금 글자. */
export function valueAxisX(
  ctx: CategoryContext,
  domain: readonly [number, number],
  x: (v: number) => number,
  y0: number,
  y1: number,
  count: number,
): AxisScene {
  const grid: LineMark[] = [];
  const marks: TextMark[] = [];
  for (const t of ticksFor(domain[0], domain[1], count)) {
    const tx = r2(x(t));
    if (ctx.props.showGrid !== false)
      grid.push({
        kind: "line",
        x1: tx,
        y1: r2(y0),
        x2: tx,
        y2: r2(y1),
        role: "grid",
      });
    marks.push({
      kind: "text",
      x: tx,
      y: r2(y1 + ctx.frame.fontSize * 0.5 + 5),
      text: ctx.input.formatValue(t),
      anchor: "middle",
      baseline: "middle",
      role: "tick",
    });
  }
  return { axis: "x", line: null, grid, ticks: marks };
}

/** 아래 범주 라벨 (가운데 정렬 · 겹치면 솎는다). */
export function categoryLabels(
  ctx: CategoryContext,
  labels: readonly string[],
  centers: readonly number[],
  y: number,
): AxisScene {
  const marks: TextMark[] = labels.map((text, i) => ({
    kind: "text",
    x: r2(centers[i]),
    y: r2(y),
    text,
    anchor: "middle",
    baseline: "middle",
    role: "tick",
  }));
  return {
    axis: "x",
    line: null,
    grid: [],
    ticks: thinCentered(marks, ctx.frame.fontSize),
  };
}

/**
 * 시리즈 범례 — 팔레트 색 견본 + 이름을 범례 자리 (`legendPosition`) 에 놓고, 남은 그림 영역을 frame 으로 단
 * context 를 돌려준다 (시리즈 경로와 같은 배치 — `placeLegend`). 끄면 · 항목이 없으면 그대로.
 */
export function seriesLegend(
  ctx: CategoryContext,
  items: readonly { label: string; seriesIndex: number }[],
): { legend: LegendScene | null; ctx: CategoryContext } {
  if (!ctx.props.showLegend || items.length === 0)
    return { legend: null, ctx };
  const { legend, plot } = placeLegend({
    entries: items.map((item) => ({
      label: item.label,
      colorIndex: item.seriesIndex,
    })),
    outer: ctx.frame.outer,
    position: ctx.props.legendPosition,
    fontSize: ctx.frame.fontSize,
  });
  return { legend, ctx: withPlot(ctx, plot) };
}

/** 범례를 뗀 뒤의 그림 영역을 frame 으로 단 context — scene 의 `plot` 도 이 영역이다. */
export function withPlot(ctx: CategoryContext, outer: Rect): CategoryContext {
  return outer === ctx.frame.outer
    ? ctx
    : { ...ctx, frame: { ...ctx.frame, outer } };
}

/** 범주 band — 칸 수 · 칸 안 막대 비율 (ztd `scaleBand(paddingInner, paddingOuter)`). */
export function bandLayout(
  count: number,
  from: number,
  to: number,
  paddingInner: number,
  paddingOuter: number,
): { at: (i: number) => number; bandwidth: number; step: number } {
  const n = Math.max(1, count);
  const step = (to - from) / Math.max(1, n - paddingInner + paddingOuter * 2);
  const bandwidth = step * (1 - paddingInner);
  const start = from + step * paddingOuter;
  return {
    at: (i) => start + step * i,
    bandwidth,
    step,
  };
}

/** 균등 배치 x (점이 n 개 — 1 개면 가운데). */
export function evenX(
  n: number,
  x0: number,
  x1: number,
): (k: number) => number {
  return (k) => (n > 1 ? x0 + (k / (n - 1)) * (x1 - x0) : (x0 + x1) / 2);
}

export { linearScale };
