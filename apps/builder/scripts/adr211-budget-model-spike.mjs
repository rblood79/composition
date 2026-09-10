#!/usr/bin/env node
// adr211-budget-model-spike.mjs — ADR-211 P0 (G0) spike, 모델·계약 축.
//
// 제품 코드는 건드리지 않는다. 하니스 페이지가 `packages/specs/src/chart` 를 **src** 로 import 하고
// (adr210-runtime-perf.mjs 와 같은 방법), 예산 계약의 **시험용 구현** (`budgetSpike.ts` — P1 의
// `budget.ts` 초안, 제품 아님) 을 함께 묶어 아래를 잰다:
//   A) 모델 계산 비용 — resolveChartData + computeChartScene (폭 2,000 × 400, fit 최대) 를
//      5,000 · 20,000 행 × S 4 (group / columns) 에서 cold (새 페이지 첫 호출, 3 회) / warm (3 warm-up + 12)
//   B) 예산 계약 시험 구현 비용 — bucket 집계 · 극값 선택 (적응 B, 반감 단계 포함) · others, 같은 행 수
//   C) 손계산 오라클 (breakdown §5) — 표를 먼저 적고 시험 구현이 표를 맞히는지 (fixture 초안)
//   D) shared `Slider` 단일 thumb 키보드 — 화살표 1 · Home/End · PageUp/Down = RAC 기본 (범위 1/10)
// 사용: node apps/builder/scripts/adr211-budget-model-spike.mjs [--headless] [--out DIR]
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, join, extname, dirname } from "node:path";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { execSync } from "node:child_process";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const repo = resolve(opt("repo", process.cwd()));
const headless = args.includes("--headless");
const OUT = opt("out", "/private/tmp/adr211-p0/model");
const root = join(OUT, "src");
const dist = join(OUT, "dist");
const log = (...a) => console.log("[ADR-211 model spike]", ...a);

mkdirSync(root, { recursive: true });
writeFileSync(
  join(root, "index.html"),
  `<!doctype html><html><head><meta charset="utf-8"><title>ADR-211 model spike</title></head><body><button id="run">run</button><div id="host"></div><pre id="results"></pre><script type="module" src="./harness.tsx"></script></body></html>`,
);

// ── 예산 계약 시험 구현 (breakdown §2.1~2.5 의 규칙을 그대로 코드로) ─────────────────────────
writeFileSync(
  join(root, "budgetSpike.ts"),
  `import type { SeriesGrid, SeriesData } from "${repo}/packages/specs/src/chart/series";
export interface MinUnits { minSlot: number; minPointGap: number; minArc: number; minAxisGap: number; minRing: number }
export const UNITS: MinUnits = { minSlot: 8, minPointGap: 2, minArc: 6, minAxisGap: 12, minRing: 4 };
export type Kind = "bar" | "line" | "area" | "pie" | "radar" | "radial";
/** §2.2 — 슬롯 예산 fit. pie/radar 는 둘레, radial 은 링 두께. */
export function slotFit(kind: Kind, geo: { w?: number; h?: number; rOuter?: number; rInner?: number; sweep?: number; horizontal?: boolean }, S: number, stacked: boolean, u: MinUnits = UNITS): number {
  const sweep = geo.sweep ?? 360;
  switch (kind) {
    case "bar": {
      const axis = geo.horizontal ? geo.h! : geo.w!;
      return Math.floor(axis / (stacked ? u.minSlot : u.minSlot * Math.max(1, S)));
    }
    case "line":
    case "area":
      return Math.floor(geo.w! / u.minPointGap);
    case "pie":
      return Math.floor(((2 * Math.PI * geo.rOuter! * sweep) / 360) / u.minArc);
    case "radar":
      return Math.floor(((2 * Math.PI * geo.rOuter! * sweep) / 360) / u.minAxisGap);
    case "radial":
      return Math.floor((geo.rOuter! - (geo.rInner ?? 0)) / u.minRing);
  }
}
/** §2.1 — 마크 예산으로 깎은 fitEff. */
export const fitEff = (fit: number, S: number, k: number, M: number) => Math.min(fit, Math.floor(M / (Math.max(1, S) * k)));
export type Stat = "sum" | "mean" | "max" | "min";
const stat = (vals: number[], s: Stat): number | undefined => {
  if (vals.length === 0) return undefined;
  if (s === "sum") return vals.reduce((a, b) => a + b, 0);
  if (s === "mean") return vals.reduce((a, b) => a + b, 0) / vals.length;
  if (s === "max") return Math.max(...vals);
  return Math.min(...vals);
};
export const bucketBounds = (n: number, B: number): Array<[number, number]> => {
  const size = Math.ceil(n / Math.max(1, B));
  const out: Array<[number, number]> = [];
  for (let s = 0; s < n; s += size) out.push([s, Math.min(n, s + size)]);
  return out;
};
/** §2.4 bucket 집계 — transformed grid (범주 = "첫 ~ 끝", 값 = 통계). 결측 제외. */
export function aggregate(grid: SeriesGrid, B: number, s: Stat): SeriesGrid {
  const bounds = bucketBounds(grid.categories.length, B);
  const categories = bounds.map(([a, b]) => (b - a === 1 ? grid.categories[a] : \`\${grid.categories[a]} ~ \${grid.categories[b - 1]}\`));
  const series: SeriesData[] = grid.series.map((sd) => {
    const values = new Map<number, number>();
    bounds.forEach(([a, b], bi) => {
      const vals: number[] = [];
      for (let ci = a; ci < b; ci++) { const v = sd.values.get(ci); if (v !== undefined) vals.push(v); }
      const r = stat(vals, s);
      if (r !== undefined) values.set(bi, r);
    });
    return { ...sd, values };
  });
  return { categories, series, hasValues: series.some((sd) => sd.values.size > 0) };
}
/** §2.4 극값 선택 — 시리즈별 bucket min/max index + gap sentinel, 합집합 U, 적응 B. */
export function selectExtrema(grid: SeriesGrid, fit: number, k: number, M: number) {
  const n = grid.categories.length;
  const S = grid.series.length;
  const steps: Array<{ B: number; U: number; points: number }> = [];
  let B = Math.max(1, fit);
  for (;;) {
    const U = new Set<number>();
    for (const [a, b] of bucketBounds(n, B)) {
      for (const sd of grid.series) {
        let minI = -1, maxI = -1, gapI = -1;
        for (let ci = a; ci < b; ci++) {
          const v = sd.values.get(ci);
          if (v === undefined) { if (gapI < 0) gapI = ci; continue; }
          if (minI < 0 || v < sd.values.get(minI)!) minI = ci;
          if (maxI < 0 || v > sd.values.get(maxI)!) maxI = ci;
        }
        if (minI >= 0) U.add(minI);
        if (maxI >= 0) U.add(maxI);
        if (gapI >= 0) U.add(gapI);
      }
    }
    const points = S * U.size * k;
    steps.push({ B, U: U.size, points });
    if (points <= M) return { B, U: [...U].sort((x, y) => x - y), steps, fallback: false };
    if (B === 1) return { B, U: [...U].sort((x, y) => x - y), steps, fallback: true };
    B = Math.ceil(B / 2);
  }
}
export const OTHERS_KEY = "__others__";
/** §2.4 others — ranking key Σ_series |value|, 상위 fitEff−1 + 합산 1. 원본 부호로 합산. */
export function others(grid: SeriesGrid, fitEffValue: number): SeriesGrid & { ranking: number[] } {
  const n = grid.categories.length;
  const key = (ci: number) => grid.series.reduce((a, sd) => a + Math.abs(sd.values.get(ci) ?? 0), 0);
  const ranking = [...Array(n).keys()].sort((a, b) => key(b) - key(a) || a - b);
  if (fitEffValue < 2 || n <= fitEffValue) {
    const keep = ranking.slice(0, Math.max(1, Math.min(n, fitEffValue))).sort((a, b) => a - b);
    return { ...pick(grid, keep), ranking };
  }
  const keep = ranking.slice(0, fitEffValue - 1).sort((a, b) => a - b);
  const rest = ranking.slice(fitEffValue - 1);
  const base = pick(grid, keep);
  const bi = keep.length;
  const series = base.series.map((sd, si) => {
    let sum = 0, any = false;
    for (const ci of rest) { const v = grid.series[si].values.get(ci); if (v !== undefined) { sum += v; any = true; } }
    const values = new Map(sd.values);
    if (any) values.set(bi, sum);
    return { ...sd, values };
  });
  return { categories: [...base.categories, OTHERS_KEY], series, hasValues: true, ranking };
}
function pick(grid: SeriesGrid, keep: number[]): SeriesGrid {
  const categories = keep.map((ci) => grid.categories[ci]);
  const series = grid.series.map((sd) => {
    const values = new Map<number, number>();
    keep.forEach((ci, i) => { const v = sd.values.get(ci); if (v !== undefined) values.set(i, v); });
    return { ...sd, values };
  });
  return { categories, series, hasValues: series.some((sd) => sd.values.size > 0) };
}
/** transformed 전체의 값 범위 (domain 은 여기서). */
export function extent(grid: SeriesGrid): [number, number] {
  let min = Infinity, max = -Infinity;
  for (const sd of grid.series) for (const v of sd.values.values()) { if (v < min) min = v; if (v > max) max = v; }
  return [min, max];
}
`,
);

writeFileSync(
  join(root, "harness.tsx"),
  `import React from "react";
import { createRoot } from "react-dom/client";
import { resolveChartData, computeChartScene, createChartInitialProps, CHART_DEFAULT_METRICS, buildSeriesGrid } from "${repo}/packages/specs/src/chart";
import { Slider } from "${repo}/packages/shared/src/components/Slider";
import { slotFit, fitEff, aggregate, selectExtrema, others, extent, OTHERS_KEY, UNITS } from "./budgetSpike";
const output = document.querySelector("#results")!;
const host = document.querySelector<HTMLDivElement>("#host")!;
const M = 2000;
const value = (i: number, s: number) => 20 + ((i * 13 + s * 29) % 71);
function makeRows(mode: "group" | "columns", categories: number, series: number) {
  const fields = ["f0", "f1", "f2", "f3", "f4", "f5", "f6", "f7"];
  if (mode === "group")
    return Array.from({ length: categories * series }, (_, i) => ({ id: String(i), category: \`C\${Math.floor(i / series)}\`, series: \`S\${i % series}\`, value: value(Math.floor(i / series), i % series) }));
  return Array.from({ length: categories }, (_, c) => ({ id: String(c), category: \`C\${c}\`, ...Object.fromEntries(fields.slice(0, series).map((f, s) => [f, value(c, s)])) }));
}
const propsFor = (kind: string, mode: "group" | "columns", series: number) => ({
  ...createChartInitialProps(kind as never), chartType: kind, dimension: "category", metric: "value", color: "series",
  ...(mode === "columns" ? { dataMode: "columns", valueFields: Array.from({ length: series }, (_, i) => \`f\${i}\`) } : {}),
} as never);
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null; };
const stats = (xs: number[]) => ({ n: xs.length, p50: q(xs, 0.5), p95: q(xs, 0.95), max: xs.length ? Math.max(...xs) : null, samples: xs.map((x) => Math.round(x * 100) / 100) });
const SIZE = { width: 2000, height: 400 };
const COLD = new URLSearchParams(location.search).get("cold") === "1";
const results: Record<string, unknown> = { units: UNITS, M, viewport: [innerWidth, innerHeight, devicePixelRatio] };

// ── A) 모델 비용 ────────────────────────────────────────────────────────────
function measureModel(rowsN: number, S: number, mode: "group" | "columns", kind: string, samples: number, warm: number) {
  const categories = mode === "group" ? rowsN / S : rowsN;
  const rows = makeRows(mode, categories, S);
  const props = propsFor(kind, mode, S);
  const model: number[] = [], scene: number[] = [];
  let marks = 0, cats = 0;
  for (let i = -warm; i < samples; i++) {
    const t0 = performance.now();
    const m = resolveChartData(rows as never, props, CHART_DEFAULT_METRICS.seriesCount);
    const t1 = performance.now();
    const sc = computeChartScene(props, rows as never, SIZE, CHART_DEFAULT_METRICS);
    const t2 = performance.now();
    if (i >= 0) { model.push(t1 - t0); scene.push(t2 - t1); }
    marks = sc.marks.length; cats = m.grid.categories.length;
  }
  return { rows: rowsN, S, mode, kind, categories: cats, sceneMarks: marks, model: stats(model), scene: stats(scene) };
}
// ── B) 시험 구현 비용 ────────────────────────────────────────────────────────
function measureBudget(rowsN: number, S: number, samples: number, warm: number) {
  const rows = makeRows("columns", rowsN, S);
  const props = propsFor("line", "columns", S);
  const grid = buildSeriesGrid(rows as never, props, 8);
  const fit = slotFit("line", { w: SIZE.width - 60 }, S, false); // 폭 2,000 − 좌 gutter 근사
  const fe = fitEff(fit, S, 1, M);
  const agg: number[] = [], ext: number[] = [], oth: number[] = [];
  let extremaInfo: unknown = null;
  for (let i = -warm; i < samples; i++) {
    let t = performance.now(); aggregate(grid, fe, "sum"); const a = performance.now() - t;
    t = performance.now(); const e = selectExtrema(grid, fit, 1, M); const b = performance.now() - t;
    t = performance.now(); others(grid, 20); const c = performance.now() - t;
    if (i >= 0) { agg.push(a); ext.push(b); oth.push(c); }
    extremaInfo = { B: e.B, U: e.U.length, steps: e.steps, fallback: e.fallback };
  }
  return { rows: rowsN, S, fit, fitEff: fe, aggregate: stats(agg), extrema: stats(ext), extremaInfo, others: stats(oth) };
}
// ── C) 손계산 오라클 (§5) — expected 를 먼저 적는다 ───────────────────────────
function gridOf(categories: string[], seriesValues: Array<Array<number | null>>) {
  const rows: Record<string, unknown>[] = [];
  categories.forEach((c, ci) => { const r: Record<string, unknown> = { category: c }; seriesValues.forEach((sv, si) => { if (sv[ci] !== null) r[\`f\${si}\`] = sv[ci]; }); rows.push(r); });
  const props = propsFor("line", "columns", seriesValues.length);
  return buildSeriesGrid(rows as never, props, 8);
}
const oracles: Array<{ id: string; expected: unknown; actual: unknown; pass: boolean; note?: string }> = [];
const check = (id: string, expected: unknown, actual: unknown, note?: string) => oracles.push({ id, expected, actual, pass: JSON.stringify(expected) === JSON.stringify(actual), note });
// fit
check("bar W500 minSlot8 S1 → 62", 62, slotFit("bar", { w: 500 }, 1, false));
check("bar W500 S3 묶음 → 20", 20, slotFit("bar", { w: 500 }, 3, false));
check("bar W500 S3 누적 → 62 · fitEff min(62, floor(2000/3)=666) = 62", 62, fitEff(slotFit("bar", { w: 500 }, 3, true), 3, 1, M));
check("bar W4 → 0 (plot-too-small)", 0, slotFit("bar", { w: 4 }, 1, false));
check("bar W500 S3 묶음 · 값 라벨 k=2 · M 100 → fitEff min(20, floor(100/6)=16) = 16", 16, fitEff(slotFit("bar", { w: 500 }, 3, false), 3, 2, 100));
check("pie r60 minArc6 → floor(2π·60/6)=62", 62, slotFit("pie", { rOuter: 60 }, 1, false));
check("pie r60 sweep 180 → 31", 31, slotFit("pie", { rOuter: 60, sweep: 180 }, 1, false));
check("radar r60 minAxisGap12 → 31", 31, slotFit("radar", { rOuter: 60 }, 1, false));
check("radial r60 inner0 minRing4 → 15", 15, slotFit("radial", { rOuter: 60, rInner: 0 }, 1, false));
check("line W500 minPointGap2 → 250", 250, slotFit("line", { w: 500 }, 1, false));
check("pie 링 S3 × fitEff 62 = 186 ≤ M", true, 3 * 62 <= M);
// pie [1000,1] — 조각 2 (묶지 않는다): others 는 fitEff ≥ n 이면 그대로
{ const g = gridOf(["a", "b"], [[1000, 1]]); const o = others(g, 62); check("pie [1000,1] fit 62 → 조각 2 (최소 크기 미보장)", ["a", "b"], o.categories); }
// aggregate
{
  const g = gridOf(["c0", "c1", "c2", "c3", "c4", "c5"], [[1, 2, 3, 4, 5, 6], [10, null, 30, 40, 50, 60]]);
  const s = aggregate(g, 3, "sum");
  check("sum B3 범주 라벨 = 첫 ~ 끝", ["c0 ~ c1", "c2 ~ c3", "c4 ~ c5"], s.categories);
  check("sum B3 s0 = [3,7,11] (원본 합 21 보존)", [3, 7, 11], [...s.series[0].values.values()]);
  check("sum B3 s1 결측 제외 = [10,70,110]", [10, 70, 110], [...s.series[1].values.values()]);
  const m = aggregate(g, 3, "mean");
  check("mean B3 s1 = [10 (결측 제외 → 1개 평균), 35, 55]", [10, 35, 55], [...m.series[1].values.values()]);
  check("max B3 s0 = [2,4,6]", [2, 4, 6], [...aggregate(g, 3, "max").series[0].values.values()]);
  check("min B3 s0 = [1,3,5]", [1, 3, 5], [...aggregate(g, 3, "min").series[0].values.values()]);
  const one = aggregate(gridOf(["a", "b"], [[60, 60]]), 1, "sum");
  check("[60,60] sum B1 → 120 · domain (transformed extent) 이 120 포함", [120, 120], extent(one));
  check("[60,60] mean B1 → 60", [60], [...aggregate(gridOf(["a", "b"], [[60, 60]]), 1, "mean").series[0].values.values()]);
  check("B ≥ n 이면 bucket = 범주 (라벨 원본)", ["c0", "c1", "c2", "c3", "c4", "c5"], aggregate(g, 6, "sum").categories);
}
// extrema — 극값 보존 · gap sentinel
{
  const n = 40;
  const A = Array.from({ length: n }, () => 5);
  const Bv = Array.from({ length: n }, (_, i) => (i === 7 ? 100 : 5));
  const C = Array.from({ length: n }, (_, i) => (i === 23 ? -100 : i === 24 ? 100 : 5));
  const D: Array<number | null> = Array.from({ length: n }, (_, i) => (i === 12 ? null : i === 13 ? null : i === 30 ? 1 : i === 31 ? null : i === 32 ? 2 : 5));
  const g = gridOf(Array.from({ length: n }, (_, i) => \`c\${i}\`), [A, Bv, C, D]);
  const e = selectExtrema(g, 4, 1, M);
  check("극값 S4 fit4 → B 4 (겹치는 극값이라 반감 없음)", 4, e.B);
  check("B 의 spike index 7 ∈ U", true, e.U.includes(7));
  check("C 의 상쇄 spike 23·24 ∈ U (부호 반대, 둘 다 보존)", true, e.U.includes(23) && e.U.includes(24));
  check("D 의 gap sentinel — 결측 run 첫 index 12 · 31 ∈ U", true, e.U.includes(12) && e.U.includes(31));
  // bucket [30,40) 손계산: min = 30 (값 1) · max = 33 (첫 5 — 32 의 2 는 max 가 아니다) · gap = 31
  check("D 의 bucket [30,40) min 30 · max 33 ∈ U (32 는 극값이 아니라 빠진다)", [true, true, false], [e.U.includes(30), e.U.includes(33), e.U.includes(32)]);
  check("점 수 S×|U|×k ≤ M", true, 4 * e.U.length <= M, \`|U|=\${e.U.length}\`);
  // 모든 시리즈가 U 의 원본 값을 그린다 → D 는 12 에서 결측 (선 끊김)
  check("visible 에서 D 의 12 는 결측 (connectNulls:false 로 끊김)", undefined, g.series[3].values.get(12));
}
// extrema — 적응 B: S4 · B250 · 겹치지 않는 극값 (bucket 당 범주 8) → |U| 2,000, 점 8,000 > M
{
  const n = 2000, S = 4;
  const sv = Array.from({ length: S }, (_, s) => Array.from({ length: n }, (_, i) => { const o = i % 8; return o === 2 * s ? -100 - i : o === 2 * s + 1 ? 100 + i : 0; }));
  const g = gridOf(Array.from({ length: n }, (_, i) => \`c\${i}\`), sv);
  const e = selectExtrema(g, 250, 1, M);
  check("적응 B 단계 (B → |U| → 점): 250→2000→8000 · 125→1000→4000 · 63→504→2016 · 32→256→1024 ≤ 2000", [[250, 2000, 8000], [125, 1000, 4000], [63, 504, 2016], [32, 256, 1024]], e.steps.map((s) => [s.B, s.U, s.points]));
  check("최종 B 32 · fallback 없음", { B: 32, fallback: false }, { B: e.B, fallback: e.fallback });
  // fallback: S 26 · k 1 · B 1 → 3·S² = 2028 > 2000 이 아니라 2S (gap 없음) = 52·26 = 1352 ≤ M 이므로 넘치지 않는다 — gap 이 있는 최악 3S 로 실증
  const S2 = 26, n2 = 26 * 3;
  const sv2 = Array.from({ length: S2 }, (_, s) => Array.from({ length: n2 }, (_, i) => (i === 3 * s ? -1 : i === 3 * s + 1 ? 1 : i === 3 * s + 2 ? null : 0)));
  const e2 = selectExtrema(gridOf(Array.from({ length: n2 }, (_, i) => \`c\${i}\`), sv2), 1, 1, M);
  check("S 26 · B 1 · 시리즈마다 min/max/gap 다른 index → |U| 78 · 점 2028 > M → too-many-series fallback", { U: 78, points: 2028, fallback: true }, { U: e2.U.length, points: e2.steps[0].points, fallback: e2.fallback });
}
// others
{
  const g = gridOf(["a", "b", "기타", "d", "e"], [[10, -50, 5, 1, 2], [1, 1, 40, 1, 1]]);
  const o = others(g, 3);
  check("others ranking key Σ|v|: b 51 · 기타 45 · a 11 · e 3 · d 2 → 순위", [1, 2, 0, 4, 3], o.ranking);
  check("fitEff 3 → 상위 2 (b, 기타 — 원본 라벨 유지) + __others__", ["b", "기타", OTHERS_KEY], o.categories);
  check("__others__ 시리즈별 sum (원본 부호): s0 = 10+1+2 = 13 · s1 = 3", [13, 3], [o.series[0].values.get(2), o.series[1].values.get(2)]);
  const pm = others(gridOf(["p", "m", "x", "y"], [[100, 90, 10, -10]]), 3);
  check("pie +10/−10 묶임 → 합 0 (면적 0, tooltip 0)", 0, pm.series[0].values.get(2));
  check("others 뒤 transformed domain 재계산 (radial clamp 기준)", [0, 100], extent(pm));
  check("fitEff 1 → others 없이 상위 1", ["b"], others(g, 1).categories);
  check("fitEff 2 → 상위 1 + 기타", ["b", OTHERS_KEY], others(g, 2).categories);
  check("n ≤ fitEff → 원본 그대로", ["a", "b", "기타", "d", "e"], others(g, 5).categories);
}
results.oracles = oracles;

// ── D) Slider 키보드 ─────────────────────────────────────────────────────────
async function sliderKeys() {
  const n = 1000, fe = 62, max = n - fe;
  let current = 0;
  const seen: number[] = [];
  const root = createRoot(host);
  await new Promise<void>((r) => { root.render(<Slider aria-label="window" minValue={0} maxValue={max} step={1} defaultValue={0} showValueLabel={false} onChange={(v) => { current = v as number; seen.push(v as number); }} />); requestAnimationFrame(() => r()); });
  const thumb = host.querySelector<HTMLElement>('input[type="range"], [role="slider"]');
  if (!thumb) { root.unmount(); return { pass: false, error: "thumb not found", html: host.innerHTML.slice(0, 400) }; }
  thumb.focus();
  const press = async (key: string) => { thumb.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); await new Promise((r) => requestAnimationFrame(() => r(null))); };
  const trace: Array<[string, number]> = [];
  for (const k of ["ArrowRight", "ArrowRight", "ArrowLeft", "PageDown", "PageUp", "End", "ArrowRight", "PageDown", "Home", "PageUp", "PageUp"]) { await press(k); trace.push([k, current]); }
  const pageSize = Math.max(1, Math.round(max / 10));
  const expected: Array<[string, number]> = [["ArrowRight", 1], ["ArrowRight", 2], ["ArrowLeft", 1], ["PageDown", 0], ["PageUp", pageSize], ["End", max], ["ArrowRight", max], ["PageDown", max - pageSize], ["Home", 0], ["PageUp", pageSize], ["PageUp", 2 * pageSize]];
  root.unmount();
  return { max, pageSize, trace, expected, pass: JSON.stringify(trace) === JSON.stringify(expected), ariaMax: thumb.getAttribute("aria-valuemax") };
}

(window as unknown as { __runDone?: boolean }).__runDone = false;
document.querySelector<HTMLButtonElement>("#run")!.onclick = async () => {
  if (COLD) {
    // cold — 새 페이지의 첫 호출만 (1 표본씩). 5,000/20,000 × group/columns × bar/line.
    const cold: unknown[] = [];
    for (const rowsN of [5000, 20000]) for (const mode of ["group", "columns"] as const) for (const kind of ["bar", "line"]) cold.push(measureModel(rowsN, 4, mode, kind, 1, 0));
    results.cold = cold;
  } else {
    const model: unknown[] = [];
    for (const rowsN of [5000, 20000]) for (const mode of ["group", "columns"] as const) for (const kind of ["bar", "line"]) model.push(measureModel(rowsN, 4, mode, kind, 12, 3));
    // 행 상한 후보 R 의 근거 — 50,000 · 100,000 행 (columns · line) 도 1회씩
    for (const rowsN of [50000, 100000]) model.push(measureModel(rowsN, 4, "columns", "line", 3, 1));
    results.model = model;
    results.budget = [measureBudget(5000, 4, 12, 3), measureBudget(20000, 4, 12, 3)];
    try { results.slider = await sliderKeys(); } catch (e) { results.slider = { pass: false, error: String(e) }; }
  }
  output.textContent = JSON.stringify(results, null, 2);
  (window as unknown as { __runDone?: boolean }).__runDone = true;
};
`,
);

const requireFromShared = createRequire(join(repo, "packages/shared/package.json"));
const pkgDir = (name) => dirname(requireFromShared.resolve(`${name}/package.json`));
const alias = [
  { find: /^react-dom(\/.*)?$/, replacement: `${pkgDir("react-dom")}$1` },
  { find: /^react(\/.*)?$/, replacement: `${pkgDir("react")}$1` },
];
log(`build ← ${repo}`);
await build({ root, logLevel: "warn", plugins: [react()], resolve: { alias }, build: { outDir: dist, emptyOutDir: true, minify: true, sourcemap: false } });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const server = createServer((req, res) => {
  const pathname = req.url.split("?")[0];
  const path = join(dist, pathname === "/" ? "index.html" : pathname);
  if (!existsSync(path)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless });
const errors = [];
async function run(query) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`console.${m.type()}: ${m.text()}`); });
  await page.goto(url + query, { waitUntil: "networkidle" });
  await page.click("#run");
  try {
    await page.waitForFunction(() => window.__runDone === true, null, { timeout: 3 * 60_000 });
  } catch (e) {
    console.error("timeout", query, "errors:", errors, "\npartial:", (await page.locator("#results").textContent()).slice(0, 2000));
    throw e;
  }
  const out = JSON.parse(await page.locator("#results").textContent());
  await page.close();
  return out;
}
try {
  const colds = [];
  for (let i = 0; i < 3; i++) colds.push((await run("?cold=1")).cold);
  const warm = await run("");
  const git = (c) => execSync(`git -C "${repo}" ${c}`, { encoding: "utf8" }).trim();
  const manifest = {
    revision: git("rev-parse HEAD"), dirty: git("status --porcelain").split("\n").filter(Boolean).length,
    measuredAt: new Date().toISOString(), headless, ua: await (async () => { const p = await browser.newPage(); const ua = await p.evaluate(() => navigator.userAgent); await p.close(); return ua; })(),
    method: "production vite build of specs src + spike budget; cold = fresh page first call ×3 pages; warm = 3 warm-up + 12; size 2000×400; DPR 1; 1440×900",
    pageErrors: errors, cold: colds, ...warm,
  };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "model-spike.json"), JSON.stringify(manifest, null, 2));
  const f = (v) => (v == null ? "—" : v.toFixed(2));
  console.log("\n| rows | S | mode | kind | categories | scene marks | model p50/p95 warm | scene p50/p95 warm | cold model (3 pages) | cold scene |");
  console.log("| ---: | --: | --- | --- | ---: | ---: | ---: | ---: | --- | --- |");
  for (const r of warm.model) {
    const c = colds.map((cold) => cold.find((x) => x.rows === r.rows && x.mode === r.mode && x.kind === r.kind)).filter(Boolean);
    console.log(`| ${r.rows} | ${r.S} | ${r.mode} | ${r.kind} | ${r.categories} | ${r.sceneMarks} | ${f(r.model.p50)}/${f(r.model.p95)} | ${f(r.scene.p50)}/${f(r.scene.p95)} | ${c.map((x) => f(x.model.samples[0])).join(" · ") || "—"} | ${c.map((x) => f(x.scene.samples[0])).join(" · ") || "—"} |`);
  }
  console.log("\n| rows | fit | fitEff | aggregate p95 | extrema p95 | extrema B / |U| / steps | others p95 |");
  console.log("| ---: | ---: | ---: | ---: | ---: | --- | ---: |");
  for (const b of warm.budget) console.log(`| ${b.rows} | ${b.fit} | ${b.fitEff} | ${f(b.aggregate.p95)} | ${f(b.extrema.p95)} | ${b.extremaInfo.B} / ${b.extremaInfo.U} / ${JSON.stringify(b.extremaInfo.steps.map((s) => [s.B, s.U, s.points]))} | ${f(b.others.p95)} |`);
  console.log(`\noracles: ${warm.oracles.filter((o) => o.pass).length}/${warm.oracles.length} PASS`);
  for (const o of warm.oracles) if (!o.pass) console.log(`  FAIL ${o.id} — expected ${JSON.stringify(o.expected)} actual ${JSON.stringify(o.actual)}`);
  console.log(`slider: ${JSON.stringify(warm.slider)}`);
  log(`saved ${join(OUT, "model-spike.json")}${errors.length ? ` · pageErrors ${errors.length}` : ""}`);
} finally {
  await browser.close();
  server.close();
}
