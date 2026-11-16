/**
 * ADR-306 Phase 4 — 칸 종류 2: heatmap · calendar (breakdown §2.2 #29 · #30). 뜻은 ztd-charts 0.5.0
 * (`3c4376c`, MIT — `src/charts/{heatmap,calendar}.tsx`) 을 따른다: 같은 칸 (열 × 행 · 날짜) 은 합산,
 * 진하기는 최솟값 ~ 95 번째 백분위 (`robustMax`) 의 비율, 가장 큰 칸은 테두리.
 *
 * 색: 연속 불투명도 대신 5 단계 paint 역할 (breakdown §5.1 — 두 소비자가 같은 토큰을 푼다) —
 * `step-0` 은 값 0 · 빈 날, `step-1` ~ `step-4` 는 비율의 4 등분. 칸 안 숫자 (heatmap) 는 글자 색이
 * 역할 색이라 진한 칸 위에서 읽기 어려워 기본은 끈다 (`showValueLabels`).
 *
 * calendar 의 날짜는 UTC 로 읽는다 (`2024-02-29` 가 어느 timezone 에서나 같은 칸 — breakdown §7.1).
 */
import { hasHighlight, highlightIndex } from "../../highlight";
import { approxTextWidth, r2 } from "../../scales";
import type {
  ChartLegendPosition,
  ChartPaintRole,
  ChartTarget,
  Mark,
  Rect,
  TextMark,
} from "../../types";
import {
  categoryLabels,
  invalidScene,
  noDataScene,
  sceneOf,
  truncated,
  withPlot,
  type CategoryContext,
} from "../category/common";
import {
  carveLegend,
  LEGEND_CHART_GAP,
  legendPositionOf,
} from "../../legend";
import { numberOption, readLabel, readNumber, requireField } from "../fields";
import { fitText, roundRectPath } from "../shapes";

/** 값 목록의 「거의 최대」 — 24 개 이상이면 95 번째 백분위 (튀는 칸 하나가 나머지를 흐리게 하지 않게). */
export function robustMax(values: ArrayLike<number>): number {
  const v: number[] = [];
  for (let i = 0; i < values.length; i++)
    if (Number.isFinite(values[i])) v.push(values[i]);
  if (!v.length) return 1;
  v.sort((a, b) => a - b);
  if (v.length < 24) return v[v.length - 1];
  return (
    v[Math.min(v.length - 1, Math.floor(v.length * 0.95))] || v[v.length - 1]
  );
}

/** 비율 (0 ~ 1) → 값 단계 1 ~ 4. */
export function stepOf(t: number): ChartPaintRole {
  const k = Math.min(4, 1 + Math.floor(Math.max(0, Math.min(1, t)) * 4));
  return `step-${k}` as ChartPaintRole;
}

function swatchLegend(
  ctx: CategoryContext,
  labels: readonly [string, string],
  box: Rect,
  position: ChartLegendPosition,
): Mark[] {
  const { fontSize } = ctx.frame;
  const sw = 12;
  const gap = 2;
  const out: Mark[] = [];
  const step = (k: number, x: number, y: number, w: number, h: number) =>
    out.push({
      kind: "rect",
      x: r2(x),
      y: r2(y),
      w,
      h,
      seriesIndex: 0,
      fillPaint: `step-${k + 1}` as ChartPaintRole,
    });
  const text = (value: string, x: number, y: number, anchor: TextMark["anchor"]) =>
    out.push({
      kind: "text",
      x: r2(x),
      y: r2(y),
      text: value,
      anchor,
      baseline: "middle",
      role: "legend",
    });
  if (position === "left" || position === "right") {
    // 세로 띠 — 위가 많음 (단계 4), 아래가 적음. 띠 열 (글자 · 견본 중 넓은 폭) 은 격자 반대쪽에 붙고 격자 쪽에
    //   `LEGEND_CHART_GAP` 이 남는다.
    const colW = Math.max(sw, ...labels.map((l) => approxTextWidth(l, fontSize)));
    const cx =
      position === "right"
        ? box.x + LEGEND_CHART_GAP + colW / 2
        : box.x + colW / 2;
    const lineH = fontSize * 1.4;
    const stripH = 4 * (9 + gap) - gap;
    const y0 = box.y + lineH;
    text(labels[1], cx, box.y + lineH / 2, "middle");
    for (let k = 0; k < 4; k++)
      step(3 - k, cx - sw / 2, y0 + k * (9 + gap), sw, 9);
    text(labels[0], cx, y0 + stripH + lineH / 2, "middle");
    return out;
  }
  // 가로 띠 — 오른쪽 끝 정렬. 띠 줄 (글자 한 줄 높이) 은 격자 반대쪽에 붙고 격자 쪽에 `LEGEND_CHART_GAP` 이 남는다.
  const y =
    box.y + (position === "bottom" ? LEGEND_CHART_GAP : 0) + fontSize / 2;
  const right = box.x + box.w;
  const hiW = approxTextWidth(labels[1], fontSize);
  const startX = right - hiW - 6 - 4 * (sw + gap);
  for (let k = 0; k < 4; k++) step(k, startX + k * (sw + gap), y - 4.5, sw, 9);
  text(labels[0], startX - 4, y, "end");
  text(labels[1], right, y, "end");
  return out;
}

function legendLabels(ctx: CategoryContext): [string, string] {
  const given = ctx.props.legendLabels;
  return Array.isArray(given) &&
    typeof given[0] === "string" &&
    typeof given[1] === "string"
    ? [given[0], given[1]]
    : ["Low", "High"];
}

// ── heatmap ────────────────────────────────────────────────────────────────

export interface HeatmapModel {
  xs: string[];
  ys: string[];
  /** 칸 (행 우선 — `row * xs.length + col`) 의 합. 값 없는 칸 NaN */
  vals: Float64Array;
  rows: number[][];
  min: number;
  max: number;
  top: number;
}

export function heatmapModel(ctx: CategoryContext): HeatmapModel | null {
  const { props, rows, input } = ctx;
  const dimension = requireField(input, "Column", props.dimension);
  const rowField = requireField(input, "Row", props.rowField);
  const metric = requireField(input, "Value", props.metric);
  if (!input.ok || dimension === null || rowField === null || metric === null)
    return null;
  const xi = new Map<string, number>();
  const yi = new Map<string, number>();
  for (const row of rows) {
    const x = readLabel(row, dimension);
    const y = readLabel(row, rowField);
    if (!xi.has(x)) xi.set(x, xi.size);
    if (!yi.has(y)) yi.set(y, yi.size);
  }
  const xs = [...xi.keys()];
  const ys = [...yi.keys()];
  const vals = new Float64Array(xs.length * ys.length).fill(NaN);
  const cellRows: number[][] = Array.from({ length: vals.length }, () => []);
  rows.forEach((row, i) => {
    const idx =
      yi.get(readLabel(row, rowField))! * xs.length +
      xi.get(readLabel(row, dimension))!;
    const v = readNumber(row, metric);
    if (Number.isFinite(v))
      vals[idx] = Number.isFinite(vals[idx]) ? vals[idx] + v : v;
    cellRows[idx].push(i);
  });
  let min = Infinity;
  let max = -Infinity;
  for (const v of vals)
    if (Number.isFinite(v)) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  return {
    xs,
    ys,
    vals,
    rows: cellRows,
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 0,
    top: robustMax(vals),
  };
}

export function heatmapScene(ctx: CategoryContext) {
  const model = heatmapModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { fontSize } = ctx.frame;
  let { outer } = ctx.frame;
  const nCells = model.vals.length;
  if (
    nCells === 0 ||
    !model.vals.some(Number.isFinite) ||
    outer.w <= 0 ||
    outer.h <= 0
  )
    return noDataScene(ctx);
  const { props, input } = ctx;
  const fx = input.formatValue;
  // 색 단계 범례 — 범례 자리 (`legendPosition`) 에서 떼고 남은 영역에 격자를 그린다.
  const legendPos = legendPositionOf(props.legendPosition);
  const legendText = legendLabels(ctx);
  const legendSide = legendPos === "left" || legendPos === "right";
  const legendExtent =
    props.showLegend === false
      ? 0
      : legendSide
        ? Math.max(
            12,
            ...legendText.map((label) => approxTextWidth(label, fontSize)),
          ) + LEGEND_CHART_GAP
        : fontSize + LEGEND_CHART_GAP;
  const legendCarve =
    legendExtent > 0 &&
    legendExtent <= (legendSide ? outer.w : outer.h) / 3
      ? carveLegend(outer, legendExtent, legendPos)
      : null;
  if (legendCarve) {
    ctx = withPlot(ctx, legendCarve.plot);
    outer = ctx.frame.outer;
  }
  // 행 이름 칸 — 왼쪽 범례면 앞 여백 8 없이 (가장 긴 이름의 왼끝 = 영역 경계).
  const leftW = Math.min(
    outer.w * 0.3,
    model.ys.reduce((m, l) => Math.max(m, approxTextWidth(l, fontSize)), 10) +
      (legendCarve && legendPos === "left" ? 0 : 8),
  );
  // 아래 범례면 열 이름 아래끝이 영역 경계 (범례 ↔ 격자 = `LEGEND_CHART_GAP`).
  const bottom =
    fontSize + (legendCarve && legendPos === "bottom" ? 5 : 10);
  const x0 = outer.x + leftW + 4;
  const y0 = outer.y;
  const plotW = outer.x + outer.w - x0;
  const plotH = outer.y + outer.h - bottom - y0;
  if (plotW < 4 || plotH < 4) return sceneOf(ctx, { marks: [] });
  // 칸이 2px 보다 좁아지면 앞 열 · 앞 행만 (합계는 원본 전체로 이미 냈다).
  const nx = Math.min(model.xs.length, Math.floor(plotW / 2));
  const ny = Math.min(model.ys.length, Math.floor(plotH / 2));
  truncated(ctx, nx * ny, model.xs.length * model.ys.length);
  const cw = plotW / Math.max(1, nx);
  const ch = plotH / Math.max(1, ny);
  const gap = Math.min(cw, ch) > 14 ? 2.5 : Math.min(cw, ch) > 5 ? 1 : 0;
  const rad = Math.min(3, Math.min(cw, ch) / 4);
  const span = Math.max(1e-9, model.top - model.min) || 1;
  const fullW = model.xs.length;
  let hiIdx = -1;
  for (let i = 0; i < nCells; i++)
    if (
      Number.isFinite(model.vals[i]) &&
      (hiIdx < 0 || model.vals[i] > model.vals[hiIdx])
    )
      hiIdx = i;
  // ADR-306 Phase 6 — `highlight`: 칸 이름 「x|y」 (ztd heatmap 과 같은 꼴) · 값.
  hiIdx = highlightIndex(
    props.highlight,
    Array.from(
      { length: nCells },
      (_, i) => `${model.xs[i % fullW]}|${model.ys[Math.floor(i / fullW)]}`,
    ),
    Array.from(model.vals.subarray(0, nCells)),
    hiIdx,
  );
  // 위 범례면 첫 줄 칸 위의 반 간격만큼 격자를 올리고, 오른쪽 범례면 마지막 열 칸 끝의 반 간격만큼 오른쪽으로 — 범례 ↔
  //   칸 = `LEGEND_CHART_GAP`. 강조 칸의 테두리 (칸 밖 1) 가 그 끝 줄 · 열에 있으면 테두리가 끝이다.
  const hiOnEdge = (edge: "top" | "right") =>
    hiIdx >= 0 &&
    (edge === "top"
      ? Math.floor(hiIdx / fullW) === 0
      : hiIdx % fullW === nx - 1)
      ? 1
      : 0;
  const lift =
    legendCarve && legendPos === "top" ? gap / 2 - hiOnEdge("top") : 0;
  const shiftX =
    legendCarve && legendPos === "right" ? gap / 2 - hiOnEdge("right") : 0;
  const valuesOn =
    props.showValueLabels === true &&
    cw >= approxTextWidth(fx(model.max), fontSize) + 8 &&
    ch >= fontSize * 1.4;
  const marks: Mark[] = [];
  const texts: TextMark[] = [];
  const targets: ChartTarget[] = [];
  for (let row = 0; row < ny; row++)
    for (let col = 0; col < nx; col++) {
      const i = row * fullW + col;
      const v = model.vals[i];
      if (!Number.isFinite(v)) continue;
      const x = x0 + shiftX + col * cw + gap / 2;
      const y = y0 - lift + row * ch + gap / 2;
      const w = Math.max(0.5, cw - gap);
      const h = Math.max(0.5, ch - gap);
      const bbox = { x: r2(x), y: r2(y), w: r2(w), h: r2(h) };
      marks.push({
        kind: "path",
        d: roundRectPath(x, y, w, h, rad),
        bbox,
        fillPaint: stepOf((v - model.min) / span),
      });
      if (i === hiIdx)
        marks.push({
          kind: "path",
          d: roundRectPath(x - 1, y - 1, w + 2, h + 2, rad + 1),
          bbox: { x: r2(x - 1), y: r2(y - 1), w: r2(w + 2), h: r2(h + 2) },
          role: "axis",
          strokeWidth: 1.5,
        });
      if (valuesOn)
        texts.push({
          kind: "text",
          x: r2(x + w / 2),
          y: r2(y + h / 2),
          text: fx(v),
          anchor: "middle",
          baseline: "middle",
          role: "value",
        });
      targets.push({
        id: `cell-${i}`,
        x: r2(x + w / 2),
        y: r2(y),
        rect: bbox,
        rows: model.rows[i],
        title: `${model.ys[row]} · ${model.xs[col]}`,
        entries: [
          {
            label: "Value",
            text: fx(v),
            paint: stepOf((v - model.min) / span),
          },
        ],
      });
    }
  if (legendCarve)
    marks.push(
      ...swatchLegend(ctx, legendText, legendCarve.box, legendPos),
    );
  const every =
    ch >= fontSize ? 1 : Math.ceil((fontSize + 1) / Math.max(1, ch));
  for (let row = 0; row < ny; row += every)
    texts.push({
      kind: "text",
      x: r2(outer.x + leftW),
      y: r2(y0 - lift + row * ch + ch / 2),
      text: fitText(model.ys[row], leftW - (legendCarve && legendPos === "left" ? 0 : 2), fontSize),
      anchor: "end",
      baseline: "middle",
      role: "tick",
    });
  const axes = [
    categoryLabels(
      ctx,
      model.xs.slice(0, nx),
      model.xs.slice(0, nx).map((_, col) => x0 + shiftX + col * cw + cw / 2),
      outer.y + outer.h - bottom + fontSize * 0.5 + 5,
    ),
  ];
  return sceneOf(ctx, { marks: [...marks, ...texts], axes, targets });
}

// ── calendar ───────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** 날짜 값 → UTC 자정 epoch (읽을 수 없으면 null). `YYYY-MM-DD` 는 timezone 과 무관하게 그 날. */
export function utcDay(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (m) {
    const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(t);
    // 2023-02-29 처럼 없는 날은 거부한다 (Date 가 3 월 1 일로 넘기지 않게).
    return d.getUTCMonth() === Number(m[2]) - 1 ? t : null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  const d = new Date(parsed);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export interface CalendarDay {
  t: number;
  week: number;
  /** 주 시작 기준 요일 (0 ~ 6) */
  wd: number;
  /** 연도 줄 (여러 해면 해마다 한 줄) */
  year: number;
  value: number;
  rows: number[];
}

export interface CalendarModel {
  days: CalendarDay[];
  weeks: number;
  years: number[];
  min: number;
  top: number;
  weekStart: number;
}

export function calendarModel(ctx: CategoryContext): CalendarModel | null {
  const { props, rows, input } = ctx;
  const dimension = requireField(input, "Date", props.dimension);
  const metric = requireField(input, "Value", props.metric);
  if (!input.ok || dimension === null || metric === null) return null;
  const ws = Math.round(numberOption(props.weekStart, 0, 0, 1));
  const byDay = new Map<number, { v: number; rows: number[] }>();
  rows.forEach((row, i) => {
    const t = utcDay(row[dimension]);
    if (t === null) return;
    const v = readNumber(row, metric);
    const prev = byDay.get(t);
    if (!prev) {
      byDay.set(t, { v, rows: [i] });
      return;
    }
    // 같은 날은 합산 (값이 없는 행은 더하지 않는다) — 행 목록은 늘리기만 (복사하면 행 수의 제곱).
    if (Number.isFinite(v)) prev.v = (Number.isFinite(prev.v) ? prev.v : 0) + v;
    prev.rows.push(i);
  });
  const keys = [...byDay.keys()].sort((a, b) => a - b);
  const years = [
    ...new Set(keys.map((k) => new Date(k).getUTCFullYear())),
  ].sort((a, b) => a - b);
  const multi = years.length > 1;
  const days: CalendarDay[] = [];
  if (keys.length) {
    const ranges: [number, number][] = multi
      ? years.map((y) => [Date.UTC(y, 0, 1), Date.UTC(y, 11, 31)])
      : [[keys[0], keys[keys.length - 1]]];
    ranges.forEach(([a, b], yi) => {
      const start = a - ((new Date(a).getUTCDay() - ws + 7) % 7) * DAY;
      for (let t = a; t <= b; t += DAY) {
        const hit = byDay.get(t);
        days.push({
          t,
          week: Math.floor((t - start) / (7 * DAY)),
          wd: (new Date(t).getUTCDay() - ws + 7) % 7,
          year: yi,
          value: hit ? hit.v : 0,
          rows: hit?.rows ?? [],
        });
      }
    });
  }
  let weeks = 1;
  for (const d of days) weeks = Math.max(weeks, d.week + 1);
  const vals = days.map((d) => d.value).filter(Number.isFinite);
  return {
    days,
    weeks,
    years,
    min: vals.reduce((m, v) => (v < m ? v : m), vals.length ? Infinity : 0),
    top: robustMax(vals.filter((v) => v > 0)),
    weekStart: ws,
  };
}

/** 날의 단계 — 0 · 빈 날은 `step-0`, 나머지는 (값 − min(0, 최솟값)) / 폭 의 4 등분. */
export function calendarStep(model: CalendarModel, v: number): ChartPaintRole {
  if (!v || !Number.isFinite(v)) return "step-0";
  const lo = Math.min(0, model.min);
  const span = Math.max(1e-9, model.top - lo) || 1;
  return stepOf((v - lo) / span);
}

const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

export function calendarScene(ctx: CategoryContext) {
  const model = calendarModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  if (model.days.length === 0 || outer.w <= 0 || outer.h <= 0)
    return noDataScene(ctx);
  const { props, input } = ctx;
  const fx = input.formatValue;
  const ws = model.weekStart;
  const topH = fontSize * 1.5;
  // 한 해 줄이 칸 2px 도 못 담으면 뒤의 해만 (최근 해부터 남긴다).
  const perYear = topH + 4 + 7 * 2;
  const fitYears = Math.max(1, Math.floor(outer.h / perYear));
  const firstYear = Math.max(0, model.years.length - fitYears);
  const yearsShown = model.years.length - firstYear;
  truncated(ctx, yearsShown, Math.max(1, model.years.length));
  const multi = model.years.length > 1;
  const days = model.days.filter((d) => d.year >= firstYear);
  const nYears = Math.max(1, yearsShown);
  const leftW = Math.max(
    22,
    Math.max(
      ...[1, 3, 5].map((r) =>
        approxTextWidth(WEEKDAYS[(r + ws) % 7], fontSize),
      ),
    ) +
      10 +
      (multi ? approxTextWidth("2025", fontSize) + 6 : 0),
  );
  const maxGap = numberOption(props.cellGap, 2.5, 0, 12);
  const blockH = (outer.h - (multi ? 4 : 0)) / nYears;
  const room = Math.max(
    0,
    Math.min((outer.w - leftW - 2) / model.weeks, (blockH - topH - 4) / 7),
  );
  const gap = room - maxGap >= 2 ? maxGap : (room * maxGap) / (maxGap + 2);
  const cell = room - gap;
  if (cell <= 0.5) return sceneOf(ctx, { marks: [] });
  const step = cell + gap;
  const gridW = model.weeks * step;
  const x0 = outer.x + leftW + Math.max(0, (outer.w - leftW - gridW) / 2);
  // 해 줄마다 남는 높이는 위아래로 나눈다 (ztd 는 높이를 내용에 맞춰 정해 남는 칸이 없다 — 여기서는
  //   상자 크기를 Layout 이 정하므로 칸 묶음을 가운데에 둔다).
  const top0 = outer.y + Math.max(0, (blockH - (topH + 7 * step + 4)) / 2);
  const rad = Math.min(2.5, cell / 3);
  let hiDay: CalendarDay | null = null;
  for (const d of days)
    if (Number.isFinite(d.value) && (!hiDay || d.value > hiDay.value))
      hiDay = d;
  // ADR-306 Phase 6 — `highlight`: 날짜 (YYYY-MM-DD, UTC) · 값.
  if (hasHighlight(props.highlight)) {
    const k = highlightIndex(
      props.highlight,
      days.map((d) => new Date(d.t).toISOString().slice(0, 10)),
      days.map((d) => d.value),
      -1,
    );
    hiDay = k >= 0 ? days[k] : null;
  }
  const pos = (d: CalendarDay) => ({
    x: x0 + d.week * step,
    y: top0 + (d.year - firstYear) * blockH + topH + d.wd * step,
  });
  const marks: Mark[] = [];
  const texts: TextMark[] = [];
  const targets: ChartTarget[] = [];
  for (const d of days) {
    const q = pos(d);
    const bbox = { x: r2(q.x), y: r2(q.y), w: r2(cell), h: r2(cell) };
    const paint = calendarStep(model, d.value);
    marks.push({
      kind: "path",
      d: roundRectPath(q.x, q.y, cell, cell, rad),
      bbox,
      fillPaint: paint,
    });
    targets.push({
      id: `day-${isoDay(d.t)}`,
      x: r2(q.x + cell / 2),
      y: r2(q.y),
      rect: bbox,
      rows: d.rows,
      title: isoDay(d.t),
      entries: [
        {
          label: "Value",
          text: Number.isFinite(d.value) ? fx(d.value) : "-",
          paint,
        },
      ],
    });
  }
  if (hiDay && hiDay.value > 0) {
    const q = pos(hiDay);
    marks.push({
      kind: "path",
      d: roundRectPath(q.x, q.y, cell, cell, rad),
      bbox: { x: r2(q.x), y: r2(q.y), w: r2(cell), h: r2(cell) },
      role: "axis",
      strokeWidth: 1.2,
    });
  }
  // 달 이름 — 그 달의 첫 주 (1 ~ 7 일) 자리, 앞 이름과 겹치면 뺀다.
  const monthW = approxTextWidth("Mmm", fontSize) + 6;
  let last = "";
  let prev: { x: number; y: number } | null = null;
  for (const d of days) {
    const dt = new Date(d.t);
    const key = `${d.year}-${dt.getUTCMonth()}`;
    if (key === last || dt.getUTCDate() > 7) continue;
    last = key;
    const x = x0 + d.week * step;
    const y = top0 + (d.year - firstYear) * blockH + topH / 2;
    if (prev && prev.y === y && x - prev.x < monthW) continue;
    prev = { x, y };
    texts.push({
      kind: "text",
      x: r2(x),
      y: r2(y),
      text: MONTHS[dt.getUTCMonth()],
      anchor: "start",
      baseline: "middle",
      role: "tick",
    });
  }
  for (let yi = 0; yi < nYears; yi++) {
    const blockTop = top0 + yi * blockH;
    if (step >= fontSize * 0.55)
      for (const r of [1, 3, 5])
        texts.push({
          kind: "text",
          x: r2(x0 - 6),
          y: r2(blockTop + topH + r * step + cell / 2),
          text: WEEKDAYS[(r + ws) % 7],
          anchor: "end",
          baseline: "middle",
          role: "tick",
        });
    if (multi)
      texts.push({
        kind: "text",
        x: r2(outer.x),
        y: r2(blockTop + topH / 2),
        text: String(model.years[firstYear + yi]),
        anchor: "start",
        baseline: "middle",
        role: "legend",
      });
  }
  return sceneOf(ctx, { marks: [...marks, ...texts], targets });
}
