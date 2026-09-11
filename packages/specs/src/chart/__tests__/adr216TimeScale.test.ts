/**
 * ADR-216 G2 — 시간 스케일 모델. **손계산 oracle** (HC8 · R1): 양 끝 timestamp 를 아는 fixture
 * (2026-01-01 ~ 01-10 일별, 01-06 결측 → 9 범주) 에 window · extrema · aggregate (fitEff 2) 를
 * 적용해 transformed `positions` 와 마크 x 를 식으로 계산한 값과 대조한다 — 두 leg 가 같은 값에
 * 동의하는 것은 oracle 이 아니다 (그것은 (b) 에서 별도로 확인).
 *
 * 손계산 근거: span 9일 · count = floor(plot.w / 48.4) (2~12) → 눈금 표에서 1일 (target ≈ 1.3일:
 * 1일 비율 1.3 < 2일 비율 1.55) → domain = [Jan 1, Jan 10] (일 경계라 nice 무변경) →
 * x(t) = plot.x + (일수 − 1) / 9 × plot.w.
 */
import { describe, expect, it } from "vitest";
import {
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
} from "../computeChartScene";
import { computeChartScene, resolveCategoryBand } from "../computeChartScene";
import { buildAxes } from "../axes";
import {
  aggregateBuckets,
  selectExtrema,
  applyWindow,
  pickCategories,
} from "../budget";
import { resolveChartModel } from "../model";
import { resolveChartData } from "../runtimeData";
import { buildSeriesGrid } from "../series";
import { resolveChartPresentation } from "../presentation";
import { linearScale, r2 } from "../scales";
import { DURATION_DAY } from "../timeIntervals";
import type { ChartProps, ChartRow, PathMark } from "../types";

const DAY = (d: number): number => Date.UTC(2026, 0, d);
const ISO = (d: number): string => `2026-01-${String(d).padStart(2, "0")}`;
/** Jan 1..5 → 1 5 2 9 3 · Jan 7..10 → 4 8 1 6 (Jan 6 결측). */
const VALUES: Record<number, number> = {
  1: 1,
  2: 5,
  3: 2,
  4: 9,
  5: 3,
  7: 4,
  8: 8,
  9: 1,
  10: 6,
};
const DAYS = [1, 2, 3, 4, 5, 7, 8, 9, 10];
const rows: ChartRow[] = DAYS.map((d) => ({ date: ISO(d), value: VALUES[d] }));

const metrics = CHART_DEFAULT_METRICS;
const size = { width: 400, height: 300 };
const line = (extra: Partial<ChartProps> = {}): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  chartType: "line",
  dimension: "date",
  metric: "value",
  dimensionScale: "time",
  ...extra,
});

/** 손계산 x — plot 은 검증 대상이 아니라 입력이다 (layout 이 준 값). */
const expectedX = (plot: { x: number; w: number }, day: number): number =>
  r2(plot.x + ((day - 1) / 9) * plot.w);

function pathXs(scene: ReturnType<typeof computeChartScene>): number[] {
  const path = scene.marks.find(
    (m): m is PathMark => m.kind === "path" && m.strokeSeries !== undefined,
  )!;
  // `M x y L x y …` — 선형 보간이라 명령마다 좌표 한 쌍.
  return path.d
    .split(/[ML]\s*/)
    .filter(Boolean)
    .map((seg) => r2(Number(seg.trim().split(/\s+/)[0])));
}

describe("ADR-216 G2 (a) — 손계산 oracle: positions · 마크 x", () => {
  it("input: 파싱 → epoch 오름차순 9 범주, positions 보존, 같은 시각은 합산", () => {
    const shuffled = [...rows].reverse();
    shuffled.push({ date: "2026-01-03T00:00:00Z", value: 100 }); // 같은 시각 다른 표기 → 합산
    const presentation = resolveChartPresentation(line(), 8);
    const grid = buildSeriesGrid(shuffled, line(), 8, presentation);
    expect(grid.positions).toEqual(DAYS.map(DAY));
    expect(grid.categories).toEqual(DAYS.map(ISO));
    expect(grid.series[0].values.get(2)).toBe(102);
    expect(grid.parseFailures).toBe(0);
  });

  it("aggregate B=2: bucket [0,5) [5,9) → positions [Jan 1, Jan 7] · ranges [[1,5],[7,10]]", () => {
    const grid = buildSeriesGrid(rows, line(), 8);
    const agg = aggregateBuckets(grid, 2, "sum");
    expect(agg.positions).toEqual([DAY(1), DAY(7)]);
    expect(agg.positionRanges).toEqual([
      [DAY(1), DAY(5)],
      [DAY(7), DAY(10)],
    ]);
    expect(agg.categories).toEqual([
      "2026-01-01 ~ 2026-01-05",
      "2026-01-07 ~ 2026-01-10",
    ]);
    expect([...agg.series[0].values.values()]).toEqual([
      1 + 5 + 2 + 9 + 3,
      4 + 8 + 1 + 6,
    ]);
  });

  it("extrema fitEff 2: bucket 별 min/max index {0,3} ∪ {6,7} → positions [Jan 1, 4, 8, 9]", () => {
    const grid = buildSeriesGrid(rows, line(), 8);
    const picked = selectExtrema(grid, 2, 0, metrics);
    expect(picked.indices).toEqual([0, 3, 6, 7]);
    const kept = pickCategories(grid, picked.indices);
    expect(kept.positions).toEqual([DAY(1), DAY(4), DAY(8), DAY(9)]);
    expect([...kept.series[0].values.values()]).toEqual([1, 9, 8, 1]);
  });

  it("window [3, 5): positions 슬라이스 [Jan 4, Jan 5] — 라벨과 같이 옮긴다", () => {
    const grid = buildSeriesGrid(rows, line(), 8);
    const win = applyWindow(grid, { start: 3, end: 5 });
    expect(win.positions).toEqual([DAY(4), DAY(5)]);
    expect(win.categories).toEqual([ISO(4), ISO(5)]);
  });

  it("scene — window (fitEff 2): 마크 x = plot.x + (일수−1)/9 × plot.w, domain 은 transformed 전체", () => {
    const base = resolveChartModel(rows, line(), { size, metrics });
    const m = { ...metrics, minPointGap: base.layout.plot.w / 2 };
    const scene = computeChartScene(
      line({ budgetOverflow: "window" }),
      rows,
      size,
      m,
    );
    const model = resolveChartModel(rows, line({ budgetOverflow: "window" }), {
      size,
      metrics: m,
    });
    expect(model.budget.fitEff).toBe(2);
    expect(model.time?.domain).toEqual([DAY(1), DAY(10)]);
    expect(model.time?.granularity).toBe("day");
    const plot = scene.plot;
    expect(pathXs(scene)).toEqual([expectedX(plot, 1), expectedX(plot, 2)]);
    // 눈금 10 (Jan 1..10, stop 포함) · 경계 라벨은 Jan 1 (월초) 만.
    const x = scene.axes[0];
    expect(x.ticks.filter((t) => t.text === "Jan")).toHaveLength(1);
    expect(x.ticks.map((t) => t.text).slice(0, 3)).toEqual(["1", "Jan", "2"]);
    expect(x.ticks.find((t) => t.text === "10")!.x).toBe(expectedX(plot, 10));
  });

  it("scene — extrema (fitEff 2): 마크 x 는 원본 epoch [1, 4, 8, 9] 의 자리 — domain 은 transformed [Jan 1, Jan 9] (span 8일)", () => {
    const base = resolveChartModel(rows, line(), { size, metrics });
    const m = { ...metrics, minPointGap: base.layout.plot.w / 2 };
    const props = line({ budgetOverflow: "extrema" });
    const scene = computeChartScene(props, rows, size, m);
    const model = resolveChartModel(rows, props, { size, metrics: m });
    expect(model.budget.applied).toBe("extrema");
    expect(model.transformed.positions).toEqual([DAY(1), DAY(4), DAY(8), DAY(9)]);
    // 극값이 Jan 10 을 버렸으므로 domain 끝은 Jan 9 (breakdown §2.1: domain = transformed 의 [min, max]).
    expect(model.time?.domain).toEqual([DAY(1), DAY(9)]);
    const plot = scene.plot;
    expect(pathXs(scene)).toEqual(
      [1, 4, 8, 9].map((d) => r2(plot.x + ((d - 1) / 8) * plot.w)),
    );
  });

  it("scene — aggregate (fitEff 2): 마크 x = t0 (Jan 1 · Jan 7), domain 끝은 t1 (Jan 10)", () => {
    const base = resolveChartModel(rows, line(), { size, metrics });
    const m = { ...metrics, minPointGap: base.layout.plot.w / 2 };
    const props = line({ budgetOverflow: "aggregate" });
    const scene = computeChartScene(props, rows, size, m);
    const model = resolveChartModel(rows, props, { size, metrics: m });
    expect(model.budget.applied).toBe("aggregate");
    expect(model.transformed.positions).toEqual([DAY(1), DAY(7)]);
    expect(model.time?.domain).toEqual([DAY(1), DAY(10)]);
    const plot = scene.plot;
    expect(pathXs(scene)).toEqual([expectedX(plot, 1), expectedX(plot, 7)]);
  });

  it("시간 스케일은 예산 축을 ordinal 로 고정한다 (line 기본 overflow = extrema)", () => {
    const model = resolveChartModel(rows, line(), { size, metrics });
    expect(model.budget.axisKind).toBe("ordinal");
    expect(model.budget.mode).toBe("extrema");
  });
});

describe("ADR-216 G2 (b) — 두 leg 동일 (같은 입력의 visible · 눈금 · 라벨 byte 동일)", () => {
  it("scene.axes[0] === DOM leg buildAxes(resolveCategoryBand(model.time)) (JSON)", () => {
    const props = line({ showGrid: true });
    const scene = computeChartScene(props, rows, size, metrics);
    const dom = resolveChartData(rows, props, metrics.seriesCount, {
      size,
      metrics,
      windowStart: 0,
    });
    expect(dom.time).toBeDefined();
    const plot = dom.layout.plot;
    const { band, timeAxis } = resolveCategoryBand(dom.time, dom.grid, [
      plot.x,
      r2(plot.x + plot.w),
    ]);
    const value = linearScale(dom.ticks.domain, [r2(plot.y + plot.h), plot.y]);
    const axes = buildAxes({
      categories: dom.grid.categories,
      band,
      value,
      ticks: dom.ticks,
      plot,
      orientation: props.orientation,
      fontSize: dom.layout.fontSize,
      showAxis: true,
      showGrid: true,
      tickText: dom.layout.tickText,
      ...(timeAxis ? { time: timeAxis } : {}),
    });
    expect(JSON.stringify(axes)).toBe(JSON.stringify(scene.axes));
    expect(dom.grid.positions).toEqual(
      scene.marks.length > 0 ? DAYS.map(DAY) : [],
    );
    expect(dom.time).toEqual(
      resolveChartModel(rows, props, { size, metrics, windowStart: 0 }).time,
    );
  });

  it("2단 라벨은 하단 여백 두 줄 — `dimensionLabelFormat` 이면 한 줄 + 라벨 문자열 대체", () => {
    const two = resolveChartModel(rows, line(), { size, metrics });
    const one = resolveChartModel(
      rows,
      line({ dimensionLabelFormat: "%m/%d" }),
      { size, metrics },
    );
    const cat = resolveChartModel(
      rows,
      { ...line(), dimensionScale: undefined },
      { size, metrics },
    );
    expect(two.layout.plot.h).toBeLessThan(one.layout.plot.h);
    expect(one.layout.plot.h).toBe(cat.layout.plot.h);
    expect(one.time?.labels.every((l) => l.boundary === null)).toBe(true);
    expect(one.time?.labels[0].tick).toBe("01/01");
    expect(two.time?.labels[0]).toEqual({
      t: DAY(1),
      tick: "1",
      boundary: "Jan",
    });
  });

  it("ko-KR 로케일 (valueLocale 재사용) 이면 경계 라벨이 한국어 월", () => {
    const model = resolveChartModel(rows, line({ valueLocale: "ko-KR" }), {
      size,
      metrics,
    });
    expect(model.time?.labels[0].boundary).toBe("1월");
  });
});

describe("ADR-216 G2 (c) — 거부 · 파싱 실패 · 달력 넘침", () => {
  it("bar / pie + time → presentation.ok=false + dimensionScale.unsupportedChartType", () => {
    for (const chartType of ["bar", "pie", "radar", "radial"] as const) {
      const scene = computeChartScene(line({ chartType }), rows, size, metrics);
      expect(scene.empty).toBe(true);
      expect(scene.diagnostics?.map((d) => d.code)).toContain(
        "dimensionScale.unsupportedChartType",
      );
    }
    for (const chartType of ["line", "area"] as const) {
      const scene = computeChartScene(line({ chartType }), rows, size, metrics);
      expect(scene.empty).toBe(false);
    }
  });

  it("파싱 실패 행 (형식 불일치 · 2026-02-30) 은 범주에 들어가지 않고 진단 count 로만 보인다", () => {
    const dirty: ChartRow[] = [
      ...rows,
      { date: "not a date", value: 1 },
      { date: "2026-02-30", value: 1 },
      { date: 12345, value: 1 },
    ];
    const model = resolveChartModel(dirty, line(), { size, metrics });
    expect(model.input.categories).toEqual(DAYS.map(ISO));
    expect(model.input.parseFailures).toBe(3);
    const diag = model.diagnostics.find(
      (d) => d.code === "dimension.parse.failed",
    );
    expect(diag).toMatchObject({ severity: "warning", value: "3" });
    expect(model.presentation.ok).toBe(true);
  });

  it("dimensionFormat 지시자로 비-ISO 입력 (2026/01/05 · epoch 초) 을 받는다", () => {
    const slash = DAYS.map((d) => ({
      date: `2026/01/${String(d).padStart(2, "0")}`,
      value: VALUES[d],
    }));
    const a = resolveChartModel(slash, line({ dimensionFormat: "%Y/%m/%d" }), {
      size,
      metrics,
    });
    expect(a.input.positions).toEqual(DAYS.map(DAY));
    const epoch = DAYS.map((d) => ({
      date: String(DAY(d) / 1000),
      value: VALUES[d],
    }));
    const b = resolveChartModel(epoch, line({ dimensionFormat: "%s" }), {
      size,
      metrics,
    });
    expect(b.input.positions).toEqual(DAYS.map(DAY));
    // ISO 입력에 다른 지시자를 주면 전부 실패 → 빈 격자 + 진단 9.
    const c = resolveChartModel(rows, line({ dimensionFormat: "%d.%m.%Y" }), {
      size,
      metrics,
    });
    expect(c.input.categories).toEqual([]);
    expect(c.input.parseFailures).toBe(9);
  });

  it("잘못된 dimensionScale 값 · 빈 지시자 → 설정 오류", () => {
    const bad = resolveChartPresentation(
      { ...line(), dimensionScale: "epoch" as unknown as "time" },
      8,
    );
    expect(bad.ok).toBe(false);
    expect(bad.diagnostics.map((d) => d.code)).toContain(
      "dimensionScale.invalid",
    );
    const empty = resolveChartPresentation(line({ dimensionFormat: "  " }), 8);
    expect(empty.diagnostics.map((d) => d.code)).toContain(
      "dimensionFormat.invalid",
    );
    expect(empty.ok).toBe(false);
    // 휴면 (category) 의 잘못된 지시자는 경고만 — 현행 차트를 막지 않는다.
    const dormant = resolveChartPresentation(
      { ...line(), dimensionScale: undefined, dimensionFormat: "" },
      8,
    );
    expect(dormant.ok).toBe(true);
  });
});

describe("ADR-216 HC1 — 미설정 문서는 데이터 기하 byte 동일", () => {
  it("dimensionScale 없음 = 현행 band (positions 없음, 첫 출현 순)", () => {
    const props = { ...line(), dimensionScale: undefined };
    const shuffled = [...rows].reverse();
    const model = resolveChartModel(shuffled, props, { size, metrics });
    expect(model.input.positions).toBeUndefined();
    expect(model.time).toBeUndefined();
    expect(model.input.categories[0]).toBe(ISO(10));
    const before = computeChartScene(props, shuffled, size, metrics);
    const after = computeChartScene(
      { ...props, dimensionScale: "category" },
      shuffled,
      size,
      metrics,
    );
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });

  it("시간 간격: 결측 Jan 6 은 빈 자리 — Jan 5 → Jan 7 간격이 2 슬롯", () => {
    const scene = computeChartScene(line(), rows, size, metrics);
    const xs = pathXs(scene);
    const gap = (i: number): number => r2(xs[i + 1] - xs[i]);
    expect(gap(4)).toBeCloseTo(gap(0) * 2, 1);
    expect(xs).toHaveLength(9);
    expect(xs[8] - xs[0]).toBeCloseTo(scene.plot.w, 1);
    expect(xs[0]).toBe(scene.plot.x);
  });
});

describe("ADR-216 — 단일 시각 · 넓은 span 의 눈금 단위", () => {
  it("행 1개는 하루 domain, 3년 span 은 월/분기 단위", () => {
    const one = resolveChartModel([rows[0]], line(), { size, metrics });
    expect(one.time?.domain).toEqual([DAY(1), DAY(1) + DURATION_DAY]);
    const years = Array.from({ length: 36 }, (_, i) => ({
      date: new Date(Date.UTC(2024, i, 1)).toISOString().slice(0, 10),
      value: i,
    }));
    const wide = resolveChartModel(years, line(), { size, metrics });
    expect(["month", "week"]).toContain(wide.time?.granularity);
    expect(wide.time?.labels.some((l) => l.boundary === "2025")).toBe(true);
  });
});
