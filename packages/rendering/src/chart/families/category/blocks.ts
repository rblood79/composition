/**
 * ADR-306 Phase 3 — category family 의 면 종류 2: marimekko · skyline. 뜻과 배치 비율은 ztd-charts
 * 0.5.0 (`3c4376c`, MIT — `src/charts/marimekko.tsx` · `src/charts/skyline.tsx` 의 `skylineLayout` ·
 * `mergeFactor` · `groupRange` · `Prism`) 을 따른다. skyline 의 빗금은 선 묶음 path (pattern fill 을
 * 새 mark 로 만들지 않는다 — breakdown §5.1), 옆면 그늘은 축 토큰 반투명 면이다.
 */
import { highlightColor, highlightSet } from "../../highlight";
import { approxTextWidth, linearScale, r2 } from "../../scales";
import type {
  AxisScene,
  ChartTarget,
  LineMark,
  Mark,
  PathMark,
  TextMark,
} from "../../types";
import { fieldKey, readLabel, readNumber, requireField } from "../fields";
import { fitDomain, niceDomain, ticksFor } from "../niceScale";
import { polygonPathOf } from "../shapes";
import {
  categoryLabels,
  invalidScene,
  noDataScene,
  sceneOf,
  seriesLegend,
  tickColumnWidth,
  truncated,
  valueAxisY,
  type CategoryContext,
} from "./common";
import { pct } from "./bars";
import { chartSeriesLookup, chartSeriesItems } from "../../seriesItems";
import { columnsMode, seriesTable } from "./lines";

// ── marimekko ──────────────────────────────────────────────────────────────

export interface MarimekkoModel {
  cols: string[];
  series: string[];
  /** `[열][계열]` 합 (음수 · 결측은 0) */
  values: number[][];
  colTotals: number[];
  total: number;
  /** `[열][계열]` → 원본 행들 */
  rows: number[][][];
  /** ADR-312 Phase 4 — 계열의 표시 이름 · 팔레트 자리 (`seriesConfig` — 시리즈 경로와 같은 규칙) */
  names: string[];
  colors: number[];
}

export function marimekkoModel(ctx: CategoryContext): MarimekkoModel | null {
  const { props, rows, input } = ctx;
  const dimension = requireField(input, "Category", props.dimension);
  const color = requireField(input, "Series", props.color);
  const metric = requireField(input, "Value", props.metric);
  if (!input.ok || dimension === null || color === null || metric === null)
    return null;
  const cols: string[] = [];
  const series: string[] = [];
  const cell = new Map<string, { v: number; rows: number[] }>();
  rows.forEach((row, i) => {
    const c = readLabel(row, dimension);
    const s = readLabel(row, color);
    if (!cols.includes(c)) cols.push(c);
    if (!series.includes(s)) series.push(s);
    const raw = readNumber(row, metric);
    const key = `${c}\u0000${s}`;
    const prev = cell.get(key) ?? { v: 0, rows: [] };
    prev.v += Math.max(0, Number.isFinite(raw) ? raw : 0);
    prev.rows.push(i);
    cell.set(key, prev);
  });
  // ADR-312 Phase 4 — 계열의 순서 · 이름 · 색은 시리즈 표시 표 (표의 항목이 앞, 나머지는 출현 순서).
  const items = chartSeriesItems(props, rows, ctx.metrics.seriesCount, {
    diagnostics: input.diagnostics,
  });
  const lookup = chartSeriesLookup(items);
  series.sort(lookup.compare);
  const values = cols.map((c) =>
    series.map((s) => cell.get(`${c}\u0000${s}`)?.v ?? 0),
  );
  const colTotals = values.map((row) => row.reduce((a, b) => a + b, 0));
  return {
    cols,
    series,
    values,
    colTotals,
    total: colTotals.reduce((a, b) => a + b, 0),
    rows: cols.map((c) =>
      series.map((s) => cell.get(`${c}\u0000${s}`)?.rows ?? []),
    ),
    names: series.map(lookup.nameOf),
    colors: series.map(
      (s, i) =>
        lookup.get(s)?.seriesIndex ?? i % Math.max(1, ctx.metrics.seriesCount),
    ),
  };
}

export function marimekkoScene(ctx: CategoryContext) {
  const model = marimekkoModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { fontSize } = ctx.frame;
  let { outer } = ctx.frame;
  if (
    model.cols.length === 0 ||
    !(model.total > 0) ||
    outer.w <= 0 ||
    outer.h <= 0
  )
    return noDataScene(ctx);
  const { input } = ctx;
  // ADR-306 Phase 6 — `highlight` 를 주면 강조 밖 계열은 neutral (ztd marimekko — 계열 이름, 기본 first).
  const picked = highlightSet(
    ctx.props.highlight,
    model.series,
    model.series.map(() => 0),
  );
  const colorOf = (s: number) => highlightColor(picked, s, model.colors[s]);
  const placed = seriesLegend(
    ctx,
    model.names.map((label, s) => ({ label, seriesIndex: colorOf(s) })),
  );
  const { legend } = placed;
  ctx = placed.ctx;
  outer = ctx.frame.outer;
  const ticks = [0, 50, 100];
  // 눈금 글자는 `left − 6` 에 끝 정렬 — 칸 폭 (글자 + 8) 의 남는 2 는 왼쪽 범례면 뺀다 (글자 왼끝 = 영역 경계).
  const left =
    outer.x +
    tickColumnWidth(ticks, String, fontSize) -
    (legend?.position === "left" ? 2 : 0);
  // 범례 쪽 가장자리는 자기 여백 없이 (범례 ↔ 그림 = `LEGEND_CHART_GAP`): 위는 100 눈금 글자 위끝, 아래는 두째 줄
  //   이름 (비중) 아래끝이 영역 경계.
  const top = outer.y + (legend?.position === "top" ? fontSize / 2 : 6);
  const bottom =
    outer.y +
    outer.h -
    (fontSize * (legend?.position === "bottom" ? 2.3 : 2.6) + 6);
  const gap = 3;
  const plotW = outer.x + outer.w - left - 4;
  const y = linearScale([0, 100], [bottom, top]);
  // 예산 — 열 하나가 4px + 틈보다 좁아지면 앞 열만 (폭이 음수가 되어 사라지지 않게).
  const fit = Math.max(1, Math.floor((plotW + gap) / (4 + gap)));
  const cols = model.cols.slice(0, fit);
  truncated(ctx, cols.length, model.cols.length);
  const colTotals = model.colTotals.slice(0, cols.length);
  const total = colTotals.reduce((a, b) => a + b, 0) || model.total;
  const usable = Math.max(0, plotW - gap * Math.max(0, cols.length - 1));
  const marks: Mark[] = [];
  const labels: TextMark[] = [];
  const targets: ChartTarget[] = [];
  let acc = 0;
  cols.forEach((col, ci) => {
    const colShare = (colTotals[ci] / total) * 100;
    const w = (colTotals[ci] / total) * usable;
    const x0 = left + 4 + acc;
    acc += w + gap;
    let ys = 0;
    model.series.forEach((_, si) => {
      const v = model.values[ci][si];
      const share = colTotals[ci] ? (v / colTotals[ci]) * 100 : 0;
      const ya = y(ys);
      const yb = y(ys + share);
      ys += share;
      if (share <= 0) return;
      // 조각 사이 1px 틈 (ztd 의 바탕색 테두리).
      const h = Math.max(0, ya - yb - 1);
      marks.push({
        kind: "rect",
        x: r2(x0),
        y: r2(yb),
        w: r2(w),
        h: r2(h),
        seriesIndex: colorOf(si),
      });
      targets.push({
        id: `seg-${ci}-${si}`,
        x: r2(x0 + w / 2),
        y: r2(yb),
        rect: { x: r2(x0), y: r2(yb), w: r2(w), h: r2(Math.max(1, h)) },
        rows: model.rows[ci][si],
        title: `${col} · ${model.names[si]}`,
        entries: [
          { label: "Share in column", text: pct(share), series: colorOf(si) },
          { label: "Value", text: input.formatValue(v) },
          { label: "Column share", text: pct(colShare) },
        ],
      });
    });
    const mid = r2(x0 + w / 2);
    labels.push(
      {
        kind: "text",
        x: mid,
        y: r2(bottom + fontSize * 0.5 + 6),
        text: col,
        anchor: "middle",
        baseline: "middle",
        role: "legend",
      },
      {
        kind: "text",
        x: mid,
        y: r2(bottom + fontSize * 1.8 + 6),
        text: pct(colShare),
        anchor: "middle",
        baseline: "middle",
        role: "tick",
      },
    );
  });
  // 좁은 열의 라벨은 솎는다 (열 순서대로, 앞 라벨과 겹치면 뺀다).
  const kept: TextMark[] = [];
  let right = -Infinity;
  for (let i = 0; i < labels.length; i += 2) {
    const half =
      Math.max(
        approxTextWidth(labels[i].text, fontSize),
        approxTextWidth(labels[i + 1].text, fontSize),
      ) / 2;
    if (labels[i].x - half < right + 4) continue;
    kept.push(labels[i], labels[i + 1]);
    right = labels[i].x + half;
  }
  const axes: AxisScene[] = [
    valueAxisY(ctx, [0, 100], ticks, y, left, outer.x + outer.w, String),
  ];
  return sceneOf(ctx, { marks: [...marks, ...kept], axes, legend, targets });
}

// ── skyline ────────────────────────────────────────────────────────────────

/** 칸 폭에 대한 비율 (ztd 시안 실측값). */
const FACE = 0.52;
const FRONT_DEPTH = 0.14;
const GAP = 0.05;
export const SKYLINE_DEPTH_RANGE: readonly [number, number] = [0.1, 0.32];
const MIN_SLOT = 20;
const MAX_SHOWN = 40;
/** 깊이 방향: 오른쪽 위 2:1 (26.57°). */
const COS = 0.8944271909999159;
const SIN = 0.4472135954999579;
const X0 = 10;
const SLAB = 4;
const STRIP_H = 26;

/** 그림 폭에 기간 n 개를 놓을 때 몇 개씩 합칠지 — 칸 ≥ 20px · 보이는 기간 ≤ 40. */
export function mergeFactor(plotW: number, n: number): number {
  for (let k = 1; k < n; k++) {
    const shown = Math.ceil(n / k);
    if (shown <= MAX_SHOWN && plotW / (shown + 0.55) >= MIN_SLOT) return k;
  }
  return Math.max(1, n);
}

/** 보이는 기간 i 가 덮는 원래 기간 `[시작, 끝)` — 덜 찬 묶음은 가장 오래된 첫 묶음. */
export function groupRange(i: number, n: number, k: number): [number, number] {
  const first = n - k * (Math.ceil(n / k) - 1);
  return i === 0 ? [0, first] : [first + (i - 1) * k, first + i * k];
}

function sumGroups(
  values: readonly (readonly number[])[],
  n: number,
  k: number,
): number[][] {
  return Array.from({ length: Math.ceil(n / k) }, (_, i) => {
    const [a, b] = groupRange(i, n, k);
    return values.map((row) =>
      row
        .slice(a, b)
        .reduce((s, v) => s + (Number.isFinite(v) && v > 0 ? v : 0), 0),
    );
  });
}

export interface SkylineModel {
  labels: string[];
  back: { names: string[]; colors: number[]; values: number[][] };
  front: { names: string[]; colors: number[]; values: number[][] };
}

/** 뒷줄 = 시리즈 격자 (group: color · columns: valueFields), 앞줄 = `frontFields` (범주마다 합). */
export function skylineModel(ctx: CategoryContext): SkylineModel | null {
  const { props, rows, input, metrics } = ctx;
  const dimension = requireField(input, "Category", props.dimension);
  if (!columnsMode(ctx)) requireField(input, "Value", props.metric);
  const frontRefs = props.frontFields ?? [];
  if (!Array.isArray(frontRefs) || frontRefs.some((f) => typeof f !== "string"))
    input.error("rangeFields.invalid", "frontFields must be field names");
  if (!input.ok || dimension === null) return null;
  const table = seriesTable(ctx);
  const index = new Map(table.categories.map((c, k) => [c, k]));
  const frontKeys = frontRefs
    .map((f) => fieldKey(f))
    .filter((k): k is string => k !== null);
  const front = frontKeys.map(() =>
    new Array<number>(table.categories.length).fill(0),
  );
  for (const row of rows) {
    const k = index.get(readLabel(row, dimension));
    if (k === undefined) continue;
    frontKeys.forEach((key, j) => {
      const v = readNumber(row, key);
      if (Number.isFinite(v) && v > 0) front[j][k] += v;
    });
  }
  const n = Math.max(1, metrics.seriesCount);
  return {
    labels: table.categories,
    back: { names: table.names, colors: table.colors, values: table.values },
    front: {
      names: frontKeys,
      colors: frontKeys.map((_, j) => (table.names.length + j) % n),
      values: front,
    },
  };
}

export interface SkylineLayout {
  merge: number;
  shown: number;
  /** `[보이는 기간][계열]` */
  back: number[][];
  front: number[][];
  backTotal: number[];
  frontTotal: number[];
  ticks: number[];
  /** 값 1 이 몇 px */
  k: number;
  s: number;
  w: number;
  floor: number;
  wallBase: number;
  top: number;
  shift: [number, number];
  depthFront: number;
  depthBack: number;
  wallX: [number, number];
  slotX: (i: number) => number;
}

export function skylineLayout(o: {
  x: number;
  width: number;
  height: number;
  back: readonly (readonly number[])[];
  front: readonly (readonly number[])[];
  n: number;
  depth: number;
  wall: boolean;
  top: number;
  below: number;
  labelWidth: (max: number) => number;
}): SkylineLayout {
  const depth = Math.min(
    SKYLINE_DEPTH_RANGE[1],
    Math.max(SKYLINE_DEPTH_RANGE[0], o.depth),
  );
  const plotWidth = (labelW: number) =>
    o.width - X0 - (o.wall ? labelW + 14 : 8);
  let k = 0;
  let labelW = 0;
  let back: number[][] = [];
  let front: number[][] = [];
  let dom: [number, number] = [0, 1];
  // 눈금 폭 → 그림 폭 → 합칠 수 → 합계 → 눈금 (많아야 세 번).
  for (let pass = 0; pass < 3; pass++) {
    const next = mergeFactor(plotWidth(labelW), o.n);
    if (next === k) break;
    k = next;
    back = sumGroups(o.back, o.n, k);
    front = sumGroups(o.front, o.n, k);
    const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
    dom = fitDomain(0, Math.max(0, ...back.map(sum), ...front.map(sum)), 4);
    labelW = o.wall ? o.labelWidth(dom[1]) : 0;
  }
  const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
  const shown = back.length;
  const s = Math.max(1, plotWidth(labelW) / (shown + 0.55));
  const w = FACE * s;
  const lead = (FRONT_DEPTH + GAP) * s;
  const deep = lead + depth * s;
  const floor = o.height - o.below;
  const wallBase = floor - deep * SIN;
  const slotX = (i: number) => o.x + X0 + i * s;
  return {
    merge: k,
    shown,
    back,
    front,
    backTotal: back.map(sum),
    frontTotal: front.map(sum),
    ticks: ticksFor(dom[0], dom[1], 4),
    k: Math.max(0, wallBase - o.top) / (dom[1] || 1),
    s,
    w,
    floor,
    wallBase,
    top: o.top,
    shift: [lead * COS, lead * SIN],
    depthFront: FRONT_DEPTH * s,
    depthBack: depth * s,
    wallX: [o.x + X0 + deep * COS - 6, slotX(shown - 1) + w + deep * COS + 6],
    slotX,
  };
}

interface BlockGeom {
  x: number;
  base: number;
  w: number;
  d: number;
}

export function skylineScene(ctx: CategoryContext) {
  const model = skylineModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { fontSize } = ctx.frame;
  let { outer } = ctx.frame;
  const n = model.labels.length;
  if (n === 0 || outer.w <= 0 || outer.h <= 0) return noDataScene(ctx);
  const { props, input } = ctx;
  const fx = input.formatValue;
  const hasFront = model.front.names.length > 0;
  const frontRate = props.frontRate ?? "label";
  // 작은 상자에서는 띠 · 보조 라벨 자리가 그림을 밀어낸다 — 그림 높이가 글자 12 줄보다 낮으면 뺀다.
  const roomy = outer.h >= fontSize * 12;
  const strip = frontRate === "strip" && hasFront && roomy;
  const frontLabel =
    hasFront &&
    frontRate === "label" &&
    props.showValueLabels !== false &&
    roomy;
  const texture = props.texture ?? "front";
  const wall = props.wall !== false;
  const legendItems =
    model.back.names.length > 1 || hasFront
      ? [
          ...model.back.names.map((label, j) => ({
            label,
            seriesIndex: model.back.colors[j],
          })),
          ...model.front.names.map((label, j) => ({
            label,
            seriesIndex: model.front.colors[j],
          })),
        ]
      : [];
  const placed = seriesLegend(ctx, legendItems);
  const { legend } = placed;
  ctx = placed.ctx;
  outer = ctx.frame.outer;
  const below =
    SLAB + (strip ? 70 : frontLabel ? fontSize * 4.4 : fontSize * 2);
  const L = skylineLayout({
    x: outer.x,
    width: outer.w,
    height: outer.y + outer.h,
    back: model.back.values,
    front: model.front.values,
    n,
    depth:
      typeof props.depth === "number" && Number.isFinite(props.depth)
        ? props.depth
        : SKYLINE_DEPTH_RANGE[1],
    wall,
    top: outer.y + fontSize * 1.8,
    below,
    labelWidth: (max) =>
      Math.max(
        ...ticksFor(0, max, 4).map((t) => approxTextWidth(fx(t), fontSize)),
      ),
  });
  if (L.merge > 1)
    input.warning(
      "budget.rowsTruncated",
      `neighboring periods summed in groups of ${L.merge}`,
      String(n),
    );
  const empty =
    L.backTotal.every((v) => v === 0) && L.frontTotal.every((v) => v === 0);
  if (empty) return noDataScene(ctx);

  const periods = Array.from({ length: L.shown }, (_, i) => {
    const [a, end] = groupRange(i, n, L.merge);
    const b = end - 1;
    return a === b ? model.labels[a] : `${model.labels[a]}–${model.labels[b]}`;
  });
  const geom = (i: number, r: "back" | "front"): BlockGeom =>
    r === "back"
      ? {
          x: L.slotX(i) + L.shift[0],
          base: L.floor - L.shift[1],
          w: L.w,
          d: L.depthBack,
        }
      : { x: L.slotX(i), base: L.floor, w: L.w, d: L.depthFront };
  const marks: Mark[] = [];
  const box = { x: outer.x, y: outer.y, w: outer.w, h: outer.h };
  const poly = (
    pts: [number, number][],
    fill: Partial<PathMark>,
  ): PathMark => ({
    kind: "path",
    d: polygonPathOf(pts),
    bbox: box,
    ...fill,
  });
  // 뒷벽 + 눈금
  const wallTop = L.top - 10;
  const grid: LineMark[] = [];
  const wallTicks: TextMark[] = [];
  if (wall) {
    marks.push(
      poly(
        [
          [L.wallX[0], wallTop],
          [L.wallX[1], wallTop],
          [L.wallX[1], L.wallBase],
          [L.wallX[0], L.wallBase],
        ],
        { fillRole: "grid" },
      ),
    );
    // 눈금 간격이 글자보다 좁으면 (작은 상자) 맨 아래 · 맨 위만 글자를 단다.
    const tickGap =
      L.ticks.length > 1 ? (L.ticks[1] - L.ticks[0]) * L.k : Infinity;
    for (const [i, t] of L.ticks.entries()) {
      const ty = r2(L.wallBase - t * L.k);
      const labeled =
        tickGap >= fontSize * 1.2 || i === 0 || i === L.ticks.length - 1;
      grid.push({
        kind: "line",
        x1: r2(L.wallX[0]),
        y1: ty,
        x2: r2(L.wallX[1]),
        y2: ty,
        role: "grid",
      });
      if (labeled)
        wallTicks.push({
          kind: "text",
          x: r2(L.wallX[1] + 6),
          y: ty,
          text: fx(t),
          anchor: "start",
          baseline: "middle",
          role: "tick",
        });
    }
  }
  // 바닥
  const fx0 = L.slotX(0) - 8;
  const fx1 = L.slotX(L.shown - 1) + L.w + 8;
  const deep = (FRONT_DEPTH + GAP) * L.s + L.depthBack + 8;
  marks.push(
    poly(
      [
        [fx0, L.floor + SLAB],
        [fx1, L.floor + SLAB],
        [fx1 + deep * COS, L.floor + SLAB - deep * SIN],
        [fx0 + deep * COS, L.floor + SLAB - deep * SIN],
      ],
      { fillRole: "grid" },
    ),
    poly(
      [
        [fx0, L.floor + SLAB],
        [fx1, L.floor + SLAB],
        [fx1, L.floor + SLAB * 2],
        [fx0, L.floor + SLAB * 2],
      ],
      { fillRole: "axis" },
    ),
  );
  const prism = (
    g: BlockGeom,
    values: readonly number[],
    colors: readonly number[],
    hatch: boolean,
  ) => {
    const dx = g.d * COS;
    const dy = -g.d * SIN;
    const right = g.x + g.w;
    let prev = 0;
    values.forEach((v, j) => {
      const c = prev + v * L.k;
      if (c > prev) {
        const y0 = g.base - prev;
        const y1 = g.base - c;
        marks.push(
          poly(
            [
              [g.x, y1],
              [right, y1],
              [right, y0],
              [g.x, y0],
            ],
            { fillSeries: colors[j], fillOpacity: 1 },
          ),
          poly(
            [
              [right, y1],
              [right + dx, y1 + dy],
              [right + dx, y0 + dy],
              [right, y0],
            ],
            {
              fillSeries: colors[j],
              fillOpacity: 1,
            },
          ),
        );
      }
      prev = c;
    });
    const h = prev;
    if (h < 1) return;
    const top = g.base - h;
    // 옆면 그늘 (빛은 왼쪽 위).
    marks.push(
      poly(
        [
          [right, top],
          [right + dx, top + dy],
          [right + dx, g.base + dy],
          [right, g.base],
        ],
        { fillRole: "axis" },
      ),
    );
    if (hatch) {
      // 앞면 45° 빗금 — 선 묶음 (4px 간격).
      let d = "";
      for (let t = 4; t < g.w + h; t += 4) {
        const ax = g.x + Math.max(0, t - h);
        const ay = g.base - Math.min(t, h);
        const bx = g.x + Math.min(t, g.w);
        const by = g.base - Math.max(0, t - g.w);
        d += `M${r2(ax)},${r2(ay)}L${r2(bx)},${r2(by)}`;
      }
      if (d)
        marks.push({
          kind: "path",
          d,
          bbox: { x: r2(g.x), y: r2(top), w: r2(g.w), h: r2(h) },
          role: "grid",
          strokeWidth: 1.2,
        });
    }
    // 뚜껑
    marks.push(
      poly(
        [
          [g.x, top],
          [right, top],
          [right + dx, top + dy],
          [g.x + dx, top + dy],
        ],
        { fillRole: "grid" },
      ),
    );
  };
  const hatched = (r: "back" | "front") =>
    texture === "all" || (texture === "front" && r === "front");
  const targets: ChartTarget[] = [];
  for (let i = 0; i < L.shown; i++) {
    prism(geom(i, "back"), L.back[i], model.back.colors, hatched("back"));
    if (hasFront)
      prism(geom(i, "front"), L.front[i], model.front.colors, hatched("front"));
    const rate = L.backTotal[i] > 0 ? L.frontTotal[i] / L.backTotal[i] : null;
    const entries: ChartTarget["entries"][number][] = [
      ...model.back.names
        .map((name, j) => ({
          label: name,
          text: fx(L.back[i][j]),
          series: model.back.colors[j],
        }))
        .reverse(),
      ...(model.back.names.length > 1
        ? [
            {
              label: hasFront ? "Back total" : "Total",
              text: fx(L.backTotal[i]),
            },
          ]
        : []),
      ...model.front.names
        .map((name, j) => ({
          label: name,
          text: fx(L.front[i][j]),
          series: model.front.colors[j],
        }))
        .reverse(),
      ...(model.front.names.length > 1
        ? [{ label: "Front total", text: fx(L.frontTotal[i]) }]
        : []),
      ...(hasFront && frontRate !== "none"
        ? [
            {
              label: "Front ÷ back",
              text: rate === null ? "-" : pct(rate * 100),
            },
          ]
        : []),
    ];
    const g = geom(i, "back");
    targets.push({
      id: `period-${i}`,
      x: r2(g.x + (g.w + g.d * COS) / 2),
      y: r2(g.base - L.backTotal[i] * L.k - g.d * SIN),
      rect: {
        x: r2(L.slotX(i)),
        y: r2(wallTop),
        w: r2(L.s),
        h: r2(outer.y + outer.h - wallTop),
      },
      rows: [],
      title: periods[i],
      entries,
    });
  }
  const labels: TextMark[] = [];
  // 최고 기간 라벨
  const peakB = L.backTotal.indexOf(Math.max(...L.backTotal));
  if (props.showValueLabels !== false && roomy && L.backTotal[peakB] > 0) {
    const g = geom(peakB, "back");
    const text = `Peak ${fx(L.backTotal[peakB])}`;
    const x = Math.min(
      g.x + (g.w + g.d * COS) / 2,
      (wall ? L.wallX[1] : outer.x + outer.w - 2) -
        approxTextWidth(text, fontSize) / 2,
    );
    labels.push({
      kind: "text",
      x: r2(x),
      y: r2(g.base - L.backTotal[peakB] * L.k - g.d * SIN - fontSize),
      text,
      anchor: "middle",
      baseline: "middle",
      role: "value",
    });
  }
  // 비율 띠
  const stripTop = L.floor + SLAB + 20;
  const dateY = strip ? stripTop + STRIP_H + 14 : L.floor + SLAB * 2 + fontSize;
  if (strip) {
    const rates = L.backTotal.map((b, i) => (b > 0 ? L.frontTotal[i] / b : 0));
    const max = Math.max(0, ...rates);
    const top = niceDomain(0, max, 2)[1] || 1;
    const hi = max > 0 ? rates.indexOf(max) : -1;
    const bottom = stripTop + STRIP_H;
    grid.push(
      {
        kind: "line",
        x1: r2(fx0),
        y1: r2(stripTop),
        x2: r2(fx1),
        y2: r2(stripTop),
        role: "grid",
      },
      {
        kind: "line",
        x1: r2(fx0),
        y1: r2(bottom),
        x2: r2(fx1),
        y2: r2(bottom),
        role: "grid",
      },
    );
    rates.forEach((r, i) => {
      if (r <= 0) return;
      const h = (r / top) * STRIP_H;
      marks.push({
        kind: "rect",
        x: r2(L.slotX(i)),
        y: r2(bottom - h),
        w: r2(L.w),
        h: r2(h),
        seriesIndex: 0,
        fillPaint: i === hi ? "accent" : "neutral",
      });
    });
    labels.push({
      kind: "text",
      x: r2(fx0),
      y: r2(stripTop - fontSize * 0.7),
      text: "Front ÷ back",
      anchor: "start",
      baseline: "middle",
      role: "tick",
    });
  }
  // 기간 라벨
  const dateAxis = categoryLabels(
    ctx,
    periods,
    periods.map((_, i) => L.slotX(i) + L.w / 2),
    dateY,
  );
  // 앞줄 최고 라벨
  if (frontLabel) {
    const peakF = L.frontTotal.indexOf(Math.max(...L.frontTotal));
    if (L.frontTotal[peakF] > 0) {
      const rate =
        L.backTotal[peakF] > 0
          ? pct((L.frontTotal[peakF] / L.backTotal[peakF]) * 100)
          : "";
      labels.push({
        kind: "text",
        x: r2(L.slotX(peakF) + L.w / 2),
        y: r2(dateY + fontSize * 1.8),
        text: `Front peak ${periods[peakF]} · ${fx(L.frontTotal[peakF])}${rate ? ` (${rate})` : ""}`,
        anchor: "middle",
        baseline: "middle",
        role: "legend",
      });
    }
  }
  const axes: AxisScene[] = [
    { axis: "y", line: null, grid, ticks: wallTicks },
    dateAxis,
  ];
  return sceneOf(ctx, { marks: [...marks, ...labels], axes, legend, targets });
}
