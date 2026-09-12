/**
 * ADR-217 P4 / G2 — 산점도 (`chartType:"scatter"`) 모델.
 *
 * - 행 = 점 (같은 x 합산 없음) · x 는 숫자 (`dimensionScale` 미설정/`category` = linear) 또는 time
 * - 손계산 oracle: (1,10) (1,30) (2,20) (4,40) (4,40) 1 시리즈 → 범주 5 · positions [1,1,2,4,4] · x domain
 *   `niceTicks(1,4)` · 점 path subpath 5 (겹친 점도 2개)
 * - HC9 (round 1 h1): 예산 · 창 · 넓힌 창 뒤의 모든 (x, y, series) ⊆ 입력 — 집계 0
 *   (a) codex fixture 600행 × 60시리즈 → overflow 0 (b) 12,000 × 60 → 희소 극값 ⊆ 입력 · ≤ P
 *   (c) 6,000 시리즈 × 2 → stride 솎기 ⊆ 입력 + 진단 `budget.thinned` (d) 넓힌 창 재추출 ⊆ 입력
 */
import { describe, expect, it } from "vitest";
import {
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
  computeChartScene,
} from "../computeChartScene";
import { resolveChartModel } from "../model";
import { resolveChartPresentation } from "../presentation";
import { resolveChartData } from "../runtimeData";
import { niceTicks } from "../scales";
import type { SeriesGrid } from "../series";
import {
  CHART_TYPES,
  type ChartProps,
  type ChartRow,
  type PathMark,
} from "../types";

const size = { width: 400, height: 300 };
const metrics = CHART_DEFAULT_METRICS;
const P = (extra: Partial<ChartProps> = {}): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  chartType: "scatter",
  dimension: "x",
  metric: "y",
  color: "series",
  showLegend: false,
  ...extra,
});
const five: ChartRow[] = [
  { x: 4, y: 40, series: "a" },
  { x: 1, y: 10, series: "a" },
  { x: 2, y: 20, series: "a" },
  { x: 1, y: 30, series: "a" },
  { x: 4, y: 40, series: "a" },
];
/** codex round 1 fixture — 행 i: x=i · 시리즈 i%S · y=floor(i/S)+1. */
const sparse = (rows: number, S: number): ChartRow[] =>
  Array.from({ length: rows }, (_, i) => ({
    x: i,
    y: Math.floor(i / S) + 1,
    series: `s${i % S}`,
  }));
/** 격자의 모든 관측점 (x, y, series) — HC9 소속 검사용. */
function observations(grid: SeriesGrid): Set<string> {
  const out = new Set<string>();
  grid.series.forEach((sd) => {
    for (const [ci, v] of sd.values)
      out.add(`${grid.positions![ci]}|${v}|${sd.key}`);
  });
  return out;
}
const inputSet = (rows: ChartRow[]) =>
  new Set(rows.map((r) => `${r.x}|${r.y}|${r.series}`));
const dotPaths = (scene: ReturnType<typeof computeChartScene>) =>
  scene.marks.filter(
    (m): m is PathMark => m.kind === "path" && m.fillSeries !== undefined,
  );

describe("ADR-217 G2 — 산점도 격자 · 스케일 · 마크", () => {
  it("CHART_TYPES 에 scatter 가 있고 scene 은 설정 오류가 아니라 점 마크다 (assertNever GREEN)", () => {
    expect([...CHART_TYPES]).toContain("scatter");
    const scene = computeChartScene(P(), five, size);
    expect(scene.empty).toBe(false);
    expect(
      scene.diagnostics?.some((d) => d.code === "chartType.unsupported"),
    ).toBeFalsy();
    expect(dotPaths(scene)).toHaveLength(1);
  });

  it("손계산 oracle — 행 = 점 (중복 x 합산 0) · x 정렬 · domain niceTicks(1,4) · subpath 5 · 불투명", () => {
    const model = resolveChartModel(five, P(), { size, metrics });
    expect(model.input.categories).toHaveLength(5);
    expect(model.input.positions).toEqual([1, 1, 2, 4, 4]);
    expect(model.input.series[0].values.get(0)).toBe(10);
    expect(model.input.series[0].values.get(1)).toBe(30);
    expect(model.linear?.domain).toEqual(niceTicks(1, 4, 5).domain);
    expect(model.presentation.dimension.scale).toBe("linear");
    const scene = computeChartScene(P(), five, size);
    const [dots] = dotPaths(scene);
    expect(dots.d.match(/M /g)).toHaveLength(5);
    expect(dots.fillOpacity).toBe(1);
    // 첫 subpath 의 왼쪽 끝 = scale(1) − r → x 축 domain 왼끝이 1 이면 plot.x − r.
    const domain = model.linear!.domain;
    const sx = (v: number) =>
      scene.plot.x + ((v - domain[0]) / (domain[1] - domain[0])) * scene.plot.w;
    const firstLeft = Number(dots.d.split(" ")[1]);
    expect(firstLeft).toBeLessThan(sx(1));
    expect(sx(1) - firstLeft).toBeLessThanOrEqual(4);
    // x 축 눈금 = domain 의 nice 눈금 문자열 (값 축과 같은 형식).
    const xTicks = scene.axes
      .find((a) => a.axis === "x")!
      .ticks.map((t) => t.text);
    expect(xTicks).toEqual(niceTicks(1, 4, 5).ticks.map(String));
    expect(scene.tooltip).toBeNull();
  });

  it("dimensionScale — 미설정/category = linear (scatter 만) · line 은 category 그대로 · time 은 216 파서", () => {
    expect(
      resolveChartPresentation(P({ dimensionScale: "category" }), 8).dimension
        .scale,
    ).toBe("linear");
    expect(
      resolveChartPresentation(P({ chartType: "line" }), 8).dimension.scale,
    ).toBe("category");
    const rows = [
      { x: "2026-01-01", y: 1, series: "a" },
      { x: "2026-01-03", y: 2, series: "a" },
      { x: "2026-01-01", y: 3, series: "a" },
    ];
    const model = resolveChartModel(rows, P({ dimensionScale: "time" }), {
      size,
      metrics,
    });
    expect(model.time).toBeDefined();
    expect(model.input.categories).toHaveLength(3);
    expect(model.input.positions![0]).toBe(model.input.positions![1]);
    expect(model.presentation.dimension.scale).toBe("time");
  });

  it("x 파싱 실패 행은 제외 + 경고 · 예산 모드 aggregate/others 거부 · 기본 extrema · 기준선 허용", () => {
    const rows = [...five, { x: "abc", y: 1, series: "a" }];
    const model = resolveChartModel(rows, P(), { size, metrics });
    expect(model.input.categories).toHaveLength(5);
    expect(
      model.diagnostics.find((d) => d.code === "dimension.parse.failed"),
    ).toMatchObject({ value: "1" });
    const codes = (extra: Partial<ChartProps>) =>
      resolveChartPresentation(P(extra), 8).diagnostics.map((d) => d.code);
    expect(codes({ budgetOverflow: "aggregate" })).toContain(
      "budget.overflow.unsupported",
    );
    expect(codes({ budgetOverflow: "others" })).toContain(
      "budget.overflow.unsupported",
    );
    expect(codes({ budgetOverflow: "window" })).not.toContain(
      "budget.overflow.unsupported",
    );
    expect(model.budget.mode).toBe("extrema");
    const ref = resolveChartModel(
      five,
      P({ referenceLines: [{ value: 80 }] }),
      { size, metrics },
    );
    expect(ref.ticks.domain[1]).toBeGreaterThanOrEqual(80);
  });
});

describe("ADR-217 G2 — HC9 산점도 결과 = 원본 관측점 (집계 0)", () => {
  it("(a) codex 600행 × 60시리즈 — overflow 0 · 600 점 전부 · 출력 ⊆ 입력", () => {
    const rows = sparse(600, 60);
    const model = resolveChartModel(rows, P(), { size, metrics });
    expect(model.budget.overflow).toBe(false);
    expect(model.budget.applied).toBeNull();
    expect(model.visible.categories).toHaveLength(600);
    const out = observations(model.visible);
    expect(out.size).toBe(600);
    for (const o of out) expect(inputSet(rows).has(o)).toBe(true);
    expect(out.has("60|2|s0")).toBe(true);
  });

  it("(b) 12,000 × 60 — 희소 극값 ⊆ 입력 · ≤ P · 집계 라벨 0", () => {
    const rows = sparse(12_000, 60);
    const model = resolveChartModel(rows, P(), { size, metrics });
    expect(model.budget.overflow).toBe(true);
    expect(model.budget.applied).toBe("extrema");
    expect(model.budget.fitEff).toBe(metrics.pointBudget);
    const out = observations(model.visible);
    expect(out.size).toBeLessThanOrEqual(metrics.pointBudget);
    expect(out.size).toBeGreaterThan(0);
    const input = inputSet(rows);
    for (const o of out) expect(input.has(o)).toBe(true);
    expect(model.visible.categories.some((c) => c.includes("~"))).toBe(false);
    expect(model.visible.positionRanges).toBeUndefined();
  });

  it("(c) 6,000 시리즈 × 2 — B=1 에서도 넘치면 stride 솎기 (원본 점) + 진단, 집계 0", () => {
    const rows = sparse(12_000, 6_000);
    const model = resolveChartModel(rows, P(), { size, metrics });
    expect(model.budget.applied).toBe("extrema");
    expect(model.diagnostics.some((d) => d.code === "budget.thinned")).toBe(
      true,
    );
    expect(
      model.diagnostics.some((d) => d.code === "budget.tooManySeries"),
    ).toBe(false);
    const out = observations(model.visible);
    expect(out.size).toBeLessThanOrEqual(metrics.pointBudget);
    expect(out.size).toBeGreaterThan(0);
    const input = inputSet(rows);
    for (const o of out) expect(input.has(o)).toBe(true);
  });

  it("(d) 창 모드 — 초기 창 P 점 그대로 · 넓힌 창 [0, n) 재추출도 희소 극값 ⊆ 입력", () => {
    const rows = sparse(12_000, 60);
    const base = resolveChartData(rows, P({ budgetOverflow: "window" }), 8, {
      size,
      metrics,
      windowStart: 0,
    });
    expect(base.budget.window).toEqual({ start: 0, end: metrics.pointBudget });
    expect(base.grid.categories).toHaveLength(metrics.pointBudget);
    const wide = resolveChartData(rows, P({ budgetOverflow: "window" }), 8, {
      size,
      metrics,
      windowStart: 0,
      windowEnd: 12_000,
    });
    expect(wide.budget.windowReduced).toBe("extrema");
    const out = observations(wide.grid);
    expect(out.size).toBeLessThanOrEqual(metrics.pointBudget);
    const input = inputSet(rows);
    for (const o of out) expect(input.has(o)).toBe(true);
    expect(wide.grid.categories.some((c) => c.includes("~"))).toBe(false);
  });
});
