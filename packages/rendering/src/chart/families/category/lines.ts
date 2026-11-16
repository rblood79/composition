/**
 * ADR-306 Phase 3 — category family 의 선 · 흐름 종류 4: sparkline · stream · bump · slope.
 * 뜻은 ztd-charts 0.5.0 (`3c4376c`, MIT — `src/charts/{sparkline,stream,bump,slope}.tsx`) 을 따른다.
 * stream · bump 는 시리즈 격자 (`buildSeriesGrid` — 같은 (범주, 시리즈) 는 합산) 를 지난다
 * (breakdown §4.2 — category family 만 격자를 쓴다).
 */
import { highlightColor, highlightIndex, highlightSet } from "../../highlight";
import { curveCommands } from "../../curves";
import { circlePath } from "../../marks/dots";
import { approxTextWidth, linearScale, r2 } from "../../scales";
import { buildSeriesGrid, seriesLabel, seriesTotals } from "../../series";
import type {
  AxisScene,
  ChartCurve,
  ChartTarget,
  LineMark,
  Mark,
  PathMark,
  TextMark,
} from "../../types";
import { fieldKey, readLabel, readNumber, requireField } from "../fields";
import { fitDomain } from "../niceScale";
import {
  dodgeVertical,
  fitText,
  insideOut,
  ranks,
  roundRectPath,
  stack,
} from "../shapes";
import {
  argMax,
  argMin,
  categoryLabels,
  evenX,
  finiteExtent,
  invalidScene,
  noDataScene,
  sceneOf,
  seriesLegend,
  truncated,
  type CategoryContext,
} from "./common";

const CURVES: readonly ChartCurve[] = ["linear", "monotone", "step"];

// ── sparkline ──────────────────────────────────────────────────────────────

export interface SparklineModel {
  labels: string[];
  values: number[];
  rows: number[];
  /** 마지막 숫자 값의 인덱스 (-1 = 없음) */
  last: number;
  /** ADR-306 Phase 6 — 표시 점 (`highlight`, 비면 `last`; −1 = 없음). */
  mark: number;
}

export function sparklineModel(ctx: CategoryContext): SparklineModel | null {
  const { props, rows, input } = ctx;
  const metric = requireField(input, "Value", props.metric);
  const dimension = fieldKey(props.dimension);
  if (!input.ok || metric === null) return null;
  const values = rows.map((row) => readNumber(row, metric));
  let last = values.length - 1;
  while (last >= 0 && !Number.isFinite(values[last])) last--;
  return {
    labels: rows.map((row, i) =>
      dimension === null ? String(i + 1) : readLabel(row, dimension),
    ),
    values,
    rows: rows.map((_, i) => i),
    last,
    // ADR-306 Phase 6 — 표시 점 (ztd sparkline `mark` → `highlight`: last · max · min · none · 이름). 비면 마지막.
    mark: highlightIndex(
      ctx.props.highlight,
      rows.map((row, i) =>
        dimension === null ? String(i + 1) : readLabel(row, dimension),
      ),
      values,
      last,
    ),
  };
}

export function sparklineScene(ctx: CategoryContext) {
  const model = sparklineModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  if (model.last < 0 || outer.w <= 0 || outer.h <= 0) return noDataScene(ctx);
  const { props, input } = ctx;
  const shape =
    props.shape === "line" || props.shape === "bar" ? props.shape : "area";
  const vals = model.values;
  const n = vals.length;
  const valText =
    props.showTotal !== false ? input.formatValue(vals[model.last]) : "";
  const valScale = 1.2;
  const valW = valText ? approxTextWidth(valText, fontSize * valScale) + 10 : 0;
  const x0 = outer.x + 2;
  const x1 = Math.max(x0 + 1, outer.x + outer.w - valW - 4);
  const [mn, mx] = finiteExtent(vals);
  const domain: [number, number] =
    shape === "bar"
      ? [Math.min(0, mn), Math.max(0, mx) || (mn < 0 ? 0 : 1)]
      : [mn, mx === mn ? mn + 1 : mx];
  const y = linearScale(domain, [outer.y + outer.h - 4, outer.y + 5]);
  const xs = evenX(n, x0, x1);
  // 예산 — 2px 에 점 하나보다 촘촘하면 묶음마다 대표 하나 (마지막 · 0 에서 먼 값).
  const per = Math.max(1, Math.ceil(n / Math.max(1, (x1 - x0) / 2)));
  let idx = vals
    .map((v, k) => (Number.isFinite(v) ? k : -1))
    .filter((k) => k >= 0);
  if (per > 1) {
    const out: number[] = [];
    let best = -1;
    let group = -1;
    for (const k of idx) {
      const g = Math.floor(k / per);
      if (g !== group) {
        if (best >= 0) out.push(best);
        group = g;
        best = k;
      } else if (
        k === model.mark ||
        (best !== model.mark && Math.abs(vals[k]) > Math.abs(vals[best]))
      )
        best = k;
    }
    if (best >= 0) out.push(best);
    idx = out;
  }
  const marks: Mark[] = [];
  const bbox = { x: r2(x0), y: outer.y, w: r2(x1 - x0), h: outer.h };
  if (shape === "bar") {
    const bw = Math.max(1, ((x1 - x0) / Math.max(1, n)) * per * 0.7);
    const y0 = y(0);
    for (const k of idx) {
      const yy = y(vals[k]);
      const bx =
        per > 1
          ? xs(Math.min(n - 1, (Math.floor(k / per) + 0.5) * per - 0.5))
          : xs(k);
      marks.push({
        kind: "path",
        d: roundRectPath(
          bx - bw / 2,
          Math.min(yy, y0),
          bw,
          Math.max(0.5, Math.abs(y0 - yy)),
          1.5,
        ),
        bbox: {
          x: r2(bx - bw / 2),
          y: r2(Math.min(yy, y0)),
          w: r2(bw),
          h: r2(Math.abs(y0 - yy)),
        },
        fillPaint: k === model.mark ? "accent" : "neutral",
      });
    }
  } else {
    const points = idx.map((k) => ({ along: xs(k), across: y(vals[k]) }));
    const line = curveCommands(points, "monotone", "vertical", true);
    if (shape === "area" && points.length > 1) {
      const floor = r2(outer.y + outer.h - 2);
      marks.push({
        kind: "path",
        d: `${line} L ${r2(points[points.length - 1].along)} ${floor} L ${r2(points[0].along)} ${floor} Z`,
        bbox,
        fillPaint: "accent",
        fillOpacity: 0.18,
      });
    }
    marks.push({
      kind: "path",
      d: line,
      bbox,
      strokePaint: "accent",
      strokeWidth: 1.8,
    });
  }
  if (props.showExtremes && n > 2)
    for (const k of [argMax(vals), argMin(vals)]) {
      if (k < 0) continue;
      const cx = r2(xs(k));
      const cy = r2(y(vals[k]));
      marks.push({
        kind: "path",
        d: circlePath(cx, cy, 2.4),
        bbox: { x: r2(cx - 2.4), y: r2(cy - 2.4), w: 4.8, h: 4.8 },
        role: "axis",
        strokeWidth: 1.3,
      });
    }
  if (shape !== "bar" && model.mark >= 0 && Number.isFinite(vals[model.mark])) {
    const cx = r2(xs(model.mark));
    const cy = r2(y(vals[model.mark]));
    marks.push({
      kind: "path",
      d: circlePath(cx, cy, 3.2),
      bbox: { x: r2(cx - 3.2), y: r2(cy - 3.2), w: 6.4, h: 6.4 },
      fillPaint: "accent",
    });
  }
  if (valText)
    marks.push({
      kind: "text",
      x: r2(outer.x + outer.w - 2),
      y: r2(outer.y + outer.h / 2),
      text: valText,
      anchor: "end",
      baseline: "middle",
      role: "value",
      fontScale: valScale,
    });
  const step = n > 1 ? (x1 - x0) / (n - 1) : x1 - x0;
  const targets: ChartTarget[] = idx.map((k) => ({
    id: `point-${k}`,
    x: r2(xs(k)),
    y: r2(y(vals[k])),
    rect: {
      x: r2(xs(k) - step / 2),
      y: outer.y,
      w: r2(Math.max(1, step)),
      h: outer.h,
    },
    rows: [model.rows[k]],
    title: model.labels[k],
    entries: [
      { label: "Value", text: input.formatValue(vals[k]), paint: "accent" },
    ],
  }));
  return sceneOf(ctx, { marks, targets });
}

// ── 시리즈 격자 (stream · bump · skyline) ──────────────────────────────────

export interface SeriesTable {
  categories: string[];
  names: string[];
  /** 팔레트 자리 */
  colors: number[];
  /** `[계열][범주]` — 없으면 NaN */
  values: number[][];
}

/**
 * 시리즈 격자 → 표. `metricKey` 로 값 필드를 바꿔 읽을 수 있다 (bump 의 순위 필드). group 모드는
 * `color` 가 시리즈, columns 모드는 `valueFields` 하나하나가 시리즈.
 */
export function seriesTable(
  ctx: CategoryContext,
  metricKey: string | undefined = ctx.props.metric,
): SeriesTable {
  const { props, rows, metrics } = ctx;
  const grid = buildSeriesGrid(
    rows,
    {
      dimension: props.dimension,
      metric: metricKey ?? "",
      color: props.color,
      dataMode: props.dataMode,
      valueFields: props.valueFields,
      seriesConfig: props.seriesConfig,
      chartType: "line",
    },
    metrics.seriesCount,
  );
  const nk = grid.categories.length;
  const names = grid.series.map((s) => seriesLabel(s, "Value"));
  // ADR-306 Phase 6 — `highlight` 를 주면 강조 밖 시리즈는 neutral (others 색 index — stream · skyline 뒷 계열).
  const picked = highlightSet(props.highlight, names, seriesTotals(grid));
  return {
    categories: grid.categories,
    names,
    colors: grid.series.map((s, i) => highlightColor(picked, i, s.seriesIndex)),
    values: grid.series.map((s) =>
      Array.from({ length: nk }, (_, k) => s.values.get(k) ?? NaN),
    ),
  };
}

/** columns 모드인가 (값 필드 목록이 시리즈). */
export function columnsMode(ctx: CategoryContext): boolean {
  return (
    ctx.props.dataMode === "columns" &&
    Array.isArray(ctx.props.valueFields) &&
    ctx.props.valueFields.length > 0
  );
}

/** 범주가 예산보다 많으면 구간 평균으로 줄인다 (층마다 같은 구간). */
function bucket(table: SeriesTable, budget: number): SeriesTable {
  const nk = table.categories.length;
  if (nk <= budget) return table;
  const per = Math.ceil(nk / budget);
  const groups = Math.ceil(nk / per);
  const mean = (row: readonly number[], g: number) => {
    const part = row.slice(g * per, (g + 1) * per).filter(Number.isFinite);
    return part.length ? part.reduce((a, b) => a + b, 0) / part.length : NaN;
  };
  return {
    ...table,
    categories: Array.from(
      { length: groups },
      (_, g) => table.categories[g * per],
    ),
    values: table.values.map((row) =>
      Array.from({ length: groups }, (_, g) => mean(row, g)),
    ),
  };
}

// ── stream ─────────────────────────────────────────────────────────────────

export interface StreamModel {
  table: SeriesTable;
  /** 그리는 순서 (계열 인덱스) */
  order: number[];
  y0: number[][];
  y1: number[][];
}

export function streamModel(
  ctx: CategoryContext,
  budget = Infinity,
): StreamModel | null {
  const { props, input } = ctx;
  requireField(input, "Category", props.dimension);
  if (!columnsMode(ctx)) requireField(input, "Value", props.metric);
  if (!input.ok) return null;
  const table = bucket(seriesTable(ctx), budget);
  const order =
    props.reorder === false
      ? table.values.map((_, i) => i)
      : insideOut(table.values);
  const st = stack(
    order.map((s) => table.values[s]),
    props.streamOffset === "silhouette" ? "silhouette" : "wiggle",
  );
  return { table, order, y0: st.y0, y1: st.y1 };
}

export function streamScene(ctx: CategoryContext) {
  const { fontSize } = ctx.frame;
  let { outer } = ctx.frame;
  const model = streamModel(ctx, Math.max(40, Math.round(outer.w / 2)));
  if (model === null) return invalidScene(ctx);
  const { table } = model;
  const nk = table.categories.length;
  if (nk === 0 || table.values.length === 0 || outer.w <= 0 || outer.h <= 0)
    return noDataScene(ctx);
  const { props, input } = ctx;
  const placed = seriesLegend(
    ctx,
    table.names.map((label, s) => ({ label, seriesIndex: table.colors[s] })),
  );
  const { legend } = placed;
  ctx = placed.ctx;
  outer = ctx.frame.outer;
  // 범례 쪽 가장자리는 자기 여백 없이 (범례 ↔ 그림 = `LEGEND_CHART_GAP`) — 아래는 범주 글자 아래끝이 경계.
  const top = outer.y + (legend?.position === "top" ? 0 : 4);
  const bottom =
    outer.y +
    outer.h -
    (fontSize + (legend?.position === "bottom" ? 6 : 10));
  const all = [...model.y0.flat(), ...model.y1.flat()];
  const [lo, hi] = finiteExtent(all);
  const y = linearScale([lo, hi === lo ? lo + 1 : hi], [bottom, top]);
  // 처음 · 마지막 범주 이름은 점 위에 가운데 정렬 — 왼쪽 · 오른쪽 범례면 그 이름 끝이 영역 경계에 오도록 안쪽으로
  //   (범례 ↔ 그림 = `LEGEND_CHART_GAP`). 다른 쪽은 지금처럼 4.
  const edgeIn = (side: "left" | "right", label: string | undefined) =>
    legend?.position === side
      ? Math.max(4, approxTextWidth(label ?? "", fontSize) / 2)
      : 4;
  const xs = evenX(
    nk,
    outer.x + edgeIn("left", table.categories[0]),
    outer.x + outer.w - edgeIn("right", table.categories[nk - 1]),
  );
  const curve = CURVES.includes(props.curve) ? props.curve : "monotone";
  const marks: PathMark[] = model.order.map((s, li) => {
    const topPts = model.y1[li].map((v, k) => ({ along: xs(k), across: y(v) }));
    const botPts = model.y0[li]
      .map((v, k) => ({ along: xs(k), across: y(v) }))
      .reverse();
    return {
      kind: "path",
      d: `${curveCommands(topPts, curve, "vertical", true)}${curveCommands(botPts, curve, "vertical", false)} Z`,
      bbox: { x: outer.x, y: r2(top), w: outer.w, h: r2(bottom - top) },
      fillSeries: table.colors[s],
      fillOpacity: 1,
    };
  });
  const step = nk > 1 ? (xs(nk - 1) - xs(0)) / (nk - 1) : outer.w;
  const targets: ChartTarget[] = table.categories.map((label, k) => ({
    id: `col-${k}`,
    x: r2(xs(k)),
    y: r2(Math.min(...model.y1.map((row) => y(row[k])))),
    rect: {
      x: r2(xs(k) - step / 2),
      y: r2(top),
      w: r2(step),
      h: r2(bottom - top),
    },
    rows: [],
    title: label,
    entries: table.names
      .map((name, s) => ({ name, s, v: table.values[s][k] }))
      .filter((e) => Number.isFinite(e.v))
      .sort((a, b) => b.v - a.v)
      .map((e) => ({
        label: e.name,
        text: input.formatValue(e.v),
        series: table.colors[e.s],
      })),
  }));
  const axes: AxisScene[] = [
    categoryLabels(
      ctx,
      table.categories,
      table.categories.map((_, k) => xs(k)),
      bottom + fontSize * 0.5 + 6,
    ),
  ];
  return sceneOf(ctx, { marks, axes, legend, targets });
}

// ── bump ───────────────────────────────────────────────────────────────────

export interface BumpModel {
  categories: string[];
  lines: { name: string; ranks: number[]; hi: boolean }[];
  maxRank: number;
}

export function bumpModel(ctx: CategoryContext): BumpModel | null {
  const { props, input } = ctx;
  requireField(input, "Category", props.dimension);
  requireField(input, "Series", props.color);
  const byRank = fieldKey(props.rankField) !== null;
  if (!byRank) requireField(input, "Value", props.metric);
  if (!input.ok) return null;
  const table = seriesTable(ctx, byRank ? props.rankField : props.metric);
  const nk = table.categories.length;
  const rk = table.values.map(() => new Array<number>(nk).fill(NaN));
  for (let k = 0; k < nk; k++) {
    if (byRank) table.values.forEach((row, s) => (rk[s][k] = row[k]));
    else {
      const col = table.values.map((row) =>
        Number.isFinite(row[k]) ? row[k] : -Infinity,
      );
      const r = ranks(col, true);
      table.values.forEach(
        (row, s) => (rk[s][k] = Number.isFinite(row[k]) ? r[s] : NaN),
      );
    }
  }
  const improve = rk.map((r) => {
    const a = r.find(Number.isFinite) ?? 0;
    const b = [...r].reverse().find(Number.isFinite) ?? 0;
    return a - b;
  });
  const hi = highlightIndex(
    ctx.props.highlight,
    table.names,
    improve,
    argMax(improve),
  );
  return {
    categories: table.categories,
    lines: table.names.map((name, s) => ({ name, ranks: rk[s], hi: s === hi })),
    maxRank: Math.max(table.names.length, ...rk.flat().filter(Number.isFinite)),
  };
}

export function bumpScene(ctx: CategoryContext) {
  const model = bumpModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  const nk = model.categories.length;
  if (nk === 0 || model.lines.length === 0 || outer.w <= 0 || outer.h <= 0)
    return noDataScene(ctx);
  const { props } = ctx;
  const lastRank = (r: readonly number[]) =>
    [...r].reverse().find(Number.isFinite);
  const lw = Math.min(
    outer.w * 0.24,
    Math.max(...model.lines.map((l) => approxTextWidth(l.name, fontSize)), 20) +
      16,
  );
  const rw = Math.min(
    outer.w * 0.26,
    Math.max(
      ...model.lines.map((l) =>
        approxTextWidth(`#${lastRank(l.ranks) ?? ""} ${l.name}`, fontSize),
      ),
      20,
    ) + 16,
  );
  const top = outer.y + fontSize;
  const bottom = outer.y + outer.h - (fontSize + 12);
  const x0 = outer.x + lw;
  const x1 = Math.max(x0 + 1, outer.x + outer.w - rw);
  const xs = evenX(nk, x0, x1);
  const rowH = (bottom - top) / Math.max(1, model.maxRank - 1 || 1);
  const yr = (r: number) => top + (r - 1) * rowH;
  const marks: Mark[] = [];
  const labels: TextMark[] = [];
  const ordered = [...model.lines].sort((a, b) => Number(a.hi) - Number(b.hi));
  for (const l of ordered) {
    const pts = l.ranks
      .map((r, k) => ({ along: xs(k), across: yr(r), ok: Number.isFinite(r) }))
      .filter((p) => p.ok);
    if (pts.length > 1)
      marks.push({
        kind: "path",
        d: curveCommands(pts, "monotone", "vertical", true),
        bbox: { x: r2(x0), y: r2(top), w: r2(x1 - x0), h: r2(bottom - top) },
        strokePaint: l.hi ? "accent" : "neutral",
        strokeWidth: l.hi ? 3.4 : 2,
      });
    const rr = l.hi ? 4.6 : 3.4;
    for (const p of pts)
      marks.push({
        kind: "path",
        d: circlePath(r2(p.along), r2(p.across), rr),
        bbox: {
          x: r2(p.along - rr),
          y: r2(p.across - rr),
          w: rr * 2,
          h: rr * 2,
        },
        fillPaint: l.hi ? "accent" : "neutral",
      });
    // 줄 간격이 글자보다 좁으면 이름 라벨이 포개진다 — 내지 않는다 (툴팁에 남는다).
    if (props.showValueLabels !== false && rowH >= fontSize * 1.1) {
      const r0 = l.ranks.find(Number.isFinite);
      const r1 = lastRank(l.ranks);
      if (r0 !== undefined)
        labels.push({
          kind: "text",
          x: r2(x0 - 10),
          y: r2(yr(r0)),
          text: fitText(l.name, lw - 10, fontSize),
          anchor: "end",
          baseline: "middle",
          role: l.hi ? "legend" : "tick",
        });
      if (r1 !== undefined)
        labels.push({
          kind: "text",
          x: r2(x1 + 10),
          y: r2(yr(r1)),
          text: fitText(`#${r1} ${l.name}`, rw - 10, fontSize),
          anchor: "start",
          baseline: "middle",
          role: l.hi ? "legend" : "tick",
        });
    }
  }
  const step = nk > 1 ? (x1 - x0) / (nk - 1) : x1 - x0;
  const targets: ChartTarget[] = model.categories.map((label, k) => ({
    id: `col-${k}`,
    x: r2(xs(k)),
    y: r2(top),
    rect: {
      x: r2(xs(k) - step / 2),
      y: outer.y,
      w: r2(Math.max(1, step)),
      h: outer.h,
    },
    rows: [],
    title: label,
    entries: model.lines
      .filter((l) => Number.isFinite(l.ranks[k]))
      .sort((a, b) => a.ranks[k] - b.ranks[k])
      .map((l) => ({
        label: l.name,
        text: `#${l.ranks[k]}`,
        paint: l.hi ? ("accent" as const) : ("neutral" as const),
      })),
  }));
  const axes: AxisScene[] = [
    categoryLabels(
      ctx,
      model.categories,
      model.categories.map((_, k) => xs(k)),
      bottom + fontSize * 0.5 + 6,
    ),
  ];
  return sceneOf(ctx, { marks: [...marks, ...labels], axes, targets });
}

// ── slope ──────────────────────────────────────────────────────────────────

export interface SlopeItem {
  label: string;
  a: number;
  b: number;
  rows: number[];
}

export interface SlopeModel {
  items: SlopeItem[];
  periods: [string, string];
  domain: [number, number];
  /** 가장 많이 오른 항목 */
  hi: number;
}

/**
 * group 모드: `dimension` = 시점, `color` = 항목, `metric` = 값 — 첫 시점과 마지막 시점.
 * columns 모드: `dimension` = 항목, `valueFields` 첫 · 끝 = 두 시점.
 */
export function slopeModel(ctx: CategoryContext): SlopeModel | null {
  const { props, rows, input } = ctx;
  const columns = columnsMode(ctx);
  const dimension = requireField(
    input,
    columns ? "Item" : "Period",
    props.dimension,
  );
  let items: SlopeItem[] = [];
  let periods: [string, string] = ["", ""];
  if (columns) {
    const fields = props.valueFields!;
    if (fields.length < 2)
      input.error(
        "role.missing",
        "two value fields are required",
        "valueFields",
      );
    if (!input.ok || dimension === null) return null;
    const a = fieldKey(fields[0]);
    const b = fieldKey(fields[fields.length - 1]);
    items = rows.map((row, i) => ({
      label: readLabel(row, dimension),
      a: readNumber(row, a),
      b: readNumber(row, b),
      rows: [i],
    }));
    periods = [a ?? "", b ?? ""];
  } else {
    const series = requireField(input, "Item", props.color);
    const metric = requireField(input, "Value", props.metric);
    if (!input.ok || dimension === null || series === null || metric === null)
      return null;
    const xs = [...new Set(rows.map((row) => readLabel(row, dimension)))];
    const first = xs[0] ?? "";
    const last = xs[xs.length - 1] ?? "";
    periods = [first, last];
    const map = new Map<string, SlopeItem>();
    rows.forEach((row, i) => {
      const label = readLabel(row, series);
      const at = readLabel(row, dimension);
      let it = map.get(label);
      if (!it) {
        it = { label, a: NaN, b: NaN, rows: [] };
        map.set(label, it);
      }
      if (at === first) {
        it.a = readNumber(row, metric);
        it.rows.push(i);
      }
      if (at === last) {
        it.b = readNumber(row, metric);
        it.rows.push(i);
      }
    });
    items = [...map.values()];
  }
  items = items.filter((it) => Number.isFinite(it.a) && Number.isFinite(it.b));
  const labels = props.periodLabels;
  if (Array.isArray(labels) && labels.length >= 2)
    periods = [String(labels[0]), String(labels[1])];
  const [mn, mx] = finiteExtent(items.flatMap((it) => [it.a, it.b]));
  const diffs = items.map((it) => it.b - it.a);
  return {
    items,
    periods,
    domain: fitDomain(mn, mx, 4, { zero: false, pad: 0.04 }),
    hi: highlightIndex(
      ctx.props.highlight,
      items.map((it) => it.label),
      diffs,
      argMax(diffs),
    ),
  };
}

export function slopeScene(ctx: CategoryContext) {
  const model = slopeModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  if (model.items.length === 0 || outer.w <= 0 || outer.h <= 0)
    return noDataScene(ctx);
  const { props, input } = ctx;
  const fx = input.formatValue;
  const minGap = Math.max(12, fontSize * 1.35);
  const top = outer.y + fontSize * 2.4;
  const bottom = outer.y + outer.h - 10;
  const fit = Math.max(1, Math.floor((bottom - top) / minGap) + 1);
  const items = model.items.slice(0, fit);
  truncated(ctx, items.length, model.items.length);
  const lw = Math.min(
    outer.w * 0.34,
    Math.max(
      ...items.map((it) =>
        approxTextWidth(`${it.label} ${fx(it.a)}`, fontSize),
      ),
      30,
    ) + 16,
  );
  const rw = Math.min(
    outer.w * 0.34,
    Math.max(
      ...items.map((it) =>
        approxTextWidth(`${fx(it.b)} ${it.label}`, fontSize),
      ),
      30,
    ) + 16,
  );
  const xa = r2(outer.x + lw);
  const xb = r2(Math.max(xa + 1, outer.x + outer.w - rw));
  const y = linearScale(model.domain, [bottom, top]);
  const ysL = dodgeVertical(
    items.map((it) => y(it.a)),
    minGap,
    top,
    bottom,
  );
  const ysR = dodgeVertical(
    items.map((it) => y(it.b)),
    minGap,
    top,
    bottom,
  );
  const hiItem = model.items[model.hi];
  const grid: LineMark[] = [
    {
      kind: "line",
      x1: xa,
      y1: r2(top - 4),
      x2: xa,
      y2: r2(bottom),
      role: "grid",
    },
    {
      kind: "line",
      x1: xb,
      y1: r2(top - 4),
      x2: xb,
      y2: r2(bottom),
      role: "grid",
    },
  ];
  const marks: Mark[] = [
    ...grid,
    {
      kind: "text",
      x: xa,
      y: r2(outer.y + fontSize * 0.8),
      text: model.periods[0],
      anchor: "middle",
      baseline: "middle",
      role: "tick",
    },
    {
      kind: "text",
      x: xb,
      y: r2(outer.y + fontSize * 0.8),
      text: model.periods[1],
      anchor: "middle",
      baseline: "middle",
      role: "tick",
    },
  ];
  const labels: TextMark[] = [];
  const ordered = items
    .map((it, k) => ({ it, k }))
    .sort((p, q) => Number(p.it === hiItem) - Number(q.it === hiItem));
  for (const { it } of ordered) {
    const hi = it === hiItem;
    const ya = r2(y(it.a));
    const yb = r2(y(it.b));
    const rr = hi ? 4 : 3;
    marks.push(
      {
        kind: "line",
        x1: xa,
        y1: ya,
        x2: xb,
        y2: yb,
        role: "grid",
        paint: hi ? "accent" : "neutral",
        width: hi ? 2.8 : 1.6,
      },
      {
        kind: "path",
        d: circlePath(xa, ya, rr),
        bbox: { x: r2(xa - rr), y: r2(ya - rr), w: rr * 2, h: rr * 2 },
        fillPaint: hi ? "accent" : "neutral",
      },
      {
        kind: "path",
        d: circlePath(xb, yb, rr),
        bbox: { x: r2(xb - rr), y: r2(yb - rr), w: rr * 2, h: rr * 2 },
        fillPaint: hi ? "accent" : "neutral",
      },
    );
  }
  if (props.showValueLabels !== false)
    items.forEach((it, k) => {
      const role = it === hiItem ? "legend" : "tick";
      labels.push(
        {
          kind: "text",
          x: r2(xa - 9),
          y: ysL[k],
          text: `${fitText(it.label, lw - 10 - approxTextWidth(fx(it.a), fontSize), fontSize)} ${fx(it.a)}`,
          anchor: "end",
          baseline: "middle",
          role,
        },
        {
          kind: "text",
          x: r2(xb + 9),
          y: ysR[k],
          text: `${fx(it.b)} ${fitText(it.label, rw - 10 - approxTextWidth(fx(it.b), fontSize), fontSize)}`,
          anchor: "start",
          baseline: "middle",
          role,
        },
      );
    });
  const targets: ChartTarget[] = items.map((it, k) => {
    const diff = it.b - it.a;
    return {
      id: `item-${k}`,
      x: r2((xa + xb) / 2),
      y: r2((y(it.a) + y(it.b)) / 2),
      r: 12,
      rows: it.rows,
      title: it.label,
      entries: [
        { label: model.periods[0], text: fx(it.a) },
        {
          label: model.periods[1],
          text: fx(it.b),
          paint: it === hiItem ? "accent" : "neutral",
        },
        {
          label: "Change",
          text: `${diff >= 0 ? "+" : "−"}${fx(Math.abs(diff))}`,
        },
      ],
    };
  });
  return sceneOf(ctx, { marks: [...marks, ...labels], targets });
}
