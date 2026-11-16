/**
 * ADR-306 Phase 4 — histogram (breakdown §2.2 #25). 뜻은 ztd-charts 0.5.0 (`3c4376c`, MIT —
 * `src/charts/histogram.tsx`) 을 따른다: 그룹 둘까지 같은 경계 · 분위 선 (p50 실선 · 나머지 점선) ·
 * 기준값을 넘는 구간 강조 · 사전 집계 행 (구간 시작 · 끝 · 개수) · 모양 bar / dots / step · log 구간 ·
 * 밀도 곡선. 배치 비율은 ztd 값, 글자 크기만 rule metric.
 *
 * 편차: ztd 의 기준선 `side` (below) · 이름은 받지 않는다 — 기준값을 넘는 쪽이 나쁜 쪽이다 (`threshold`
 * 숫자 하나, pareto 의 같은 prop). 분위 · 기준 이름표의 바탕 (panel 색) 은 그리지 않는다.
 */
import { highlightIndex, highlightSet } from "../../highlight";
import { circlePath } from "../../marks/dots";
import { approxTextWidth, linearScale, r2 } from "../../scales";
import type {
  AxisScene,
  ChartTarget,
  LineMark,
  Mark,
  PathMark,
  TextMark,
} from "../../types";
import {
  fieldKey,
  numberList,
  readLabel,
  readNumber,
  requireField,
} from "../fields";
import { fitDomain, ticksFor } from "../niceScale";
import { roundRectPath, thinCentered } from "../shapes";
import {
  binCounts,
  binEdges,
  binIndex,
  decadeGrid,
  dotUnit,
  HISTOGRAM_MAX_GROUPS,
  kde,
  percentile,
} from "../stats";
import {
  invalidScene,
  noDataScene,
  sceneOf,
  tickColumnWidth,
  valueAxisY,
  type CategoryContext,
} from "../category/common";

export interface HistogramBin {
  x0: number;
  x1: number;
  /** 그리는 그룹마다 개수 */
  counts: number[];
  /** 그 구간에 든 원본 행 */
  rows: number[];
}

export interface HistogramSample {
  name: string;
  /** 구간 안 + 경계 밖 (log 의 0 이하 제외) */
  n: number;
  /** 원시 표본 (사전 집계면 빈 배열) */
  values: number[];
  outside: number;
  excluded: number;
}

export interface HistogramModel {
  bins: HistogramBin[];
  samples: HistogramSample[];
  /** 데이터의 그룹 수 (그리는 것은 앞의 `HISTOGRAM_MAX_GROUPS`) */
  groupCount: number;
  binned: boolean;
  log: boolean;
  /** 그룹마다 분위 선 (`percentiles` 순) · 중앙값 */
  quantiles: { median: number; marks: { p: number; v: number }[] }[];
  threshold: number | null;
}

const DEFAULT_MARKS = [50, 95];

/** 분위 (0~100). 원시 표본은 `percentile`, 사전 집계는 구간 안을 선형 (log 면 로그) 으로 나눠 어림. */
export function histogramQuantile(
  model: Pick<HistogramModel, "bins" | "samples" | "binned" | "log">,
  k: number,
  p: number,
): number {
  const s = model.samples[k];
  if (!model.binned) return percentile(s.values, p);
  const target = (p / 100) * s.n;
  let acc = 0;
  for (const b of model.bins) {
    const c = b.counts[k];
    if (c > 0 && acc + c >= target) {
      const f = (target - acc) / c;
      return model.log
        ? 10 ** (Math.log10(b.x0) + f * (Math.log10(b.x1) - Math.log10(b.x0)))
        : b.x0 + f * (b.x1 - b.x0);
    }
    acc += c;
  }
  return NaN;
}

/** 구간 폭 가운데 기준을 넘은 몫 (0~1, 축 단위). */
export function pastShare(b: HistogramBin, t: number, log: boolean): number {
  const f = log ? Math.log10 : (v: number) => v;
  if (log && t <= 0) return 1;
  const k = (f(t) - f(b.x0)) / (f(b.x1) - f(b.x0));
  return Math.max(0, Math.min(1, 1 - k));
}

export function histogramModel(ctx: CategoryContext): HistogramModel | null {
  const { props, rows, input } = ctx;
  const log = props.log === true;
  const binned = fieldKey(props.countField) !== null;
  const group = fieldKey(props.color);
  const groupOf = (i: number) =>
    group === null ? "" : readLabel(rows[i], group);
  const names: string[] = [];
  const seen = new Map<string, number>();
  let bins: HistogramBin[] = [];
  let samples: HistogramSample[] = [];

  if (binned) {
    const x0k = requireField(input, "Bin Start", props.binStartField);
    const x1k = requireField(input, "Bin End", props.binEndField);
    const ck = fieldKey(props.countField);
    if (!input.ok || x0k === null || x1k === null || ck === null) return null;
    const excluded = new Map<string, number>();
    const cells = new Map<
      string,
      { x0: number; x1: number; by: Map<string, number>; rows: number[] }
    >();
    rows.forEach((row, i) => {
      const x0 = readNumber(row, x0k);
      const x1 = readNumber(row, x1k);
      const n = readNumber(row, ck);
      if (!(Number.isFinite(x0) && x1 > x0 && Number.isFinite(n) && n >= 0))
        return;
      const g = groupOf(i);
      if (!seen.has(g)) {
        seen.set(g, seen.size);
        excluded.set(g, 0);
      }
      if (log && x0 <= 0) {
        excluded.set(g, excluded.get(g)! + n);
        return;
      }
      const key = `${x0}|${x1}`;
      let cell = cells.get(key);
      if (!cell) cells.set(key, (cell = { x0, x1, by: new Map(), rows: [] }));
      cell.by.set(g, (cell.by.get(g) ?? 0) + n);
      cell.rows.push(i);
    });
    names.push(...[...seen.keys()].slice(0, HISTOGRAM_MAX_GROUPS));
    for (const cell of [...cells.values()].sort(
      (a, b) => a.x0 - b.x0 || a.x1 - b.x1,
    )) {
      const last = bins[bins.length - 1];
      if (last && cell.x0 > last.x1)
        bins.push({
          x0: last.x1,
          x1: cell.x0,
          counts: names.map(() => 0),
          rows: [],
        });
      bins.push({
        x0: cell.x0,
        x1: cell.x1,
        counts: names.map((g) => cell.by.get(g) ?? 0),
        rows: cell.rows,
      });
    }
    samples = names.map((name, k) => ({
      name,
      n: bins.reduce((s, b) => s + b.counts[k], 0),
      values: [],
      outside: 0,
      excluded: excluded.get(name) ?? 0,
    }));
  } else {
    const metric = requireField(input, "Value", props.metric);
    if (!input.ok || metric === null) return null;
    const by = new Map<
      string,
      { values: number[]; rows: number[]; excluded: number }
    >();
    rows.forEach((row, i) => {
      const v = readNumber(row, metric);
      if (!Number.isFinite(v)) return;
      const g = groupOf(i);
      let s = by.get(g);
      if (!s) by.set(g, (s = { values: [], rows: [], excluded: 0 }));
      if (log && v <= 0) s.excluded++;
      else {
        s.values.push(v);
        s.rows.push(i);
      }
    });
    names.push(...[...by.keys()].slice(0, HISTOGRAM_MAX_GROUPS));
    for (const g of by.keys()) seen.set(g, seen.size);
    const edgeList = numberList(props.edges);
    const edges = names.length
      ? binEdges(
          names.flatMap((g) => by.get(g)!.values),
          {
            edges: edgeList.length ? edgeList : undefined,
            binWidth:
              typeof props.binWidth === "number" ? props.binWidth : undefined,
            bins: typeof props.bins === "number" ? props.bins : undefined,
            log,
          },
        )
      : [];
    const counted = names.map((g) => binCounts(by.get(g)!.values, edges));
    bins = edges.slice(1).map((x1, i) => ({
      x0: edges[i],
      x1,
      counts: counted.map((c) => c.counts[i]),
      rows: [],
    }));
    names.forEach((g) => {
      const s = by.get(g)!;
      s.values.forEach((v, j) => {
        const k = binIndex(edges, v);
        if (k >= 0) bins[k].rows.push(s.rows[j]);
      });
    });
    samples = names.map((name, k) => ({
      name,
      n: by.get(name)!.values.length,
      values: by.get(name)!.values,
      outside: counted[k].outside,
      excluded: by.get(name)!.excluded,
    }));
  }

  if (seen.size > names.length)
    input.warning(
      "budget.groupsTruncated",
      `Only the first ${names.length} of ${seen.size} groups are drawn`,
      String(seen.size),
    );
  const outside = samples.reduce((s, x) => s + x.outside, 0);
  const excluded = samples.reduce((s, x) => s + x.excluded, 0);
  if (outside > 0)
    input.warning(
      "values.excluded",
      `${outside} outside the edges`,
      String(outside),
    );
  if (excluded > 0)
    input.warning(
      "values.excluded",
      `${excluded} at or below 0 left out`,
      String(excluded),
    );

  const marksP = (
    Array.isArray(props.percentiles)
      ? numberList(props.percentiles)
      : DEFAULT_MARKS
  ).filter((p) => p >= 0 && p <= 100);
  const base = { bins, samples, binned, log };
  const quantiles = samples.map((_, k) => {
    const marks = marksP.map((p) => ({ p, v: histogramQuantile(base, k, p) }));
    return {
      median:
        marks.find((m) => m.p === 50)?.v ?? histogramQuantile(base, k, 50),
      marks,
    };
  });
  const threshold =
    typeof props.threshold === "number" && Number.isFinite(props.threshold)
      ? props.threshold
      : null;
  return {
    bins,
    samples,
    groupCount: seen.size,
    binned,
    log,
    quantiles,
    threshold,
  };
}

/** 구간 윗변을 잇는 계단 윤곽 (`ex` 경계 픽셀 · `tops` 구간 윗변 픽셀) — [a, b] 밖은 자른다. */
export function stepPath(
  ex: readonly number[],
  tops: readonly number[],
  base: number,
  a = -Infinity,
  b = Infinity,
): string {
  const n = tops.length;
  const inside = (i: number) => Math.min(ex[i + 1], b) > Math.max(ex[i], a);
  let d = "";
  for (let i = 0; i < n; i++) {
    if (!inside(i)) continue;
    let j = i;
    while (j + 1 < n && inside(j + 1)) j++;
    const l = Math.max(ex[i], a);
    const r = Math.min(ex[j + 1], b);
    d += `M${r2(l)},${r2(l === ex[i] ? Math.max(i ? tops[i - 1] : base, tops[i]) : tops[i])}V${r2(tops[i])}`;
    for (let k = i; k < j; k++) d += `H${r2(ex[k + 1])}V${r2(tops[k + 1])}`;
    d += `H${r2(r)}`;
    if (r === ex[j + 1])
      d += `V${r2(Math.max(j + 1 < n ? tops[j + 1] : base, tops[j]))}`;
    i = j;
  }
  return d;
}

/** 이어진 인덱스를 [첫, 끝] 묶음으로. */
function runs(idx: ReadonlySet<number>, n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    if (!idx.has(i)) continue;
    let j = i;
    while (idx.has(j + 1)) j++;
    out.push([i, j]);
    i = j;
  }
  return out;
}

interface Tag {
  key: string;
  at: number;
  x: number;
  w: number;
  row: number;
  text: string;
  dash?: readonly number[];
  accent: boolean;
}

/** 선 이름표가 겹치지 않게 — 자리 후보 (가운데 · 오른쪽 · 왼쪽) 를 차례로, 안 되면 다음 줄 (ztd `placeTags`). */
function placeTags(
  tags: Omit<Tag, "x" | "w" | "row">[],
  lo: number,
  hi: number,
  fontSize: number,
): Tag[] {
  const sorted = [...tags].sort((a, b) => a.at - b.at);
  const place = (order: number[]) => {
    const rows: [number, number][][] = [];
    return sorted.map((t) => {
      const w = approxTextWidth(t.text, fontSize) + 10;
      const spots = [t.at, t.at + w / 2 - 4, t.at - w / 2 + 4].map((x) =>
        Math.max(lo + w / 2, Math.min(hi - w / 2, x)),
      );
      for (let row = 0; row < 50; row++) {
        const used = (rows[row] ??= []);
        const x = order
          .map((k) => spots[k])
          .find((s) =>
            used.every(([a, b]) => s + w / 2 + 4 <= a || s - w / 2 - 4 >= b),
          );
        if (x === undefined) continue;
        used.push([x - w / 2, x + w / 2]);
        return { ...t, x, w, row };
      }
      return { ...t, x: spots[0], w, row: 0 };
    });
  };
  const rowsOf = (list: Tag[]) => Math.max(0, ...list.map((t) => t.row));
  const centered = place([0, 1, 2]);
  const leftFirst = place([2, 0, 1]);
  return rowsOf(leftFirst) < rowsOf(centered) ? leftFirst : centered;
}

const dashOf = (p: number): readonly number[] | undefined =>
  p === 50 ? undefined : p === 99 ? [1.5, 2.5] : [4, 3];

const KDE_SAMPLES = 96;

export function histogramScene(ctx: CategoryContext) {
  const model = histogramModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  const { bins, samples, log } = model;
  const n = bins.length;
  if (n === 0 || outer.w <= 0 || outer.h <= 0) return noDataScene(ctx);
  const { props, input } = ctx;
  const fx = input.formatValue;
  const grouped = samples.length > 1;
  const shape =
    props.shape === "dots" || props.shape === "step" ? props.shape : "bar";
  const dots = shape === "dots" && !grouped;
  const step = shape === "step";
  const th = model.threshold;
  const showLabels = props.showValueLabels !== false;

  const lo = bins[0].x0;
  const hi = bins[n - 1].x1;
  const T = log ? Math.log10 : (v: number) => v;
  const showKde = props.kde === true && !model.binned;
  let density: { xs: number[]; curves: number[][] } | null = null;
  if (showKde) {
    const [a, z] = [T(lo), T(hi)];
    const xs = Array.from(
      { length: KDE_SAMPLES },
      (_, k) => a + ((z - a) * k) / (KDE_SAMPLES - 1),
    );
    const w = (z - a) / n;
    density = {
      xs,
      curves: samples.map((s) =>
        kde(s.values.map(T), xs).map((d) => d * s.n * w),
      ),
    };
  }

  // 강조: 그룹이 있으면 첫 그룹 (윤곽), 없으면 기준을 넘은 구간 · 기준이 없으면 가장 높은 구간.
  //   ADR-306 Phase 6 — `highlight` 가 그룹 (이름 · 표본 수, ztd 기본 first) 이나 구간 (구간 글자 · 개수,
  //   ztd 기본 max) 을 고른다. 기준 (`threshold`) 이 있으면 구간 강조는 기준이 정한다 (ztd 와 같다).
  const hiGroup = grouped
    ? highlightIndex(
        props.highlight,
        samples.map((s) => s.name),
        samples.map((s) => s.n),
        0,
      )
    : -1;
  const counts0 = bins.map((b) => b.counts[0]);
  const maxCount = Math.max(0, ...bins.flatMap((b) => b.counts));
  // 지정한 강조는 기준 (`threshold`) 의 넘는 쪽 칠보다 앞선다 (기준선은 그대로) — ztd 는 기준이 있으면
  //   강조를 무시하지만, 그러면 패널의 칸이 아무 일도 하지 않는다.
  const picked = !grouped
    ? highlightSet(
        props.highlight,
        bins.map((b) => `${fx(b.x0)} – ${fx(b.x1)}`),
        counts0,
      )
    : null;
  const hiBins = picked ?? new Set<number>();
  if (!picked && !grouped && th === null && maxCount > 0)
    hiBins.add(counts0.indexOf(maxCount));
  const fillK = grouped && hiGroup === 0 ? 1 : 0;
  const lineK = grouped ? 1 - fillK : 0;

  const bottomRoom = fontSize + 10;
  const base = outer.y + outer.h - bottomRoom;
  const tickCount = Math.max(2, Math.round(outer.h / 70));
  const dom = fitDomain(
    0,
    Math.max(1, maxCount, ...(density?.curves.flat() ?? [])),
    tickCount,
  );
  const yTicks = ticksFor(dom[0], dom[1], tickCount).filter((t) =>
    Number.isInteger(t),
  );
  const left = dots ? 8 : tickColumnWidth(yTicks, fx, fontSize);
  const xl = outer.x + left + 2;
  const xr = outer.x + outer.w - 4;
  const sx = linearScale([T(lo), T(hi)], [xl, xr]);
  const X = (v: number) => sx(T(v));
  const inDomain = (v: number) =>
    Number.isFinite(v) && v >= lo && v <= hi && (!log || v > 0);

  const tagH = fontSize * 1.4;
  const qs = model.quantiles[Math.max(0, hiGroup)];
  const rawTags: Omit<Tag, "x" | "w" | "row">[] = [
    ...(qs?.marks ?? [])
      .filter((m) => inDomain(m.v))
      .map((m) => ({
        key: `p${m.p}`,
        at: X(m.v),
        text: `p${m.p} ${fx(m.v)}`,
        dash: dashOf(m.p),
        accent: grouped,
      })),
    ...(th !== null && inDomain(th)
      ? [{ key: "threshold", at: X(th), text: fx(th), accent: !grouped }]
      : []),
  ];
  // 이름표는 값 글자를 켰고 그림이 글자 10 줄보다 높을 때만 (작은 상자는 선만).
  const labeled = showLabels && outer.h >= fontSize * 10;
  const tags: Tag[] = labeled
    ? placeTags(rawTags, outer.x + 4, outer.x + outer.w - 4, fontSize)
    : rawTags.map((t) => ({ ...t, x: t.at, w: 0, row: 0 }));
  const tagRows = labeled ? Math.max(0, ...tags.map((t) => t.row + 1)) : 0;
  // 점 모양은 맨 위 한 줄을 「1 dot = N」 머리글로 비운다 (ztd HEAD_H).
  const head = dots ? fontSize * 1.5 : 0;
  const tagY = (row: number) => outer.y + head + row * (tagH + 3);
  const top = tagY(tagRows) + (tagRows ? 4 : fontSize * 0.5);
  if (base - top < 8) return sceneOf(ctx, { marks: [] });

  const minPx = Math.min(...bins.map((b) => X(b.x1) - X(b.x0)));
  const rMax = Math.max(1.5, Math.min(6, minPx / 2 - 1));
  const rMin = Math.min(rMax, 2.5);
  const unit = dots ? dotUnit(maxCount, (base - top) / (rMin * 2 + 1.5)) : 1;
  const rad = Math.max(
    rMin,
    Math.min(
      rMax,
      ((base - top) / Math.max(1, Math.ceil(maxCount / unit)) - 1.5) / 2,
    ),
  );
  const pitch = rad * 2 + 1.5;
  const yv = linearScale(dom, [base, top]);
  const y = dots ? (v: number) => base - (v / unit) * pitch : yv;
  const yTop = (cnt: number, at: number) =>
    cnt > 0 && base - at < 1 ? base - 1 : at;
  const tpx = th !== null && inDomain(th) ? X(th) : null;
  const ex = [X(bins[0].x0), ...bins.map((b) => X(b.x1))];
  const isHot = (i: number) =>
    hiBins.has(i) ||
    (!picked && th !== null && pastShare(bins[i], th, log) >= 0.5);

  const marks: Mark[] = [];
  const axes: AxisScene[] = [];
  if (!dots)
    axes.push(valueAxisY(ctx, dom, yTicks, yv, outer.x + left, xr, fx));

  // 막대 (step 이 아니면) — 그룹이 있으면 채움 그룹 하나, 없으면 기준이 걸친 구간을 두 색으로.
  if (!step && !dots)
    bins.forEach((b, i) => {
      const xa = X(b.x0) + 0.5;
      const xb = X(b.x1) - 0.5;
      const w = xb - xa;
      const cnt = b.counts[fillK];
      if (w <= 0 || cnt <= 0) return;
      const at = yTop(cnt, y(cnt));
      const r = Math.min(2, w / 4);
      const sh = th !== null && !grouped && !picked ? pastShare(b, th, log) : 0;
      const bbox = (x: number, ww: number) => ({
        x: r2(x),
        y: r2(at),
        w: r2(ww),
        h: r2(base - at),
      });
      if (sh <= 0 || sh >= 1 || tpx === null) {
        marks.push({
          kind: "path",
          d: roundRectPath(xa, at, w, base - at, { tl: r, tr: r }),
          bbox: bbox(xa, w),
          fillPaint: sh >= 1 || hiBins.has(i) ? "accent" : "neutral",
        });
        return;
      }
      const cut = Math.max(xa, Math.min(xb, tpx));
      marks.push(
        {
          kind: "path",
          d: roundRectPath(xa, at, cut - xa, base - at, { tl: r }),
          bbox: bbox(xa, cut - xa),
          fillPaint: "neutral",
        },
        {
          kind: "path",
          d: roundRectPath(cut, at, xb - cut, base - at, { tr: r }),
          bbox: bbox(cut, xb - cut),
          fillPaint: "accent",
        },
      );
    });

  // 점 기둥 — 채운 점 floor(개수 / N) 개 + 나머지가 있으면 빈 원 하나.
  if (dots)
    bins.forEach((b, i) => {
      const cnt = b.counts[0];
      const full = Math.floor(cnt / unit);
      const ring = cnt % unit > 0;
      const cx = r2((X(b.x0) + X(b.x1)) / 2);
      const paint = isHot(i) ? "accent" : "neutral";
      for (let j = 0; j < full; j++) {
        const cy = base - pitch * (j + 0.5);
        marks.push({
          kind: "path",
          d: circlePath(cx, cy, rad),
          bbox: {
            x: r2(cx - rad),
            y: r2(cy - rad),
            w: r2(rad * 2),
            h: r2(rad * 2),
          },
          fillPaint: paint,
        });
      }
      if (ring) {
        const cy = base - pitch * (full + 0.5);
        const rr = rad - 0.65;
        marks.push({
          kind: "path",
          d: circlePath(cx, cy, rr),
          bbox: {
            x: r2(cx - rr),
            y: r2(cy - rr),
            w: r2(rr * 2),
            h: r2(rr * 2),
          },
          strokePaint: paint,
          strokeWidth: 1.3,
        });
      }
    });

  // 윤곽 — 그룹의 선 그룹 (step 이면 둘 다) · 하나뿐이면 강조 구간 (또는 기준을 넘은 쪽) 만 accent 로 덧그린다.
  const outlines = grouped
    ? step
      ? [fillK, lineK]
      : [lineK]
    : step
      ? [0]
      : [];
  const bounds = { x: r2(xl), y: r2(top), w: r2(xr - xl), h: r2(base - top) };
  for (const k of outlines) {
    const tops = bins.map((b) => yTop(b.counts[k], y(b.counts[k])));
    const strong = grouped && k === lineK;
    marks.push({
      kind: "path",
      d: stepPath(ex, tops, base),
      bbox: bounds,
      ...(strong
        ? { strokePaint: "accent" as const }
        : { role: "axis" as const }),
      strokeWidth: strong ? 2 : 1.6,
    });
    if (!grouped) {
      const ranges: [number, number][] =
        th !== null
          ? tpx === null
            ? []
            : [[tpx, Infinity]]
          : runs(hiBins, n).map(([a, z]) => [ex[a], ex[z + 1]]);
      for (const [a, z] of ranges)
        marks.push({
          kind: "path",
          d: stepPath(ex, tops, base, a, z),
          bbox: bounds,
          strokePaint: "accent",
          strokeWidth: 2,
        });
    }
  }

  // 밀도 곡선.
  density?.curves.forEach((cv, k) => {
    const pts = cv.map(
      (v, j) => [r2(sx(density!.xs[j])), r2(Math.max(top, y(v)))] as const,
    );
    const path: PathMark = {
      kind: "path",
      d: pts.map(([px, py], j) => `${j ? "L" : "M"}${px},${py}`).join(""),
      bbox: bounds,
      strokeWidth: 1.6,
      ...(grouped && k === hiGroup
        ? { strokePaint: "accent" as const }
        : { role: "axis" as const }),
    };
    marks.push(path);
  });

  // 분위 · 기준 선 + 이름표.
  const texts: TextMark[] = [];
  for (const t of tags) {
    const line: LineMark = {
      kind: "line",
      x1: r2(t.at),
      y1: r2(labeled ? tagY(t.row) + tagH : top),
      x2: r2(t.at),
      y2: r2(base),
      role: "axis",
      width: t.key === "threshold" ? 1.5 : 1.4,
      ...(t.accent ? { paint: "accent" as const } : {}),
      ...(t.dash ? { dash: t.dash } : {}),
    };
    marks.push(line);
    if (labeled)
      texts.push({
        kind: "text",
        x: r2(t.x),
        y: r2(tagY(t.row) + tagH / 2),
        text: t.text,
        anchor: "middle",
        baseline: "middle",
        role: "value",
      });
  }

  // 점 모양 — 점 하나가 몇 건인지 (ztd 머리글 「1 dot = N samples」).
  if (dots)
    texts.push({
      kind: "text",
      x: r2(xr),
      y: r2(outer.y + head / 2),
      text: `1 dot = ${unit}`,
      anchor: "end",
      baseline: "middle",
      role: "legend",
    });

  // x 눈금.
  const xTicks = log
    ? (() => {
        const perDecade = (xr - xl) / Math.max(1e-9, Math.log10(hi / lo));
        const pick = (steps: number[]) =>
          decadeGrid(lo, hi, steps).filter(
            (v) => v >= lo * (1 - 1e-9) && v <= hi * (1 + 1e-9),
          );
        const ticks = pick(perDecade >= 110 ? [1, 2, 5] : [1]);
        return ticks.length >= 2 ? ticks : pick([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      })()
    : (() => {
        const count = Math.round((xr - xl) / 70);
        let out: number[] = [];
        for (
          let k = Math.max(2, count);
          k <= Math.max(2, count) + 4 && out.length < 3;
          k++
        )
          out = ticksFor(lo, hi, k).filter(
            (t) => t >= lo - 1e-9 && t <= hi + 1e-9,
          );
        return out;
      })();
  axes.push({
    axis: "x",
    line: dots
      ? {
          kind: "line",
          x1: r2(xl),
          y1: r2(base),
          x2: r2(xr),
          y2: r2(base),
          role: "axis",
        }
      : null,
    grid: [],
    ticks: thinCentered(
      xTicks.map((t) => ({
        kind: "text" as const,
        x: r2(X(t)),
        y: r2(base + fontSize * 0.5 + 5),
        text: fx(t),
        anchor: "middle" as const,
        baseline: "middle" as const,
        role: "tick" as const,
      })),
      fontSize,
    ),
  });

  // hover 대상 — 구간 기둥.
  const cums = samples.map((_, k) => {
    let acc = 0;
    return bins.map((b) => (acc += b.counts[k]));
  });
  const share = (k: number, v: number) =>
    samples[k].n ? `${Math.round((v / samples[k].n) * 1000) / 10}%` : "0%";
  const targets: ChartTarget[] = bins.map((b, i) => {
    const tallest = Math.max(...b.counts);
    return {
      id: `bin-${i}`,
      x: r2((X(b.x0) + X(b.x1)) / 2),
      y: r2(dots ? base - Math.ceil(tallest / unit) * pitch : y(tallest)),
      rect: {
        x: r2(X(b.x0)),
        y: r2(top),
        w: r2(Math.max(0, X(b.x1) - X(b.x0))),
        h: r2(base - top),
      },
      rows: b.rows,
      title: `${fx(b.x0)} – ${fx(b.x1)}`,
      entries: samples.flatMap((s, k) => [
        {
          label: grouped ? s.name : "Count",
          text: `${b.counts[k]} · ${share(k, b.counts[k])}`,
          paint: (grouped ? k === hiGroup : isHot(i))
            ? ("accent" as const)
            : ("neutral" as const),
        },
        { label: "Cumulative", text: share(k, cums[k][i]) },
      ]),
    };
  });

  return sceneOf(ctx, { marks: [...marks, ...texts], axes, targets });
}
