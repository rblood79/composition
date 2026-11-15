/**
 * ADR-306 — family 공용 기하 · 글자 배치. 둥근 사각형 · 라벨 밀어내기 · 쌓기는 ztd-charts 0.5.0
 * (`3c4376c`, MIT — `src/core/geometry.ts` `roundRectPath` · `src/core/text.ts` `dodgeVertical` ·
 * `src/layout/stack.ts` `stack` · `insideOut` · `src/layout/stats.ts` `ranks`) 의 식을 옮겼다.
 * 글자 폭은 두 consumer 가 같이 쓰는 근사 (`approxTextWidth`) 로 잰다.
 */
import { approxTextWidth, r2 } from "../scales";
import type { TextMark } from "../types";

export interface Corners {
  tl?: number;
  tr?: number;
  br?: number;
  bl?: number;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** 모서리마다 반지름이 다른 사각형 path. 폭 · 높이가 0 이면 빈 문자열. */
export function roundRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  c: Corners | number,
): string {
  if (w < 0) {
    x += w;
    w = -w;
  }
  if (h < 0) {
    y += h;
    h = -h;
  }
  if (w <= 0.01 || h <= 0.01) return "";
  const k = typeof c === "number" ? { tl: c, tr: c, br: c, bl: c } : c;
  const m = Math.min(w, h) / 2;
  const tl = clamp(k.tl ?? 0, 0, m);
  const tr = clamp(k.tr ?? 0, 0, m);
  const br = clamp(k.br ?? 0, 0, m);
  const bl = clamp(k.bl ?? 0, 0, m);
  return (
    `M${r2(x + tl)},${r2(y)}H${r2(x + w - tr)}` +
    (tr ? `A${r2(tr)},${r2(tr)} 0 0 1 ${r2(x + w)},${r2(y + tr)}` : "") +
    `V${r2(y + h - br)}` +
    (br ? `A${r2(br)},${r2(br)} 0 0 1 ${r2(x + w - br)},${r2(y + h)}` : "") +
    `H${r2(x + bl)}` +
    (bl ? `A${r2(bl)},${r2(bl)} 0 0 1 ${r2(x)},${r2(y + h - bl)}` : "") +
    `V${r2(y + tl)}` +
    (tl ? `A${r2(tl)},${r2(tl)} 0 0 1 ${r2(x + tl)},${r2(y)}` : "") +
    "Z"
  );
}

/** 점 목록 → 닫힌 다각형 path. */
export function polygonPathOf(points: readonly [number, number][]): string {
  if (points.length === 0) return "";
  return (
    points
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${r2(x)},${r2(y)}`)
      .join("") + "Z"
  );
}

/** 세로로 겹치는 라벨을 최소 간격만큼 벌린다 (순서 유지, `[lo, hi]` 안). */
export function dodgeVertical(
  ys: readonly number[],
  minGap: number,
  lo = -Infinity,
  hi = Infinity,
): number[] {
  const idx = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const out = new Array<number>(ys.length);
  const pos = idx.map((d) => clamp(d.y, lo, hi));
  for (let iter = 0; iter < 30; iter++) {
    let moved = false;
    for (let k = 1; k < pos.length; k++) {
      const gap = pos[k] - pos[k - 1];
      if (gap < minGap) {
        const push = (minGap - gap) / 2;
        pos[k - 1] -= push;
        pos[k] += push;
        moved = true;
      }
    }
    for (let k = 0; k < pos.length; k++) pos[k] = clamp(pos[k], lo, hi);
    if (!moved) break;
  }
  for (let k = 1; k < pos.length; k++)
    if (pos[k] - pos[k - 1] < minGap) pos[k] = pos[k - 1] + minGap;
  if (pos.length && pos[pos.length - 1] > hi) {
    const shift = pos[pos.length - 1] - hi;
    for (let k = 0; k < pos.length; k++) pos[k] -= shift;
  }
  idx.forEach((d, k) => {
    out[d.i] = r2(pos[k]);
  });
  return out;
}

/** 폭 안에 들도록 글자를 줄인다 (끝에 「…」). 근사 폭이라 두 consumer 가 같은 글자를 쓴다. */
export function fitText(
  text: string,
  maxWidth: number,
  fontSize: number,
): string {
  if (approxTextWidth(text, fontSize) <= maxWidth) return text;
  const per = fontSize * 0.55;
  const keep = Math.max(0, Math.floor(maxWidth / per) - 1);
  return keep <= 0 ? "" : `${text.slice(0, keep)}…`;
}

/**
 * 가로로 놓인 가운데 정렬 라벨을 겹치지 않게 솎는다 — 첫 라벨부터 앞 라벨과 `gap` 이상 떨어진
 * 것만 남긴다 (ADR-194 R3 의 every-nth 와 같은 뜻).
 */
export function thinCentered(
  marks: readonly TextMark[],
  fontSize: number,
  gap = 6,
): TextMark[] {
  const out: TextMark[] = [];
  let right = -Infinity;
  for (const mark of marks) {
    const half = approxTextWidth(mark.text, fontSize) / 2;
    if (mark.x - half < right + gap) continue;
    out.push(mark);
    right = mark.x + half;
  }
  return out;
}

export type StackOffset = "zero" | "expand" | "silhouette" | "wiggle";

/**
 * 쌓기. `values[s][k]` (계열 s, 위치 k). zero 는 음수를 아래로 따로, 나머지는 음수 · 빈 값을 0 으로.
 * wiggle 은 띠의 출렁임을 줄이는 기준선 (스트림그래프) 이고 평균 중심선을 0 에 맞춘다.
 */
export function stack(
  values: readonly (readonly number[])[],
  offset: StackOffset = "zero",
): { y0: number[][]; y1: number[][] } {
  const ns = values.length;
  const nk = ns ? values[0].length : 0;
  const y0 = values.map(() => new Array<number>(nk).fill(0));
  const y1 = values.map(() => new Array<number>(nk).fill(0));
  const v = (s: number, k: number) => {
    const x = values[s][k];
    return Number.isFinite(x) && x > 0 ? x : 0;
  };
  const base = new Array<number>(nk).fill(0);
  if (offset === "wiggle" && ns > 0 && nk > 1) {
    let b = 0;
    for (let k = 1; k < nk; k++) {
      let s1 = 0;
      let s2 = 0;
      for (let s = 0; s < ns; s++) {
        const cur = v(s, k);
        const dv = cur - v(s, k - 1);
        let s3 = 0;
        for (let j = 0; j < s; j++) s3 += v(j, k) - v(j, k - 1);
        s1 += cur;
        s2 += (dv / 2 + s3) * cur;
      }
      if (s1) b -= s2 / s1;
      base[k] = b;
    }
  }
  for (let k = 0; k < nk; k++) {
    if (offset === "zero") {
      let pos = 0;
      let neg = 0;
      for (let s = 0; s < ns; s++) {
        const x = values[s][k];
        const val = Number.isFinite(x) ? x : 0;
        if (val >= 0) {
          y0[s][k] = pos;
          pos += val;
          y1[s][k] = pos;
        } else {
          y0[s][k] = neg;
          neg += val;
          y1[s][k] = neg;
        }
      }
      continue;
    }
    let tot = 0;
    for (let s = 0; s < ns; s++) tot += v(s, k);
    let acc = offset === "silhouette" ? -tot / 2 : base[k];
    for (let s = 0; s < ns; s++) {
      let val = v(s, k);
      if (offset === "expand") val = tot ? (val / tot) * 100 : 0;
      y0[s][k] = acc;
      acc += val;
      y1[s][k] = acc;
    }
  }
  if (offset === "wiggle" && nk) {
    let mid = 0;
    for (let k = 0; k < nk; k++)
      mid += ((y0[0]?.[k] ?? 0) + (y1[ns - 1]?.[k] ?? 0)) / 2;
    mid /= nk;
    for (let s = 0; s < ns; s++)
      for (let k = 0; k < nk; k++) {
        y0[s][k] -= mid;
        y1[s][k] -= mid;
      }
  }
  return { y0, y1 };
}

/** 스트림그래프 계열 순서 (inside-out): 일찍 큰 값이 나오는 계열을 가운데로. */
export function insideOut(values: readonly (readonly number[])[]): number[] {
  const n = values.length;
  const peak = values.map((row) => {
    let best = 0;
    let bv = -Infinity;
    row.forEach((v, k) => {
      if (v > bv) {
        bv = v;
        best = k;
      }
    });
    return best;
  });
  const sums = values.map((row) =>
    row.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0),
  );
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => peak[a] - peak[b],
  );
  const top: number[] = [];
  const bottom: number[] = [];
  let st = 0;
  let sb = 0;
  for (const i of order) {
    if (st < sb) {
      top.push(i);
      st += sums[i];
    } else {
      bottom.push(i);
      sb += sums[i];
    }
  }
  return [...bottom.reverse(), ...top];
}

/** 순위 (같은 값은 같은 순위). desc 면 큰 값이 1 등. */
export function ranks(values: readonly number[], desc = true): number[] {
  const idx = values
    .map((v, i) => ({ v, i }))
    .sort((a, b) => (desc ? b.v - a.v : a.v - b.v));
  const out = new Array<number>(values.length);
  let rank = 0;
  let prev: number | null = null;
  idx.forEach((d, k) => {
    if (prev === null || d.v !== prev) rank = k + 1;
    out[d.i] = rank;
    prev = d.v;
  });
  return out;
}

/** 가장 큰 나머지 방식으로 칸 나누기 — 합이 정확히 `cells` (total 이 합보다 크면 비율만큼). */
export function allocateCells(
  values: readonly number[],
  cells: number,
  total?: number,
): number[] {
  const sum = values.reduce((a, b) => a + b, 0);
  const t = Math.max(total ?? 0, sum);
  if (!(t > 0)) return values.map(() => 0);
  const exact = values.map((v) => (Math.max(0, v) / t) * cells);
  const out = exact.map((x) => Math.floor(x));
  const target =
    total === undefined
      ? cells
      : Math.min(cells, Math.round((sum / t) * cells));
  let left = target - out.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ r: x - Math.floor(x), i }))
    .sort((a, b) => b.r - a.r);
  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k].i]++;
  return out;
}
