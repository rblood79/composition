/**
 * ADR-216 G4 — 가변 창 `[start, end]` (211 §2.5 개정, breakdown §2.3).
 *
 * 불변식 `0 ≤ start < end ≤ n` · `end − start ≥ min(fitEff, n)` — `n = 3 · fitEff = 10` (창 = [0, n],
 * 트랙 없음) 과 resize 로 fitEff 가 커지는 경우 포함. 넓힌 창은 `[start, end)` 조각을 극값 (line) /
 * 집계 (bar) 로 fitEff 슬롯에 맞추고 마크 ≤ M · 점 ≤ P 를 지킨다. end 미지정은 211 과 같은 창
 * (byte 동일). Canvas 초기 창 = `[0, min(fitEff, n)]` = Preview 초기 창.
 */
import { describe, expect, it } from "vitest";
import {
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
  computeChartScene,
} from "../computeChartScene";
import { clampWindowRange, clampWindowStart } from "../budget";
import { resolveChartModel } from "../model";
import { resolveChartData } from "../runtimeData";
import type { ChartProps, ChartRow } from "../types";

const metrics = CHART_DEFAULT_METRICS;
const size = { width: 400, height: 300 };
const rowsOf = (n: number): ChartRow[] =>
  Array.from({ length: n }, (_, i) => ({ category: `c${i}`, value: i % 11 }));
const P = (extra: Partial<ChartProps> = {}): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  chartType: "bar",
  dimension: "category",
  metric: "value",
  budgetOverflow: "window",
  ...extra,
});

describe("ADR-216 G4 — clampWindowRange 불변식", () => {
  it("end 미지정 = 211 clampWindowStart 와 같은 창 (원복 RED 축)", () => {
    for (const [start, n, fitEff] of [
      [0, 200, 40],
      [10, 200, 40],
      [500, 200, 40],
      [-5, 200, 40],
      [0, 3, 10],
      [2, 3, 10],
      [0, 0, 10],
      [4, 20, 0],
    ] as const) {
      const s = clampWindowStart(start, n, fitEff);
      expect(clampWindowRange(start, undefined, n, fitEff)).toEqual({
        start: s,
        end: Math.min(n, s + fitEff),
      });
    }
  });

  it("최소 창 = min(fitEff, n): 좁히면 end 를 밀고 (anchor start) / start 를 당긴다 (anchor end)", () => {
    expect(clampWindowRange(10, 12, 200, 40)).toEqual({ start: 10, end: 50 });
    expect(clampWindowRange(10, 12, 200, 40, "end")).toEqual({
      start: 0,
      end: 40,
    });
    expect(clampWindowRange(100, 112, 200, 40, "end")).toEqual({
      start: 72,
      end: 112,
    });
    // n = 3 · fitEff = 10 — 창은 항상 [0, n].
    expect(clampWindowRange(0, 1, 3, 10)).toEqual({ start: 0, end: 3 });
    expect(clampWindowRange(2, 3, 3, 10)).toEqual({ start: 0, end: 3 });
    expect(clampWindowRange(1, 2, 3, 10, "end")).toEqual({ start: 0, end: 3 });
    // 끝에서 밀리면 start 가 줄어든다.
    expect(clampWindowRange(190, 195, 200, 40)).toEqual({
      start: 160,
      end: 200,
    });
    // 넓힌 창은 그대로 (최소만 강제).
    expect(clampWindowRange(10, 150, 200, 40)).toEqual({ start: 10, end: 150 });
    expect(clampWindowRange(0, 10_000, 200, 40)).toEqual({
      start: 0,
      end: 200,
    });
    // 뒤집힌 입력은 최소 창으로 편다.
    expect(clampWindowRange(50, 20, 200, 40)).toEqual({ start: 50, end: 90 });
  });

  it("resize 로 fitEff 가 커지면 end 가 늘고, n 에서 부족하면 start 가 준다", () => {
    expect(clampWindowRange(0, 40, 200, 60)).toEqual({ start: 0, end: 60 });
    expect(clampWindowRange(160, 200, 200, 60)).toEqual({
      start: 140,
      end: 200,
    });
    expect(clampWindowRange(160, 200, 200, 60, "end")).toEqual({
      start: 140,
      end: 200,
    });
  });
});

describe("ADR-216 G4 — 모델: 넓힌 창 재추출 · 예산 · Canvas 초기 창", () => {
  it("bar 200 범주: end 를 넓히면 visible 은 창 조각의 bucket 집계 (마크 = fitEff ≤ M)", () => {
    const rows = rowsOf(200);
    const base = resolveChartData(rows, P(), metrics.seriesCount, {
      size,
      metrics,
      windowStart: 0,
    });
    const { fitEff, n } = base.budget;
    expect(n).toBe(200);
    expect(fitEff).toBeLessThan(n);
    const wide = resolveChartData(rows, P(), metrics.seriesCount, {
      size,
      metrics,
      windowStart: 0,
      windowEnd: fitEff * 3,
    });
    expect(wide.budget.window).toEqual({ start: 0, end: fitEff * 3 });
    expect(wide.budget.windowReduced).toBe("aggregate");
    expect(wide.grid.categories).toHaveLength(fitEff);
    expect(wide.grid.categories[0]).toBe("c0 ~ c2");
    // 예산 판정: 마크 수 = fitEff × S (1) ≤ M.
    expect(
      wide.grid.categories.length * wide.grid.series.length,
    ).toBeLessThanOrEqual(metrics.markBudget);
    // domain · plot · 트랙 자리는 창과 무관 (transformed 전체).
    expect(wide.ticks).toEqual(base.ticks);
    expect(wide.layout.plot).toEqual(base.layout.plot);
    expect(wide.layout.windowTrack).toEqual(base.layout.windowTrack);
  });

  it("line 2,000 범주: 넓힌 창은 극값 재추출 (점 ≤ P), 좁은 창은 그대로, 전체 창은 extrema 와 같은 조각", () => {
    const rows = rowsOf(2000);
    const props = P({ chartType: "line" });
    const base = resolveChartData(rows, props, metrics.seriesCount, {
      size,
      metrics,
      windowStart: 0,
    });
    const { fitEff, n } = base.budget;
    expect(base.budget.windowReduced).toBeNull();
    expect(base.grid.categories).toHaveLength(fitEff);
    const wide = resolveChartData(rows, props, metrics.seriesCount, {
      size,
      metrics,
      windowStart: 100,
      windowEnd: 100 + fitEff * 4,
    });
    expect(wide.budget.windowReduced).toBe("extrema");
    expect(wide.grid.categories.length).toBeLessThanOrEqual(fitEff * 2);
    expect(
      wide.grid.categories.length * wide.grid.series.length,
    ).toBeLessThanOrEqual(metrics.pointBudget);
    // 극값은 원본 라벨·원본 값 (집계 접미 없음) — 첫 범주는 창 시작 이후.
    expect(Number(wide.grid.categories[0].slice(1))).toBeGreaterThanOrEqual(
      100,
    );
    expect(wide.grid.categories.every((c) => !c.includes("~"))).toBe(true);
    const all = resolveChartData(rows, props, metrics.seriesCount, {
      size,
      metrics,
      windowStart: 0,
      windowEnd: n,
    });
    expect(all.budget.window).toEqual({ start: 0, end: n });
    expect(all.budget.windowReduced).toBe("extrema");
  });

  it("n < fitEff: 창 = [0, n], 트랙 없음, windowEnd 는 무시된다", () => {
    const rows = rowsOf(3);
    const model = resolveChartModel(rows, P(), {
      size,
      metrics,
      windowStart: 1,
      windowEnd: 2,
    });
    expect(model.budget.fitEff).toBeGreaterThan(3);
    expect(model.budget.window).toEqual({ start: 0, end: 3 });
    expect(model.layout.windowTrack).toBeNull();
    expect(model.visible.categories).toEqual(["c0", "c1", "c2"]);
  });

  it("Canvas 초기 창 = [0, min(fitEff, n)] — scene 의 thumb 2 자리 = Preview 초기 창 (windowStart 0) 의 자리", () => {
    const rows = rowsOf(200);
    const scene = computeChartScene(P(), rows, size, metrics);
    const dom = resolveChartData(rows, P(), metrics.seriesCount, {
      size,
      metrics,
      windowStart: 0,
    });
    expect(dom.budget.window).toEqual({ start: 0, end: dom.budget.fitEff });
    const track = scene.windowTrack!;
    const [thumb0, thumb1] = scene.marks.slice(-2) as Array<
      Extract<(typeof scene.marks)[number], { kind: "path" }>
    >;
    const center = (m: typeof thumb0): number => m.bbox.x + m.bbox.w / 2;
    expect(center(thumb0)).toBeCloseTo(
      track.x + (track.w * dom.budget.window!.start) / dom.budget.n,
      1,
    );
    expect(center(thumb1)).toBeCloseTo(
      track.x + (track.w * dom.budget.window!.end) / dom.budget.n,
      1,
    );
  });

  it("미설정 (windowEnd 없음) 은 211 과 byte 동일 — visible · budget.window 무변경", () => {
    const rows = rowsOf(200);
    const a = resolveChartData(rows, P(), metrics.seriesCount, {
      size,
      metrics,
      windowStart: 7,
    });
    const b = resolveChartData(rows, P(), metrics.seriesCount, {
      size,
      metrics,
      windowStart: 7,
      windowEnd: 7 + a.budget.fitEff,
    });
    expect(JSON.stringify(b.grid)).toBe(JSON.stringify(a.grid));
    expect(b.budget.window).toEqual(a.budget.window);
    expect(a.budget.windowReduced).toBeNull();
  });
});
