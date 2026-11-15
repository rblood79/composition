/**
 * ADR-306 Phase 4 — 분포 통계의 이식. ztd-charts 0.5.0 `src/layout/stats.ts` (`boxStats` · `kde` ·
 * `beeswarm` · `binEdges` · `binIndex` · `binCounts` · `dotUnit` · `decadeGrid`) 과 `src/core/geometry.ts`
 * `quantileSorted` · `src/data/percentile.ts` `percentile` 의 식을 그대로 옮겼다 (이름 · 기본값 · 상수 유지).
 *
 * 출처: https://github.com/Junhan2/ztd-charts `3c4376cda61361d630ae4cc7bd472af64ba30d2e`
 * MIT License — Copyright (c) Junhan2 and contributors.
 *
 * 모두 크기 독립 (beeswarm 만 픽셀 x · 반지름을 받는 배치) 이고 React · DOM 의존이 없다.
 */

/** 정렬된 값의 q 분위 (0~1). 두 값 사이는 선형 보간 (엑셀 PERCENTILE.INC · numpy 기본값). */
export function quantileSorted(sorted: ArrayLike<number>, q: number): number {
  if (!sorted.length) return NaN;
  const p = (sorted.length - 1) * q;
  const b = Math.floor(p);
  const r = p - b;
  return sorted[b + 1] !== undefined
    ? sorted[b] + r * (sorted[b + 1] - sorted[b])
    : sorted[b];
}

/** 값 목록의 p 백분위 (0~100). 숫자가 아닌 값은 빼고, 남는 값이 없거나 p 가 범위 밖이면 NaN. */
export function percentile(values: readonly number[], p: number): number {
  if (!(p >= 0 && p <= 100)) return NaN;
  const sorted = Float64Array.from(values.filter(Number.isFinite)).sort();
  return quantileSorted(sorted, p / 100);
}

export interface BoxStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  /** 수염 끝. 기본은 사분위 범위 1.5 배 안에서 가장 먼 값 (Tukey), whiskers 를 주면 그 백분위 */
  lo: number;
  hi: number;
  mean: number;
  outliers: number[];
  n: number;
}

/** 사분위 · 수염 · 이상값. whiskers 는 수염 끝 백분위 [낮은 쪽, 높은 쪽] (0~100), 없으면 Tukey. */
export function boxStats(
  values: readonly number[],
  whiskers?: readonly [number, number],
): BoxStats {
  const s = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const n = s.length;
  if (!n)
    return {
      min: NaN,
      q1: NaN,
      median: NaN,
      q3: NaN,
      max: NaN,
      lo: NaN,
      hi: NaN,
      mean: NaN,
      outliers: [],
      n: 0,
    };
  const q1 = quantileSorted(s, 0.25);
  const median = quantileSorted(s, 0.5);
  const q3 = quantileSorted(s, 0.75);
  const iqr = q3 - q1;
  const loF = whiskers ? quantileSorted(s, whiskers[0] / 100) : q1 - 1.5 * iqr;
  const hiF = whiskers ? quantileSorted(s, whiskers[1] / 100) : q3 + 1.5 * iqr;
  let lo = s[0];
  let hi = s[n - 1];
  for (const v of s)
    if (v >= loF) {
      lo = v;
      break;
    }
  for (let i = n - 1; i >= 0; i--)
    if (s[i] <= hiF) {
      hi = s[i];
      break;
    }
  let total = 0;
  for (const v of s) total += v;
  return {
    min: s[0],
    q1,
    median,
    q3,
    max: s[n - 1],
    lo: whiskers ? loF : lo,
    hi: whiskers ? hiF : hi,
    mean: total / n,
    outliers: s.filter((v) => v < loF || v > hiF),
    n,
  };
}

/** 가우시안 커널 밀도 추정 (Silverman 대역폭). 값이 2,000 개를 넘으면 512 구간 묶음으로 근사. */
export function kde(
  values: readonly number[],
  xs: readonly number[],
  bandwidth?: number,
): number[] {
  const v = values.filter((x) => Number.isFinite(x));
  const n = v.length;
  if (!n) return xs.map(() => 0);
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const range = xs.length > 1 ? Math.abs(xs[xs.length - 1] - xs[0]) : 0;
  const fallback = range > 0 ? range / 40 : Math.abs(mean) * 0.05 || 1;
  const sd =
    Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / n) || fallback;
  const s = [...v].sort((a, b) => a - b);
  const iqr = quantileSorted(s, 0.75) - quantileSorted(s, 0.25);
  const spread = Math.min(sd, iqr > 0 ? iqr / 1.34 : sd) || sd;
  const bw =
    bandwidth !== undefined && bandwidth > 0
      ? bandwidth
      : Math.max(1e-9, 0.9 * spread * Math.pow(n, -0.2));
  const k = 1 / (Math.sqrt(2 * Math.PI) * bw * n);
  if (n > 2000) {
    const bins = 512;
    const lo = s[0];
    const hi = s[n - 1];
    const step = (hi - lo) / bins || 1;
    const counts = new Array<number>(bins + 1).fill(0);
    for (const x of v) counts[Math.min(bins, Math.floor((x - lo) / step))]++;
    return xs.map((x) => {
      let acc = 0;
      for (let b = 0; b <= bins; b++) {
        if (!counts[b]) continue;
        const u = (x - (lo + b * step)) / bw;
        if (u > 6 || u < -6) continue;
        acc += counts[b] * Math.exp(-0.5 * u * u);
      }
      return acc * k;
    });
  }
  return xs.map((x) => {
    let acc = 0;
    for (const t of v) {
      const u = (x - t) / bw;
      if (u > 6 || u < -6) continue;
      acc += Math.exp(-0.5 * u * u);
    }
    return acc * k;
  });
}

/**
 * 비스웜 배치 — x 는 고정, 원끼리 겹치지 않게 y 를 위아래로 민다. x 순서로 놓으며 2r 안의 원들이
 * 막는 y 구간을 합쳐 0 이 비면 0, 아니면 가까운 끝. 띠 (`maxSpread`) 가 차면 황금비 수열로 흩는다.
 */
export function beeswarm(
  xs: readonly number[],
  radius: number,
  opts: { maxSpread?: number; padding?: number } = {},
): number[] {
  const r = radius + (opts.padding ?? 0.6);
  const d = 2 * r;
  const d2 = d * d;
  const n = xs.length;
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => xs[a] - xs[b],
  );
  const px = new Float64Array(n);
  const py = new Float64Array(n);
  const ys = new Array<number>(n).fill(0);
  const limit = opts.maxSpread ?? Infinity;
  let starts = new Float64Array(64);
  let ends = new Float64Array(64);
  let head = 0;
  let count = 0;
  let overflow = 0;
  for (const i of order) {
    const x = xs[i];
    while (head < count && px[head] < x - d) head++;
    if (count - head > starts.length) {
      starts = new Float64Array(2 * (count - head));
      ends = new Float64Array(starts.length);
    }
    let w = 0;
    for (let j = head; j < count; j++) {
      const dx = x - px[j];
      const h2 = d2 - 1e-6 - dx * dx;
      if (h2 <= 0) continue;
      const h = Math.sqrt(h2);
      starts[w] = py[j] - h;
      ends[w] = py[j] + h;
      w++;
    }
    let y = 0;
    if (w > 0) {
      const S = starts.subarray(0, w).sort();
      const E = ends.subarray(0, w).sort();
      let si = 0;
      let depth = 0;
      let open = 0;
      for (let ei = 0; ei < w;) {
        if (si < w && S[si] < E[ei]) {
          if (depth === 0) {
            open = S[si];
            if (open >= 0) break;
          }
          depth++;
          si++;
        } else {
          depth--;
          if (depth === 0 && E[ei] > 0) {
            const near = -open < E[ei] - 1e-6 ? open : E[ei];
            const far = near === open ? E[ei] : open;
            y =
              Math.abs(near) <= limit
                ? near
                : Math.abs(far) <= limit
                  ? far
                  : NaN;
            break;
          }
          ei++;
        }
      }
    }
    if (Number.isNaN(y)) {
      ys[i] = (((overflow++ * 0.6180339887498949) % 1) * 2 - 1) * limit;
      continue;
    }
    ys[i] = y;
    px[count] = x;
    py[count] = y;
    count++;
  }
  return ys;
}

/** 히스토그램 구간 나누기. 순서는 edges → binWidth → bins → 자동 (Freedman-Diaconis, 30 개 미만은 Sturges). */
export interface BinOptions {
  edges?: readonly number[];
  binWidth?: number;
  bins?: number;
  log?: boolean;
}

/** 히스토그램이 겹쳐 그리는 그룹 수. 더 많으면 앞의 둘만 그리고 진단한다. */
export const HISTOGRAM_MAX_GROUPS = 2;
const MAX_AUTO_BINS = 50;
const MAX_BINS = 200;
const NICE = [1, 2, 2.5, 5, 10];
const LOG_STEPS = [
  [1],
  [1, 3],
  [1, 2, 5],
  [1, 1.6, 2.5, 4, 6.3],
  [1, 1.25, 1.6, 2, 2.5, 3.15, 4, 5, 6.3, 8],
];

const tidy = (v: number) => Number(v.toPrecision(12));

function niceWidth(w: number, up = false): number {
  const p = 10 ** Math.floor(Math.log10(w));
  const list = NICE.map((m) => tidy(m * p));
  if (up) return list.find((c) => c >= w * (1 - 1e-9)) ?? tidy(10 * p);
  return list.reduce((best, c) =>
    Math.abs(Math.log(c / w)) < Math.abs(Math.log(best / w)) ? c : best,
  );
}

function linearEdges(lo: number, hi: number, w: number): number[] {
  const start = Math.floor(lo / w + 1e-9) * w;
  const n = Math.max(1, Math.ceil((hi - start) / w - 1e-9));
  const out = Array.from({ length: n + 1 }, (_, i) => tidy(start + i * w));
  if (out[0] > lo) out.unshift(tidy(out[0] - w));
  if (out[out.length - 1] < hi) out.push(tidy(out[out.length - 1] + w));
  return out;
}

/** 한 자리 (10 배) 마다 steps 를 곱한 값 — lo 의 자리보다 pad 아래부터 hi 의 자리보다 pad 위까지. */
export function decadeGrid(
  lo: number,
  hi: number,
  steps: readonly number[],
  pad = 0,
): number[] {
  const out: number[] = [];
  for (
    let d = Math.floor(Math.log10(lo)) - pad;
    d <= Math.ceil(Math.log10(hi)) + pad;
    d++
  )
    for (const m of steps) out.push(tidy(m * 10 ** d));
  return out;
}

function logEdges(lo: number, hi: number, steps: readonly number[]): number[] {
  const all = decadeGrid(lo, hi, steps, 1);
  let a = all.length - 1;
  while (a > 0 && all[a] > lo * (1 + 1e-9)) a--;
  let b = a + 1;
  while (b < all.length - 1 && all[b] < hi * (1 - 1e-9)) b++;
  return all.slice(a, b + 1);
}

function autoWidth(sorted: Float64Array): number {
  const n = sorted.length;
  const iqr = quantileSorted(sorted, 0.75) - quantileSorted(sorted, 0.25);
  if (n >= 30 && iqr > 0) return (2 * iqr) / Math.cbrt(n);
  return (sorted[n - 1] - sorted[0]) / (Math.ceil(Math.log2(n)) + 1);
}

function cleanEdges(edges: readonly number[], log: boolean): number[] | null {
  const out = [
    ...new Set(edges.filter((e) => Number.isFinite(e) && (!log || e > 0))),
  ].sort((a, b) => a - b);
  return out.length >= 2 ? out : null;
}

/**
 * 구간 경계 (길이 = 구간 수 + 1). 경계를 직접 주지 않으면 모든 값을 덮는다. 값이 모두 같으면 그 값을
 * 가운데 둔 구간 하나 (폭 binWidth, 없으면 1 · log 면 v/2 ~ 2v). 값이 없으면 빈 배열.
 */
export function binEdges(
  values: readonly number[],
  opts: BinOptions = {},
): number[] {
  const log = opts.log === true;
  const given = opts.edges ? cleanEdges(opts.edges, log) : null;
  if (given) return given;
  const raw = Float64Array.from(
    values.filter((x) => Number.isFinite(x) && (!log || x > 0)),
  ).sort();
  if (!raw.length) return [];
  const lo = raw[0];
  const hi = raw[raw.length - 1];
  const width =
    opts.binWidth !== undefined && opts.binWidth > 0 && !log
      ? opts.binWidth
      : undefined;
  if (lo === hi) {
    if (log) return [tidy(lo / 2), tidy(lo * 2)];
    const w = width ?? 1;
    return [lo - w / 2, lo + w / 2];
  }
  const count =
    opts.bins !== undefined && opts.bins >= 1
      ? Math.round(opts.bins)
      : undefined;
  const cap =
    width !== undefined || count !== undefined ? MAX_BINS : MAX_AUTO_BINS;
  if (log) {
    const target =
      count !== undefined
        ? Math.log10(hi / lo) / count
        : autoWidth(raw.map(Math.log10));
    const miss = (st: readonly number[]) =>
      Math.abs(Math.log(1 / st.length / target));
    let k = LOG_STEPS.reduce(
      (best, st, i) => (miss(st) < miss(LOG_STEPS[best]) ? i : best),
      0,
    );
    let out = logEdges(lo, hi, LOG_STEPS[k]);
    while (out.length - 1 > cap && k > 0)
      out = logEdges(lo, hi, LOG_STEPS[--k]);
    return out;
  }
  let w =
    width ??
    niceWidth(count !== undefined ? (hi - lo) / count : autoWidth(raw));
  if ((hi - lo) / w > cap) w = niceWidth((hi - lo) / cap, true);
  let out = linearEdges(lo, hi, w);
  while (out.length - 1 > cap)
    out = linearEdges(lo, hi, (w = niceWidth(w * 1.01, true)));
  return out;
}

/** v 가 든 구간 번호 ([시작, 끝), 마지막 구간만 끝값 포함). 경계 밖 · 숫자 아님이면 -1. */
export function binIndex(edges: readonly number[], v: number): number {
  const n = edges.length - 1;
  if (n < 1 || !(v >= edges[0] && v <= edges[n])) return -1;
  let a = 0;
  let b = n;
  while (b - a > 1) {
    const m = (a + b) >> 1;
    if (edges[m] <= v) a = m;
    else b = m;
  }
  return a;
}

/** 구간마다 개수. 경계 밖의 값은 outside 로 센다. */
export function binCounts(
  values: readonly number[],
  edges: readonly number[],
): { counts: number[]; outside: number } {
  const counts = new Array<number>(Math.max(0, edges.length - 1)).fill(0);
  let outside = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    const k = binIndex(edges, v);
    if (k < 0) outside++;
    else counts[k]++;
  }
  return { counts, outside };
}

/** 점 그림의 묶음 크기 (1 · 2 · 5 · 10 …) — 가장 높은 열이 capacity 자리에 드는 가장 작은 값. */
export function dotUnit(maxCount: number, capacity: number): number {
  const cap = Math.max(1, Math.floor(capacity));
  if (!(maxCount > cap)) return 1;
  if (!Number.isFinite(maxCount)) return Infinity;
  for (
    let p = 10 ** Math.max(0, Math.floor(Math.log10(maxCount / cap)) - 1);
    ;
    p *= 10
  )
    for (const m of [1, 2, 5])
      if (Math.ceil(maxCount / (m * p)) <= cap) return m * p;
}
