/**
 * ADR-211 P2 (G2) — 축 종류 · bucket 집계 · bucket 극값 선택 (적응 B · gap sentinel · fallback) ·
 * others · transformed domain · `--chart-others` 두 leg.
 *
 * R3 독립 오라클 (breakdown §5): 기대값은 **원본 스캔 손계산** 이다 — 선택/집계 알고리즘을
 * 다시 부르지 않는다.
 */
import { describe, expect, it } from "vitest";
import {
  CHART_BUDGET_DEFAULTS,
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
  CHART_OTHERS_COLOR_INDEX,
  CHART_OTHERS_LABEL,
  aggregateBuckets,
  applyBudget,
  bucketBounds,
  bucketLabel,
  buildSeriesGrid,
  categoryColorIndex,
  computeChartScene,
  defaultBudgetMode,
  groupOthers,
  parseIsoStrict,
  resolveAxisKind,
  resolveChartData,
  resolveChartModel,
  resolveChartPresentation,
  resolveDisplayBudget,
  selectExtrema,
  supportsBudgetMode,
} from "../index";
import type { ChartProps, ChartRow, SeriesGrid } from "../index";
import { SKIA_PRIMITIVES } from "../../renderers/skiaPrimitives";

const U = CHART_BUDGET_DEFAULTS;
const M = CHART_DEFAULT_METRICS;
const SIZE = { width: 500, height: 300 };
const P = (overrides: Partial<ChartProps> = {}): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  color: "series",
  ...overrides,
});
/** 손으로 만든 격자 — categories + 시리즈별 값 (undefined = 결측). */
function grid(
  categories: string[],
  series: Array<Array<number | undefined>>,
): SeriesGrid {
  return {
    categories,
    series: series.map((vals, si) => ({
      key: `s${si}`,
      id: `s${si}`,
      seriesIndex: si,
      values: new Map(
        vals.flatMap((v, ci) =>
          v === undefined ? [] : [[ci, v] as [number, number]],
        ),
      ),
    })),
    hasValues: true,
  };
}
const values = (g: SeriesGrid, si: number) =>
  g.categories.map((_, ci) => g.series[si].values.get(ci) ?? null);
/** i 일째 (2024-01-01 부터) 의 ISO 날짜 — 단조 오름차순 기간 축 fixture. */
const day = (i: number) =>
  new Date(Date.UTC(2024, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
const iso = day;
const dateRows = (
  n: number,
  value: (i: number) => number,
  S = 1,
): ChartRow[] => {
  const out: ChartRow[] = [];
  for (let i = 0; i < n; i++)
    for (let si = 0; si < S; si++)
      out.push({
        category: day(i),
        value: value(i) + si * 0.25,
        series: `s${si}`,
      });
  return out;
};

describe("ADR-211 G2 — 축 종류 (§2.3 보수적 판정)", () => {
  it("엄격 ISO-8601 만 통과한다 — 숫자형 문자열·달력 밖 날짜는 아니다", () => {
    expect(parseIsoStrict("2024-01-05")).toBe(Date.UTC(2024, 0, 5));
    expect(parseIsoStrict("2024-01-05T10:30")).toBe(
      Date.UTC(2024, 0, 5, 10, 30),
    );
    expect(parseIsoStrict("2024-01-05T10:30:15.5Z")).toBe(
      Date.UTC(2024, 0, 5, 10, 30, 15, 500),
    );
    expect(parseIsoStrict("2024-01-05T00:00+09:00")).toBe(
      Date.UTC(2024, 0, 4, 15, 0),
    );
    for (const bad of [
      "2024",
      "001",
      "2024-02-30",
      "2024-13-01",
      "2024/01/05",
      "Jan 5",
      "20240105",
    ])
      expect(parseIsoStrict(bad), bad).toBeNull();
  });

  it('전부 ISO + 단조 (오름 또는 내림) 일 때만 ordinal · 결측 "" 은 제외', () => {
    const asc = [0, 1, 2, 3].map(iso);
    expect(resolveAxisKind(asc, undefined)).toBe("ordinal");
    expect(resolveAxisKind([...asc].reverse(), undefined)).toBe("ordinal");
    expect(resolveAxisKind(["2024-01-01", "", "2024-01-03"], undefined)).toBe(
      "ordinal",
    );
    expect(
      resolveAxisKind(["2024-01-01", "2024-01-03", "2024-01-02"], undefined),
    ).toBe("category");
    expect(resolveAxisKind(["2024-01-01", "x", "2024-01-03"], undefined)).toBe(
      "category",
    );
    expect(resolveAxisKind(["2024", "2025"], undefined)).toBe("category");
    expect(resolveAxisKind([""], undefined)).toBe("category");
    expect(resolveAxisKind(["2024", "2025"], "ordinal")).toBe("ordinal");
    expect(resolveAxisKind(asc, "category")).toBe("category");
  });

  it("auto 기본: bar 순서 → 집계 · line/area 순서 비누적 → 극값 · 누적 → 집계 · 범주 → 창 · 극좌표 → others", () => {
    expect(defaultBudgetMode("bar", "ordinal")).toBe("aggregate");
    expect(defaultBudgetMode("bar", "category")).toBe("window");
    expect(defaultBudgetMode("line", "ordinal", false)).toBe("extrema");
    expect(defaultBudgetMode("line", "ordinal", true)).toBe("aggregate");
    expect(defaultBudgetMode("area", "ordinal", true)).toBe("aggregate");
    expect(defaultBudgetMode("area", "category")).toBe("window");
    expect(defaultBudgetMode("pie", "ordinal")).toBe("others");
  });

  it("지원표 ✗ 조합은 validator 가 error 로 거부한다 (`presentation.ok=false`)", () => {
    expect(supportsBudgetMode("bar", "extrema")).toBe(false);
    expect(supportsBudgetMode("line", "others")).toBe(false);
    expect(supportsBudgetMode("pie", "window")).toBe(false);
    expect(supportsBudgetMode("pie", "others")).toBe(true);
    const bad = resolveChartPresentation(
      { ...P({ chartType: "pie" }), budgetOverflow: "window" },
      8,
    );
    expect(bad.ok).toBe(false);
    expect(bad.diagnostics.map((d) => d.code)).toEqual([
      "budget.overflow.unsupported",
    ]);
    const bad2 = resolveChartPresentation(
      {
        ...P(),
        budgetAggregate: "median" as never,
        budgetAxis: "time" as never,
        budgetOthersLabel: "",
      },
      8,
    );
    expect(bad2.diagnostics.map((d) => d.code)).toEqual([
      "budget.aggregate.invalid",
      "budget.axis.invalid",
      "budget.othersLabel.invalid",
    ]);
    const ok = resolveChartPresentation(
      {
        ...P({ chartType: "pie" }),
        budgetOverflow: "others",
        budgetOthersLabel: "기타",
      },
      8,
    );
    expect(ok.ok).toBe(true);
    expect(ok.budget).toEqual({
      overflow: "others",
      aggregate: "sum",
      axis: "auto",
      othersLabel: "기타",
    });
    expect(resolveChartPresentation(P(), 8).budget.othersLabel).toBe(
      CHART_OTHERS_LABEL,
    );
  });
});

describe("ADR-211 G2 — bucket 집계 (R3 오라클)", () => {
  // 범주 8 · 시리즈 2, s1 에 결측 2개
  const g = grid(
    ["a", "b", "c", "d", "e", "f", "g", "h"],
    [
      [1, 2, 3, 4, 5, 6, 7, 8],
      [10, undefined, 30, 40, undefined, 60, 70, 80],
    ],
  );

  it("경계: B 3 · n 8 → 크기 ceil(8/3)=3 → [0,3) [3,6) [6,8) · 라벨 `첫 ~ 끝`", () => {
    expect(bucketBounds(8, 3)).toEqual([
      [0, 3],
      [3, 6],
      [6, 8],
    ]);
    expect(aggregateBuckets(g, 3, "sum").categories).toEqual([
      "a ~ c",
      "d ~ f",
      "g ~ h",
    ]);
    expect(aggregateBuckets(g, 8, "sum").categories).toEqual(g.categories);
  });

  it("sum: bucket 합 = 원본 합 (시리즈별) — 결측 제외", () => {
    const out = aggregateBuckets(g, 3, "sum");
    expect(values(out, 0)).toEqual([1 + 2 + 3, 4 + 5 + 6, 7 + 8]);
    expect(values(out, 1)).toEqual([10 + 30, 40 + 60, 70 + 80]);
    const total = (x: SeriesGrid, si: number) =>
      values(x, si).reduce<number>((a, v) => a + (v ?? 0), 0);
    expect(total(out, 0)).toBe(total(g, 0));
    expect(total(out, 1)).toBe(total(g, 1));
  });

  it("mean: bucket 안 범주 값의 평균 (행 평균 아님) · max · min", () => {
    const mean = aggregateBuckets(g, 3, "mean");
    expect(values(mean, 0)).toEqual([2, 5, 7.5]);
    expect(values(mean, 1)).toEqual([20, 50, 75]);
    expect(values(aggregateBuckets(g, 3, "max"), 1)).toEqual([30, 60, 80]);
    expect(values(aggregateBuckets(g, 3, "min"), 1)).toEqual([10, 40, 70]);
    // bucket 전체가 결측이면 값 없음
    const sparse = grid(["a", "b", "c", "d"], [[undefined, undefined, 3, 4]]);
    expect(values(aggregateBuckets(sparse, 2, "mean"), 0)).toEqual([null, 3.5]);
  });

  it("모델: 기간 축 bar 400 범주 → 집계 · 접미 `sum` 은 tooltip/값 라벨에, 눈금은 숫자 그대로 · valueFormat 을 바꿔도 집계값 byte 동일", () => {
    const rows = dateRows(400, (i) => (i % 7) + 1);
    const base = P({ chartType: "bar", color: undefined, showTooltip: true });
    const model = resolveChartModel(rows, base, { size: SIZE, metrics: M });
    expect(model.budget.axisKind).toBe("ordinal");
    expect(model.budget.mode).toBe("aggregate");
    expect(model.budget.B).toBe(model.budget.fitEff);
    // bucket 크기 ceil(n / B) 라 bucket 수는 B 이하 (마지막만 작다)
    const size = Math.ceil(400 / model.budget.fitEff);
    expect(model.transformed.categories).toHaveLength(Math.ceil(400 / size));
    expect(model.transformed.categories.length).toBeLessThanOrEqual(
      model.budget.fitEff,
    );
    expect(model.visible).toBe(model.transformed);
    // 원본 스캔: 첫 bucket 합
    let firstSum = 0;
    for (let i = 0; i < size; i++) firstSum += (i % 7) + 1;
    expect(model.visible.series[0].values.get(0)).toBe(firstSum);
    expect(model.visible.categories[0]).toBe(
      `${rows[0].category} ~ ${rows[size - 1].category}`,
    );
    expect(model.layout.formatValue(12)).toBe("12 sum");
    expect(model.layout.tickText(12)).toBe("12");
    const scene = computeChartScene(base, rows, SIZE);
    expect(scene.tooltip!.bands[0].entries[0].text).toBe(`${firstSum} sum`);
    // valueFormat 변경 → 값 동일, 문자열만 다르다
    const decimal = resolveChartModel(
      rows,
      { ...base, valueFormat: "decimal", valueFractionDigits: 1 },
      { size: SIZE, metrics: M },
    );
    expect([...decimal.visible.series[0].values]).toEqual([
      ...model.visible.series[0].values,
    ]);
    expect(decimal.layout.formatValue(12)).toBe("12.0 sum");
    const mean = resolveChartModel(
      rows,
      { ...base, budgetAggregate: "mean" },
      { size: SIZE, metrics: M },
    );
    expect(mean.visible.series[0].values.get(0)).toBeCloseTo(
      firstSum / size,
      10,
    );
    expect(mean.layout.formatValue(3)).toBe("3 mean");
  });

  it("domain: `[60, 60]` 을 bucket 1 sum → 120 이 domain 안 · expand 는 transformed 위에서 정규화", () => {
    const rows: ChartRow[] = [
      { category: "2024-01-01", value: 60 },
      { category: "2024-01-02", value: 60 },
    ];
    const props = P({
      chartType: "bar",
      color: undefined,
      budgetOverflow: "aggregate",
    });
    // fitEff 1 로 강제: 폭이 딱 한 슬롯
    const narrow = resolveChartModel(rows, props, {
      size: SIZE,
      metrics: { ...M, minSlot: 400 },
    });
    expect(narrow.budget.fitEff).toBe(1);
    expect(values(narrow.transformed, 0)).toEqual([120]);
    expect(narrow.ticks.domain[1]).toBeGreaterThanOrEqual(120);
    // input 눈금 (layout) 은 60 까지 — 두 원천이 갈리는 것을 model.ticks 가 덮는다
    expect(narrow.layout.ticks.domain[1]).toBeLessThan(120);
    const expandRows: ChartRow[] = [
      { category: "2024-01-01", value: 60, series: "A" },
      { category: "2024-01-02", value: 60, series: "A" },
      { category: "2024-01-01", value: 20, series: "B" },
      { category: "2024-01-02", value: 20, series: "B" },
    ];
    const expand = computeChartScene(
      P({
        chartType: "bar",
        stackType: "expand",
        budgetOverflow: "aggregate",
        showTooltip: true,
      }),
      expandRows,
      SIZE,
      { ...M, minSlot: 400 },
    );
    // 집계 (A 120 · B 40) 위에서 expand → 막대 하나가 plot 높이 전부
    const rects = expand.marks.filter((m) => m.kind === "rect") as Array<{
      h: number;
    }>;
    expect(rects).toHaveLength(2);
    expect(rects[0].h + rects[1].h).toBeCloseTo(expand.plot.h, 1);
  });
});

describe("ADR-211 G2 — bucket 극값 선택 (원본 스캔 오라클)", () => {
  // n 100 · S 3: A 평탄 (100 에 index 37 만 130), B spike 위 (index 71 → 500), C 부호 반대 spike (index 12 → −80) + 결측 run (55, 56)
  const n = 100;
  const A = Array.from({ length: n }, (_, i) => (i === 37 ? 130 : 100));
  const B = Array.from({ length: n }, (_, i) =>
    i === 71 ? 500 : 50 + (i % 3),
  );
  const C: Array<number | undefined> = Array.from({ length: n }, (_, i) =>
    i === 55 || i === 56 ? undefined : i === 12 ? -80 : 10 - (i % 5),
  );
  const g = grid(
    Array.from({ length: n }, (_, i) => `c${i}`),
    [A, B, C],
  );
  const argmax = (xs: Array<number | undefined>) =>
    xs.reduce(
      (best, v, i) =>
        v !== undefined && (best < 0 || v > xs[best]!) ? i : best,
      -1,
    );
  const argmin = (xs: Array<number | undefined>) =>
    xs.reduce(
      (best, v, i) =>
        v !== undefined && (best < 0 || v < xs[best]!) ? i : best,
      -1,
    );

  it("시리즈별 전역·bucket max/min index 가 선택 집합에 정확히 있다 · gap sentinel · 점 수 ≤ P", () => {
    const sel = selectExtrema(g, 10, 0, U);
    const set = new Set(sel.indices);
    expect(sel.fallback).toBe(false);
    expect(sel.B).toBe(10);
    for (const s of [A, B, C]) {
      expect(set.has(argmax(s))).toBe(true);
      expect(set.has(argmin(s))).toBe(true);
    }
    expect(set.has(37)).toBe(true);
    expect(set.has(71)).toBe(true);
    expect(set.has(12)).toBe(true);
    // bucket 별 (크기 10) max/min — 원본 스캔
    for (let b = 0; b < 10; b++) {
      for (const s of [A, B, C]) {
        const slice = s.slice(b * 10, b * 10 + 10);
        expect(set.has(b * 10 + argmax(slice))).toBe(true);
        expect(set.has(b * 10 + argmin(slice))).toBe(true);
      }
    }
    // 결측 run (55, 56) 이 있는 bucket [50, 60) → 첫 결측 55 가 선택 (56 은 아님)
    expect(set.has(55)).toBe(true);
    expect(set.has(56)).toBe(false);
    expect(3 * sel.indices.length).toBeLessThanOrEqual(U.pointBudget);
    expect(sel.steps).toEqual([
      {
        B: 10,
        U: sel.indices.length,
        pathPoints: 3 * sel.indices.length,
        marks: 0,
      },
    ]);
  });

  it("모델: 기간 축 line 비누적 → extrema · transformed 는 원본 값 · 결측은 visible 에서도 결측 → 선이 끊긴다", () => {
    const rows: ChartRow[] = [];
    for (let i = 0; i < n; i++) {
      const cat = day(i);
      rows.push({ category: cat, value: A[i], series: "A" });
      rows.push({ category: cat, value: B[i], series: "B" });
      if (C[i] !== undefined)
        rows.push({ category: cat, value: C[i], series: "C" });
    }
    const props = P({ chartType: "line", showTooltip: true });
    // 폭을 좁혀 fitEff 10 근처로 (500 → plot ≈ 440 / 3 = 146 > 100 이라 안 넘친다) → minPointGap 40
    const metrics = { ...M, minPointGap: 40 };
    const model = resolveChartModel(rows, props, { size: SIZE, metrics });
    expect(model.budget.axisKind).toBe("ordinal");
    expect(model.budget.mode).toBe("extrema");
    expect(model.budget.overflow).toBe(true);
    expect(model.budget.B).toBe(model.budget.fitEff);
    expect(model.budget.extremaSteps).toHaveLength(1);
    // transformed 범주 = 선택 index 의 원본 라벨, 값 = 원본
    const cIdx = model.transformed.categories.indexOf(day(37));
    expect(cIdx).toBeGreaterThanOrEqual(0);
    expect(model.transformed.series[0].values.get(cIdx)).toBe(130);
    // 결측 index 55 가 있고 C 값이 없다
    const gapIdx = model.transformed.categories.indexOf(day(55));
    expect(gapIdx).toBeGreaterThanOrEqual(0);
    expect(model.transformed.series[2].values.get(gapIdx)).toBeUndefined();
    // 실제 렌더 점 수 S × |U| × max(1,k) ≤ P
    expect(3 * model.transformed.categories.length).toBeLessThanOrEqual(
      U.pointBudget,
    );
    // domain 은 원본 극값 (500 · −80) 그대로
    expect(model.ticks.domain[1]).toBeGreaterThanOrEqual(500);
    expect(model.ticks.domain[0]).toBeLessThanOrEqual(-80);
    // scene: C 의 선이 gap 에서 끊긴다 (subpath ≥ 2), DOM 모델의 rows 도 그 자리가 null
    const scene = computeChartScene(props, rows, SIZE, metrics);
    const cPath = scene.marks.find(
      (m) => m.kind === "path" && m.strokeSeries === 2,
    ) as { d: string };
    expect((cPath.d.match(/M /g) ?? []).length).toBeGreaterThanOrEqual(2);
    const dom = resolveChartData(rows, props, 8, { size: SIZE, metrics });
    expect(dom.rows[gapIdx].series2).toBeNull();
    expect(dom.rows).toHaveLength(model.transformed.categories.length);
  });

  it("적응 B: 겹치지 않는 극값 S 8 · fitEff 250 → 점 8×|U| > P 5,000 → B 반감 단계 기록 · 단조 감소", () => {
    const N = 4000;
    // 시리즈마다 다른 위상의 톱니 — 한 bucket 안에서 min/max 자리가 시리즈끼리 겹치지 않는다
    const series = Array.from({ length: 8 }, (_, si) =>
      Array.from({ length: N }, (_, i) => (i + si * 2) % 16),
    );
    const g8 = grid(
      Array.from({ length: N }, (_, i) => `c${i}`),
      series,
    );
    const sel = selectExtrema(g8, 250, 0, U);
    expect(sel.fallback).toBe(false);
    expect(sel.steps.length).toBeGreaterThan(1);
    expect(sel.steps[0].B).toBe(250);
    expect(sel.steps[0].pathPoints).toBeGreaterThan(U.pointBudget);
    for (let i = 1; i < sel.steps.length; i++) {
      expect(sel.steps[i].B).toBe(Math.ceil(sel.steps[i - 1].B / 2));
      expect(sel.steps[i].U).toBeLessThanOrEqual(sel.steps[i - 1].U);
    }
    expect(8 * sel.indices.length).toBeLessThanOrEqual(U.pointBudget);
    // 전역 max/min 은 어느 B 에서도 보존
    for (const s of series) {
      expect(sel.indices.includes(argmax(s))).toBe(true);
      expect(sel.indices.includes(argmin(s))).toBe(true);
    }
  });

  it("fallback: S 26 · dots (k 1) → B 1 에서도 26×|U| > M 800 → `too-many-series` + 집계", () => {
    const N = 90;
    const series = Array.from({ length: 26 }, (_, si) =>
      Array.from({ length: N }, (_, i): number | undefined =>
        i === si * 3
          ? 100
          : i === si * 3 + 1
            ? -100
            : i === si * 3 + 2
              ? undefined
              : 0,
      ),
    );
    const g26 = grid(
      Array.from({ length: N }, (_, i) => `c${i}`),
      series,
    );
    const sel = selectExtrema(g26, 45, 1, U);
    expect(sel.fallback).toBe(true);
    expect(sel.B).toBe(1);
    expect(sel.steps[sel.steps.length - 1].U).toBe(78); // 26 × (max + min + gap)
    // 모델 경로: 26 시리즈 line + dots, 기간 축
    const rows: ChartRow[] = [];
    for (let i = 0; i < N; i++)
      for (let si = 0; si < 26; si++) {
        const v = series[si][i];
        if (v !== undefined)
          rows.push({ category: day(i), value: v, series: `s${si}` });
      }
    const model = resolveChartModel(
      rows,
      P({ chartType: "line", showDots: true }),
      {
        size: SIZE,
        metrics: { ...M, minPointGap: 9 },
      },
    );
    expect(model.budget.mode).toBe("extrema");
    expect(model.diagnostics.map((d) => d.code)).toContain(
      "budget.tooManySeries",
    );
    expect(model.budget.B).toBe(model.budget.fitEff);
    expect(model.budget.applied).toBe("aggregate");
    expect(model.transformed.categories[0]).toContain(" ~ ");
    // fallback 도 집계다 — 접미가 붙는다 (판독 HIGH 수리)
    expect(model.layout.formatValue(12)).toBe("12 sum");
  });

  it('bucket 라벨: 결측 "" 이 경계에 오면 비어 있지 않은 첫/끝 라벨', () => {
    expect(bucketLabel(["", "b", "c"], 0, 3)).toBe("b ~ c");
    expect(bucketLabel(["a", "b", ""], 0, 3)).toBe("a ~ b");
    expect(bucketLabel(["", "b", ""], 0, 3)).toBe("b");
    expect(bucketLabel(["", ""], 0, 2)).toBe("");
    expect(bucketLabel(["", "b"], 0, 1)).toBe("");
  });
});

describe("ADR-211 G2 — others (ranking 손계산 · 부호 · 공존 · domain)", () => {
  // A(3,−4)=7 · B(1,1)=2 · C(0,5)=5 · D(2,2)=4 · Other(1,0)=1 (원본 라벨 "Other")
  const g = grid(
    ["A", "B", "C", "D", "Other"],
    [
      [3, 1, 0, 2, 1],
      [-4, 1, 5, 2, 0],
    ],
  );

  it("ranking key Σ|v| → [A, C, D, B, Other] · fitEff 3 → A, C + synthetic (시리즈별 sum, 원본 부호)", () => {
    const out = groupOthers(g, 3, "Other");
    expect(out.ranking).toEqual([0, 2, 3, 1, 4]);
    expect(out.categories).toEqual(["A", "C", "Other"]);
    expect(out.othersIndex).toBe(2);
    expect(values(out, 0)).toEqual([3, 0, 1 + 2 + 1]);
    expect(values(out, 1)).toEqual([-4, 5, 1 + 2 + 0]);
  });

  it('원본 "Other" 라벨과 synthetic 이 공존한다 (fitEff 5 면 묶지 않고, 4 면 원본 Other 가 묶인다)', () => {
    expect(groupOthers(g, 5, "Other").othersIndex).toBeNull();
    const out = groupOthers(g, 4, "Other");
    expect(out.categories).toEqual(["A", "C", "D", "Other"]);
    expect(values(out, 0)).toEqual([3, 0, 2, 1 + 1]); // B + 원본 Other
    expect(categoryColorIndex(3, 8, out.othersIndex)).toBe(
      CHART_OTHERS_COLOR_INDEX,
    );
    expect(categoryColorIndex(1, 8, out.othersIndex)).toBe(1);
    // fitEff 1 → others 없이 상위 1개
    const one = groupOthers(g, 1, "Other");
    expect(one.categories).toEqual(["A"]);
    expect(one.othersIndex).toBeNull();
  });

  it("pie: 40 조각 · 반지름 작음 → others 1 · `+10/−10` 은 면적 0 (조각 없음) · `+10/−30` 은 면적 20 + tooltip −20", () => {
    const rows: ChartRow[] = Array.from({ length: 40 }, (_, i) => ({
      category: `c${i}`,
      value: 100 - i,
    }));
    const props = P({
      chartType: "pie",
      color: undefined,
      showTooltip: true,
      showLegend: true,
    });
    const size = { width: 80, height: 80 };
    const model = resolveChartModel(rows, props, { size, metrics: M });
    expect(model.budget.mode).toBe("others");
    expect(model.budget.overflow).toBe(true);
    expect(model.transformed.categories).toHaveLength(model.budget.fitEff);
    expect(model.transformed.othersIndex).toBe(model.budget.fitEff - 1);
    expect(model.transformed.categories[model.budget.fitEff - 1]).toBe(
      CHART_OTHERS_LABEL,
    );
    // others 합 = 묶인 원본 합 (원본 스캔: 상위 fitEff−1 을 뺀 나머지)
    const sorted = rows.map((r) => r.value as number).sort((a, b) => b - a);
    const rest = sorted
      .slice(model.budget.fitEff - 1)
      .reduce((a, b) => a + b, 0);
    expect(
      model.transformed.series[0].values.get(model.budget.fitEff - 1),
    ).toBe(rest);
    const scene = computeChartScene(props, rows, size);
    const slices = scene.marks.filter(
      (m) => m.kind === "path" && m.fillSeries !== undefined,
    );
    expect(slices).toHaveLength(model.budget.fitEff);
    expect(
      (slices[slices.length - 1] as { fillSeries: number }).fillSeries,
    ).toBe(CHART_OTHERS_COLOR_INDEX);
    // 범례는 transformed 범주 (others 포함), 범례 상자는 예약 자리 안
    expect(scene.legend!.items).toHaveLength(model.budget.fitEff);
    expect(
      scene.legend!.items[model.budget.fitEff - 1].swatch.seriesIndex,
    ).toBe(CHART_OTHERS_COLOR_INDEX);
    expect(scene.legend!.items[model.budget.fitEff - 1].text.text).toBe(
      CHART_OTHERS_LABEL,
    );
    // 부호 상쇄
    const cancel: ChartRow[] = [
      { category: "big", value: 1000 },
      { category: "p", value: 10 },
      { category: "m", value: -10 },
    ];
    const noLegend = { ...props, showLegend: false };
    const tiny = { ...M, minArc: 80 }; // r 28 → 둘레 176 / 80 → fitEff 2 → big + others(p, m)
    const cancelled = resolveChartModel(cancel, noLegend, {
      size,
      metrics: tiny,
    });
    expect(cancelled.budget.fitEff).toBe(2);
    expect(values(cancelled.transformed, 0)).toEqual([1000, 0]);
    const cancelScene = computeChartScene(noLegend, cancel, size, tiny);
    expect(
      cancelScene.marks.filter(
        (m) => m.kind === "path" && m.fillSeries !== undefined,
      ),
    ).toHaveLength(1);
    const skew = resolveChartModel(
      [cancel[0], cancel[1], { category: "m", value: -30 }],
      noLegend,
      { size, metrics: tiny },
    );
    expect(values(skew.transformed, 0)).toEqual([1000, -20]);
    const skewScene = computeChartScene(
      noLegend,
      [cancel[0], cancel[1], { category: "m", value: -30 }],
      size,
      tiny,
    );
    expect(
      skewScene.tooltip!.bands.map((b) => [b.label, b.entries[0].text]),
    ).toEqual([
      ["big", "1,000"],
      [CHART_OTHERS_LABEL, "-20"],
    ]);
    // 사용자 라벨
    const ko = resolveChartModel(
      rows,
      { ...props, budgetOthersLabel: "기타" },
      { size, metrics: M },
    );
    expect(ko.transformed.categories[ko.budget.fitEff - 1]).toBe("기타");
  });

  it("radial: others 뒤 domain 은 합산값을 담는다 · 링 = fitEff", () => {
    const rows: ChartRow[] = Array.from({ length: 30 }, (_, i) => ({
      category: `c${i}`,
      value: 10,
    }));
    const props = P({ chartType: "radial", color: undefined });
    const model = resolveChartModel(rows, props, {
      size: { width: 200, height: 200 },
      metrics: M,
    });
    expect(model.budget.mode).toBe("others");
    expect(model.budget.overflow).toBe(true);
    const othersSum = 10 * (30 - (model.budget.fitEff - 1));
    expect(
      model.transformed.series[0].values.get(model.budget.fitEff - 1),
    ).toBe(othersSum);
    expect(model.ticks.domain[1]).toBeGreaterThanOrEqual(othersSum);
    expect(model.layout.ticks.domain[1]).toBeLessThan(othersSum);
  });

  it("radar: 축 others — 스포크 fitEff 개, 마지막 축 라벨 Other", () => {
    const rows: ChartRow[] = Array.from({ length: 50 }, (_, i) => ({
      category: `k${i}`,
      value: i + 1,
    }));
    const scene = computeChartScene(
      P({ chartType: "radar", color: undefined }),
      rows,
      { width: 200, height: 200 },
    );
    const model = resolveChartModel(
      rows,
      P({ chartType: "radar", color: undefined }),
      { size: { width: 200, height: 200 }, metrics: M },
    );
    const angular = scene.axes.find((a) => a.axis === "angular")!;
    expect(angular.grid).toHaveLength(model.budget.fitEff);
    expect(model.transformed.categories[model.budget.fitEff - 1]).toBe(
      CHART_OTHERS_LABEL,
    );
  });

  it("pie 링 (누적 시리즈 30) × 조각: fitEff 의 M 항이 조각을 먼저 깎아 `S × 조각 ≤ M` 이 항상 성립한다", () => {
    const rows: ChartRow[] = [];
    for (let ci = 0; ci < 40; ci++)
      for (let si = 0; si < 30; si++)
        rows.push({ category: `c${ci}`, value: 1 + ci, series: `s${si}` });
    const props = P({ chartType: "pie", stackType: "stacked" });
    const model = resolveChartModel(rows, props, {
      size: { width: 400, height: 400 },
      metrics: M,
    });
    // 둘레는 40 조각을 담지만 (fit ≥ 40) M 800 / 30 링 → fitEff 26 → others
    expect(model.budget.fit).toBeGreaterThanOrEqual(40);
    expect(model.budget.fitEff).toBe(Math.floor(U.markBudget / 30));
    expect(model.budget.mode).toBe("others");
    expect(model.transformed.categories).toHaveLength(model.budget.fitEff);
    expect(model.transformed.series).toHaveLength(30);
    expect(30 * model.transformed.categories.length).toBeLessThanOrEqual(
      U.markBudget,
    );
    expect(model.diagnostics).toEqual([]);
    // 링 상한 (`too-many-series`) 은 fitEff 가 M 항 없이 왔을 때의 방어선 — applyBudget 단독 호출로 확인
    const forced = resolveDisplayBudget({
      kind: "pie",
      geometry: {
        plot: { x: 0, y: 0, w: 400, h: 400 },
        horizontal: false,
        radius: { outer: 180, inner: 0 },
      },
      series: 30,
      stacked: true,
      n: 40,
      k: 1,
      metrics: { ...U, markBudget: Number.MAX_SAFE_INTEGER },
      axisKind: "category",
    });
    const capped = applyBudget(model.input, forced, {
      kind: "pie",
      stacked: true,
      othersLabel: "Other",
      metrics: U,
    });
    expect(capped.transformed.series).toHaveLength(
      Math.floor(U.markBudget / 40),
    );
    expect(capped.budget.diagnostics.map((d) => d.code)).toEqual([
      "budget.tooManySeries",
    ]);
  });
});

describe("ADR-211 G2 — `--chart-others` 두 leg", () => {
  it("Skia: others 조각의 fill = rule `chart.others` 토큰 · DOM: `seriesVar(−1)` = `var(--chart-others)`", async () => {
    const rows: ChartRow[] = Array.from({ length: 40 }, (_, i) => ({
      category: `c${i}`,
      value: 100 - i,
    }));
    const shapes = SKIA_PRIMITIVES.chart_scene!({
      props: {
        ...P({ chartType: "pie", color: undefined }),
        data: rows,
        _containerWidth: 80,
        _containerHeight: 80,
        _chartRule: {
          series: ["{color.a}", "{color.b}"],
          axis: "{color.axis}",
          grid: "{color.grid}",
          others: "{color.others-test}",
        },
      },
      size: { height: 80 } as never,
      visual: undefined,
      paint: {
        backgroundColor: "{color.layer-1}",
        color: "{color.neutral}",
        borderColor: "{color.border}",
        backgroundAlpha: 1,
        staticTrackWash: false,
        hasVisibleBoxPaint: true,
        hasOpaqueCatalogBackground: true,
      } as never,
      style: undefined,
    }) as Array<{ fill?: string }>;
    expect(shapes.some((s) => s.fill === "{color.others-test}")).toBe(true);
    const { seriesVar } =
      await import("../../../../shared/src/components/chart/svgDecorations");
    expect(seriesVar(CHART_OTHERS_COLOR_INDEX)).toBe(
      "var(--chart-others, currentColor)",
    );
  });

  it("행 격자 유틸: buildSeriesGrid 는 othersIndex 를 갖지 않는다 (input 층)", () => {
    const g = buildSeriesGrid(
      [{ category: "a", value: 1 }],
      P({ color: undefined }),
      8,
    );
    expect(g.othersIndex).toBeUndefined();
  });
});
