/**
 * ADR-306 Phase 4 — 그룹별 분포 종류 3: box · beeswarm · ridgeline (breakdown §2.2 #26 ~ #28).
 * 뜻은 ztd-charts 0.5.0 (`3c4376c`, MIT — `src/charts/{box,beeswarm,ridgeline}.tsx`) 을 따른다: 강조는
 * 중앙값이 가장 큰 그룹 (그룹이 없는 beeswarm 은 가장 큰 점), 통계는 원본 전체 (잘린 표본으로 분위를
 * 내지 않는다 — breakdown §4.2), 그리는 요소만 줄인다. 배치 비율은 ztd 값, 글자 크기만 rule metric.
 */
import { circlePath } from "../../marks/dots";
import { approxTextWidth, linearScale, r2 } from "../../scales";
import type {
  AxisScene,
  ChartTarget,
  LineMark,
  Mark,
  TextMark,
} from "../../types";
import {
  bandLayout,
  categoryLabels,
  finiteExtent,
  invalidScene,
  noDataScene,
  sceneOf,
  tickColumnWidth,
  truncated,
  valueAxisX,
  valueAxisY,
  type CategoryContext,
} from "../category/common";
import {
  fieldKey,
  numberList,
  numberOption,
  readLabel,
  readNumber,
  requireField,
} from "../fields";
import { fitDomain, ticksFor } from "../niceScale";
import { fitText, polygonPathOf, roundRectPath } from "../shapes";
import {
  beeswarm,
  boxStats,
  kde,
  quantileSorted,
  type BoxStats,
} from "../stats";

export interface ValueGroup {
  name: string;
  values: number[];
  rows: number[];
}

/** 그룹 (dimension, 없으면 하나) 마다 숫자 값 — 데이터에 처음 나온 순서. */
export function groupValues(
  ctx: CategoryContext,
  groupRequired: boolean,
): ValueGroup[] | null {
  const { props, rows, input } = ctx;
  const metric = requireField(input, "Value", props.metric);
  const group = groupRequired
    ? requireField(input, "Group", props.dimension)
    : fieldKey(props.dimension);
  if (!input.ok || metric === null) return null;
  const by = new Map<string, ValueGroup>();
  rows.forEach((row, i) => {
    const v = readNumber(row, metric);
    if (!Number.isFinite(v)) return;
    const name = group === null ? "" : readLabel(row, group);
    let g = by.get(name);
    if (!g) by.set(name, (g = { name, values: [], rows: [] }));
    g.values.push(v);
    g.rows.push(i);
  });
  return [...by.values()];
}

const medianOf = (values: readonly number[]) =>
  quantileSorted(Float64Array.from(values).sort(), 0.5);

function argMaxOf(values: readonly number[]): number {
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

// ── box ────────────────────────────────────────────────────────────────────

export interface BoxModel {
  groups: { name: string; stats: BoxStats; rows: number[]; dens: number[] }[];
  domain: [number, number];
  /** 밀도 표본 위치 (violin) */
  ys: number[];
  peak: number;
  hi: number;
  /** 수염이 백분위면 [낮은, 높은] */
  whiskers: [number, number] | null;
}

const VS = 48;

export function boxModel(ctx: CategoryContext): BoxModel | null {
  const groups = groupValues(ctx, true);
  if (groups === null) return null;
  const { props } = ctx;
  const shape =
    props.shape === "violin" || props.shape === "both" ? props.shape : "box";
  const [wa = NaN, wb = NaN] = numberList(props.whiskers);
  const isPct = wa >= 0 && wa <= 100 && wb >= 0 && wb <= 100;
  const whiskers: [number, number] | null = isPct
    ? [Math.min(wa, wb), Math.max(wa, wb)]
    : null;
  const stats = groups.map((g) => boxStats(g.values, whiskers ?? undefined));
  const [mn, mx] = finiteExtent(groups.flatMap((g) => g.values));
  const domain = fitDomain(mn, mx, 4, {
    zero: props.includeZero === true,
    pad: 0.06,
  });
  const ys = Array.from(
    { length: VS },
    (_, k) => domain[0] + ((domain[1] - domain[0]) * k) / (VS - 1),
  );
  const dens =
    shape === "box"
      ? groups.map(() => [] as number[])
      : groups.map((g) => kde(g.values, ys));
  return {
    groups: groups.map((g, k) => ({
      name: g.name,
      stats: stats[k],
      rows: g.rows,
      dens: dens[k],
    })),
    domain,
    ys,
    // 펼치기 (`Math.max(...)`) 는 그룹이 수천이면 인자 상한을 넘는다 — 접어서 구한다.
    peak: dens.reduce(
      (m, row) => row.reduce((a, v) => (v > a ? v : a), m),
      1e-9,
    ),
    hi: argMaxOf(stats.map((s) => s.median)),
    whiskers,
  };
}

export function boxScene(ctx: CategoryContext) {
  const model = boxModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  if (model.groups.length === 0 || outer.w <= 0 || outer.h <= 0)
    return noDataScene(ctx);
  const { props, input } = ctx;
  const fx = input.formatValue;
  const shape =
    props.shape === "violin" || props.shape === "both" ? props.shape : "box";
  const ticks = ticksFor(
    model.domain[0],
    model.domain[1],
    Math.max(2, Math.round(outer.h / 70)),
  );
  const left = outer.x + tickColumnWidth(ticks, fx, fontSize);
  const right = outer.x + outer.w;
  const top = outer.y + fontSize * 0.6;
  const bottom = outer.y + outer.h - (fontSize + 10);
  if (bottom - top < 8) return sceneOf(ctx, { marks: [] });
  const fit = Math.max(1, Math.floor((right - left - 8) / 8));
  const groups = model.groups.slice(0, fit);
  truncated(ctx, groups.length, model.groups.length);
  const y = linearScale(model.domain, [bottom, top]);
  const band = bandLayout(groups.length, left + 4, right - 4, 0.35, 0.15);
  const bw = Math.min(band.bandwidth, 64);
  const marks: Mark[] = [];
  const targets: ChartTarget[] = [];
  const centers: number[] = [];
  const axes: AxisScene[] = [
    valueAxisY(ctx, model.domain, ticks, y, left, right),
  ];
  const vline = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    hi: boolean,
  ): LineMark => ({
    kind: "line",
    x1: r2(x1),
    y1: r2(y1),
    x2: r2(x2),
    y2: r2(y2),
    role: "axis",
    width: 1.4,
    ...(hi ? { paint: "accent" as const } : {}),
  });
  groups.forEach((g, k) => {
    const st = g.stats;
    const hi = k === model.hi;
    const cx = band.at(k) + band.bandwidth / 2;
    centers.push(r2(cx));
    const [q1, q3, lo, hiY, med] = [
      y(st.q1),
      y(st.q3),
      y(st.lo),
      y(st.hi),
      y(st.median),
    ];
    const half = shape === "box" ? bw / 2 : bw * 0.18;
    if (shape !== "box") {
      const wmax = Math.min(band.bandwidth / 2, 40);
      const pts = model.ys.map(
        (v, j) =>
          [cx + (g.dens[j] / model.peak) * wmax, y(v)] as [number, number],
      );
      const back = [...pts]
        .reverse()
        .map(([px, py]) => [cx - (px - cx), py] as [number, number]);
      marks.push({
        kind: "path",
        d: polygonPathOf([...pts, ...back]),
        bbox: {
          x: r2(cx - wmax),
          y: r2(top),
          w: r2(wmax * 2),
          h: r2(bottom - top),
        },
        fillPaint: hi ? "accent" : "neutral",
        fillOpacity: hi ? 0.85 : 0.9,
      });
    }
    const whiskerHi = hi && shape === "box";
    marks.push(
      vline(cx, hiY, cx, q3, whiskerHi),
      vline(cx, q1, cx, lo, whiskerHi),
    );
    if (shape === "box")
      marks.push(
        vline(cx - bw * 0.22, hiY, cx + bw * 0.22, hiY, false),
        vline(cx - bw * 0.22, lo, cx + bw * 0.22, lo, false),
      );
    const boxTop = Math.min(q1, q3);
    const boxH = Math.abs(q1 - q3);
    marks.push({
      kind: "path",
      d: roundRectPath(
        cx - half,
        boxTop,
        half * 2,
        boxH,
        Math.min(4, half / 2),
      ),
      bbox: { x: r2(cx - half), y: r2(boxTop), w: r2(half * 2), h: r2(boxH) },
      ...(shape === "box"
        ? { fillPaint: hi ? ("accent" as const) : ("neutral" as const) }
        : hi
          ? { fillPaint: "neutral" as const }
          : { fillRole: "axis" as const }),
    });
    // 중앙값 선 — 강조 칸 위는 중립색 (ztd onAccent), 나머지는 축 색.
    marks.push({
      kind: "line",
      x1: r2(cx - half),
      y1: r2(med),
      x2: r2(cx + half),
      y2: r2(med),
      role: "axis",
      width: 2.2,
      ...(shape === "box"
        ? hi
          ? { paint: "neutral" as const }
          : {}
        : { paint: hi ? ("accent" as const) : ("neutral" as const) }),
    });
    if (props.outliers !== false)
      for (const v of st.outliers) {
        const oy = y(v);
        marks.push({
          kind: "path",
          d: circlePath(cx, oy, 2.6),
          bbox: { x: r2(cx - 2.6), y: r2(oy - 2.6), w: 5.2, h: 5.2 },
          strokePaint: hi ? "accent" : "neutral",
          strokeWidth: 1.3,
        });
      }
    const wLabel = (p: number | undefined, fallback: string) =>
      p === undefined ? fallback : `P${p}`;
    targets.push({
      id: `group-${k}`,
      x: r2(cx),
      y: r2(hiY),
      rect: {
        x: r2(cx - band.step / 2),
        y: r2(top),
        w: r2(band.step),
        h: r2(bottom - top),
      },
      rows: g.rows,
      title: g.name,
      entries: [
        { label: wLabel(model.whiskers?.[1], "Max"), text: fx(st.hi) },
        { label: "Q3", text: fx(st.q3) },
        {
          label: "Median",
          text: fx(st.median),
          paint: hi ? "accent" : "neutral",
        },
        { label: "Q1", text: fx(st.q1) },
        { label: wLabel(model.whiskers?.[0], "Min"), text: fx(st.lo) },
        {
          label: "Samples",
          text: `${st.n}${st.outliers.length ? ` · ${st.outliers.length} outliers` : ""}`,
        },
      ],
    });
  });
  axes.push(
    categoryLabels(
      ctx,
      groups.map((g) => g.name),
      centers,
      bottom + fontSize * 0.5 + 5,
    ),
  );
  return sceneOf(ctx, { marks, axes, targets });
}

// ── beeswarm ───────────────────────────────────────────────────────────────

/** 그리는 점 상한 (ztd 는 2,000 을 넘으면 canvas 로 — 여기서는 앞 점만 그리고 중앙값은 전체). */
export const BEESWARM_MAX_DOTS = 2000;

export interface BeeswarmModel {
  grouped: boolean;
  groups: ValueGroup[];
  medians: number[];
  domain: [number, number];
  /** 그룹이 있으면 강조 그룹, 없으면 강조 점의 원본 행 */
  hi: number;
  labels: Map<number, string>;
}

export function beeswarmModel(ctx: CategoryContext): BeeswarmModel | null {
  const groups = groupValues(ctx, false);
  if (groups === null) return null;
  const { props, rows } = ctx;
  const grouped = fieldKey(props.dimension) !== null;
  const labelKey = fieldKey(props.labelField);
  const labels = new Map<number, string>();
  if (labelKey !== null)
    for (const g of groups)
      for (const i of g.rows) labels.set(i, readLabel(rows[i], labelKey));
  const medians = groups.map((g) => medianOf(g.values));
  const all = groups.flatMap((g) => g.values);
  const [mn, mx] = finiteExtent(all);
  let hi = -1;
  if (grouped) hi = argMaxOf(medians);
  else if (groups[0]) hi = groups[0].rows[argMaxOf(groups[0].values)] ?? -1;
  return {
    grouped,
    groups,
    medians,
    domain: fitDomain(mn, mx, 4, { zero: false, pad: 0.04 }),
    hi,
    labels,
  };
}

export function beeswarmScene(ctx: CategoryContext) {
  const model = beeswarmModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  if (model.groups.length === 0 || outer.w <= 0 || outer.h <= 0)
    return noDataScene(ctx);
  const { props, input } = ctx;
  const fx = input.formatValue;
  const { grouped } = model;
  const top = outer.y + 6;
  const bottom = outer.y + outer.h - (fontSize + 10);
  if (bottom - top < 8) return sceneOf(ctx, { marks: [] });
  const fitGroups = Math.max(1, Math.floor((bottom - top) / (fontSize * 1.6)));
  const groups = model.groups.slice(0, fitGroups);
  truncated(ctx, groups.length, model.groups.length);
  const total = groups.reduce((s, g) => s + g.values.length, 0);
  if (total > BEESWARM_MAX_DOTS)
    input.warning(
      "budget.rowsTruncated",
      `showing ${BEESWARM_MAX_DOTS} of ${total} dots`,
      String(total),
    );
  const labelW = grouped
    ? Math.min(
        outer.w * 0.26,
        Math.max(...groups.map((g) => approxTextWidth(g.name, fontSize)), 20) +
          10,
      )
    : 0;
  const x0 = outer.x + labelW + 10;
  const x1 = outer.x + outer.w - 10;
  const x = linearScale(model.domain, [x0, x1]);
  const band = (bottom - top) / Math.max(1, groups.length);
  const perGroup =
    Math.min(total, BEESWARM_MAX_DOTS) / Math.max(1, groups.length);
  const r = numberOption(
    props.dotRadius,
    Math.max(
      1.4,
      Math.min(
        5.5,
        Math.sqrt(((outer.w - labelW) * band * 0.5) / Math.max(1, perGroup)) /
          2.4,
      ),
    ),
    0.5,
    20,
  );
  const showMedian = grouped && props.showMedian !== false;
  const strip = showMedian ? fontSize * 1.3 : 0;
  const marks: Mark[] = [];
  const texts: TextMark[] = [];
  const targets: ChartTarget[] = [];
  const axes: AxisScene[] = [
    valueAxisX(
      ctx,
      model.domain,
      x,
      top,
      bottom,
      Math.max(2, Math.round(outer.w / 110)),
    ),
  ];
  let budget = BEESWARM_MAX_DOTS;
  groups.forEach((g, gi) => {
    const take = Math.max(0, Math.min(g.values.length, budget));
    budget -= take;
    const xs = g.values.slice(0, take).map((v) => x(v));
    const ys = beeswarm(xs, r, {
      maxSpread: Math.max(r, (band - strip) / 2 - r - 1),
    });
    const mid = top + band * gi + strip + (band - strip) / 2;
    const hiGroup = grouped && gi === model.hi;
    xs.forEach((cx, j) => {
      const row = g.rows[j];
      const hi = grouped ? hiGroup : row === model.hi;
      const cy = mid + ys[j];
      marks.push({
        kind: "path",
        d: circlePath(cx, cy, r),
        bbox: { x: r2(cx - r), y: r2(cy - r), w: r2(r * 2), h: r2(r * 2) },
        fillPaint: hi ? "accent" : "neutral",
        fillOpacity: hi ? 0.95 : 0.72,
      });
      targets.push({
        id: `dot-${row}`,
        x: r2(cx),
        y: r2(cy - r),
        r: r2(r + 4),
        rows: [row],
        title:
          model.labels.get(row) || `${g.name ? `${g.name} ` : ""}#${row + 1}`,
        entries: [
          ...(g.name ? [{ label: "Group", text: g.name }] : []),
          {
            label: "Value",
            text: fx(g.values[j]),
            paint: hi ? ("accent" as const) : ("neutral" as const),
          },
        ],
      });
    });
    if (grouped) {
      if (gi > 0)
        marks.push({
          kind: "line",
          x1: r2(outer.x + labelW),
          y1: r2(top + band * gi),
          x2: r2(outer.x + outer.w),
          y2: r2(top + band * gi),
          role: "grid",
          dash: [2, 3],
        });
      texts.push({
        kind: "text",
        x: r2(outer.x + labelW),
        y: r2(top + band * gi + band / 2),
        text: fitText(g.name, labelW - 4, fontSize),
        anchor: "end",
        baseline: "middle",
        role: "legend",
      });
    }
    if (showMedian) {
      const mx = x(model.medians[model.groups.indexOf(g)]);
      const y0 = top + band * gi + 2;
      marks.push({
        kind: "line",
        x1: r2(mx),
        y1: r2(y0 + strip),
        x2: r2(mx),
        y2: r2(y0 + band - 6),
        role: "axis",
        width: 1.6,
        dash: [3, 2],
      });
      if (band >= fontSize * 3)
        texts.push({
          kind: "text",
          x: r2(mx),
          y: r2(y0 + strip / 2),
          text: `Median ${fx(model.medians[model.groups.indexOf(g)])}`,
          anchor: "middle",
          baseline: "middle",
          role: "value",
        });
    }
  });
  return sceneOf(ctx, { marks: [...marks, ...texts], axes, targets });
}

// ── ridgeline ──────────────────────────────────────────────────────────────

export interface RidgelineModel {
  ridges: {
    name: string;
    dens: number[];
    median: number;
    n: number;
    rows: number[];
  }[];
  domain: [number, number];
  xs: number[];
  peak: number;
  hi: number;
}

const RIDGE_SAMPLES = 72;

export function ridgelineModel(ctx: CategoryContext): RidgelineModel | null {
  const groups = groupValues(ctx, true);
  if (groups === null) return null;
  const { props } = ctx;
  const [mn, mx] = finiteExtent(groups.flatMap((g) => g.values));
  const domain = fitDomain(mn, mx, 4, { zero: false, pad: 0.06 });
  const xs = Array.from(
    { length: RIDGE_SAMPLES },
    (_, k) => domain[0] + ((domain[1] - domain[0]) * k) / (RIDGE_SAMPLES - 1),
  );
  const bandwidth =
    typeof props.bandwidth === "number" &&
    Number.isFinite(props.bandwidth) &&
    props.bandwidth > 0
      ? props.bandwidth
      : undefined;
  let ridges = groups.map((g) => ({
    name: g.name,
    dens: kde(g.values, xs, bandwidth),
    median: medianOf(g.values),
    n: g.values.length,
    rows: g.rows,
  }));
  // ztd `sort: "median"` = 중앙값 오름차순 (위 → 아래). descending 은 그 반대.
  if (props.sort === "ascending")
    ridges = [...ridges].sort((a, b) => a.median - b.median);
  else if (props.sort === "descending")
    ridges = [...ridges].sort((a, b) => b.median - a.median);
  return {
    ridges,
    domain,
    xs,
    peak: ridges.reduce(
      (m, r) => r.dens.reduce((a, v) => (v > a ? v : a), m),
      1e-9,
    ),
    hi: argMaxOf(ridges.map((r) => r.median)),
  };
}

export function ridgelineScene(ctx: CategoryContext) {
  const model = ridgelineModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  if (model.ridges.length === 0 || outer.w <= 0 || outer.h <= 0)
    return noDataScene(ctx);
  const { props, input } = ctx;
  const fx = input.formatValue;
  const top = outer.y + 8;
  const bottom = outer.y + outer.h - (fontSize + 10);
  if (bottom - top < 8) return sceneOf(ctx, { marks: [] });
  const overlap = numberOption(props.overlap, 1.5, 0.5, 4);
  const fitRidges = Math.max(
    1,
    Math.floor((bottom - top) / (fontSize * 0.9) - overlap + 1),
  );
  const ridges = model.ridges.slice(0, fitRidges);
  truncated(ctx, ridges.length, model.ridges.length);
  const nG = ridges.length;
  const labelW = Math.min(
    outer.w * 0.26,
    Math.max(...ridges.map((r) => approxTextWidth(r.name, fontSize)), 20) + 10,
  );
  const step = (bottom - top) / (nG - 1 + overlap);
  const amp = step * overlap;
  const x0 = outer.x + labelW + 8;
  const x1 = outer.x + outer.w - 8;
  const x = linearScale(model.domain, [x0, x1]);
  const baseY = (k: number) => top + amp + step * k;
  const marks: Mark[] = [];
  const texts: TextMark[] = [];
  const targets: ChartTarget[] = [];
  const axes: AxisScene[] = [
    valueAxisX(
      ctx,
      model.domain,
      x,
      top,
      bottom,
      Math.max(2, Math.round(outer.w / 110)),
    ),
  ];
  ridges.forEach((r, k) => {
    const hi = model.ridges.indexOf(r) === model.hi;
    const b = baseY(k);
    const pts = r.dens.map(
      (d, j) =>
        [r2(x(model.xs[j])), r2(b - (d / model.peak) * amp)] as [
          number,
          number,
        ],
    );
    const bbox = { x: r2(x0), y: r2(b - amp), w: r2(x1 - x0), h: r2(amp) };
    marks.push(
      {
        kind: "path",
        d: polygonPathOf([
          [r2(x(model.xs[0])), r2(b)],
          ...pts,
          [r2(x(model.xs[RIDGE_SAMPLES - 1])), r2(b)],
        ]),
        bbox,
        fillPaint: hi ? "accent" : "neutral",
        fillOpacity: hi ? 0.88 : 0.92,
      },
      {
        kind: "path",
        d: pts.map(([px, py], j) => `${j ? "L" : "M"}${px},${py}`).join(""),
        bbox,
        strokeWidth: hi ? 1.8 : 1.2,
        ...(hi
          ? { strokePaint: "accent" as const }
          : { role: "axis" as const }),
      },
      {
        kind: "line",
        x1: r2(x0),
        y1: r2(b),
        x2: r2(x1),
        y2: r2(b),
        role: "grid",
      },
      {
        kind: "line",
        x1: r2(x(r.median)),
        y1: r2(b - 5),
        x2: r2(x(r.median)),
        y2: r2(b),
        role: "axis",
        width: 1.6,
        ...(hi ? { paint: "neutral" as const } : {}),
      },
    );
    // 이름표는 줄 간격이 글자보다 넓을 때만 (좁으면 이웃 이름과 겹친다).
    if (step >= fontSize * 1.1)
      texts.push({
        kind: "text",
        x: r2(outer.x + labelW),
        y: r2(b - 6),
        text: fitText(r.name, labelW - 4, fontSize),
        anchor: "end",
        baseline: "middle",
        role: "legend",
      });
    targets.push({
      id: `ridge-${k}`,
      x: r2(x(r.median)),
      y: r2(b - amp * 0.6),
      rect: { x: r2(outer.x), y: r2(b - step), w: r2(outer.w), h: r2(step) },
      rows: r.rows,
      title: r.name,
      entries: [
        {
          label: "Median",
          text: fx(r.median),
          paint: hi ? "accent" : "neutral",
        },
        { label: "Samples", text: String(r.n) },
      ],
    });
  });
  return sceneOf(ctx, { marks: [...marks, ...texts], axes, targets });
}
