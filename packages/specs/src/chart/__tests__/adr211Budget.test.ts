/**
 * ADR-211 P1 (G1) — 표시 예산 손계산 오라클 · 창 0 정적 모델 · 행 상한 `R` · 두 leg byte 동일.
 *
 * **오라클은 표가 먼저다** (breakdown §5, 측정 5-질문 Q5 독립성): 아래 `FIT_ORACLE` 은 사람이
 * 계산한 값이고 테스트는 표를 읽는다. 구현을 보고 기대값을 적지 않는다.
 *
 * - 슬롯 `fit` = floor(예산 축 / 최소 단위). bar 묶음은 `minSlot × S`, 누적은 `minSlot`.
 * - `fitEff = min(fit, floor(M / (S × k)), floor(P / S))` — `M` 항은 `k > 0` 만, `P` 항은 line/area 만.
 * - P0 확정값: minSlot 8 · minPointGap 3 · minArc 5 · minAxisGap 12 · minRing 5 · M 800 · P 5,000 · R 20,000.
 */
import { describe, expect, it } from "vitest";
import {
  CHART_BUDGET_DEFAULTS,
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
  applyWindow,
  capRows,
  clampWindowStart,
  computeChartScene,
  mergeBudgetMetrics,
  resolveChartData,
  resolveChartModel,
  resolveDisplayBudget,
  resolveFitEff,
  slotFit,
} from "../index";
import type {
  ChartBudgetGeometry,
  ChartMetrics,
  ChartProps,
  ChartRow,
  ChartType,
} from "../index";

const U = CHART_BUDGET_DEFAULTS;
const plot = (w: number, h = 200) => ({ x: 0, y: 0, w, h });

/** 손계산 표 — breakdown §5 첫 항목 + 방향·sweep·M/P 반례. */
const FIT_ORACLE: Array<{
  name: string;
  kind: ChartType;
  geometry: ChartBudgetGeometry;
  S: number;
  stacked: boolean;
  k: number;
  fit: number;
  fitEff: number;
}> = [
  // 폭 500 · minSlot 8 → 500 / 8 = 62.5 → 62
  {
    name: "bar W500 S1",
    kind: "bar",
    geometry: { plot: plot(500), horizontal: false },
    S: 1,
    stacked: false,
    k: 1,
    fit: 62,
    fitEff: 62,
  },
  // 묶음 S3 → 500 / 24 = 20.8 → 20
  {
    name: "bar W500 S3 dodged",
    kind: "bar",
    geometry: { plot: plot(500), horizontal: false },
    S: 3,
    stacked: false,
    k: 1,
    fit: 20,
    fitEff: 20,
  },
  // 누적 S3 → 62; M 800 / (3 × 1) = 266 → fitEff 62
  {
    name: "bar W500 S3 stacked",
    kind: "bar",
    geometry: { plot: plot(500), horizontal: false },
    S: 3,
    stacked: true,
    k: 1,
    fit: 62,
    fitEff: 62,
  },
  // 폭 4 → 0 (진단)
  {
    name: "bar W4",
    kind: "bar",
    geometry: { plot: plot(4), horizontal: false },
    S: 1,
    stacked: false,
    k: 1,
    fit: 0,
    fitEff: 0,
  },
  // 수평 bar 는 plot.h 가 예산 축: h 300 → 300 / 8 = 37.5 → 37 (폭 500 은 무관)
  {
    name: "bar horizontal H300",
    kind: "bar",
    geometry: { plot: plot(500, 300), horizontal: true },
    S: 1,
    stacked: false,
    k: 1,
    fit: 37,
    fitEff: 37,
  },
  // bar S8 · 값 라벨 (k 2) · 폭 2,000 → fit 2000/64 = 31; M 800 / 16 = 50 → 31
  {
    name: "bar W2000 S8 labels",
    kind: "bar",
    geometry: { plot: plot(2000), horizontal: false },
    S: 8,
    stacked: false,
    k: 2,
    fit: 31,
    fitEff: 31,
  },
  // bar 누적 S8 · k 2 · 폭 2,000 → fit 250; M 800 / 16 = 50 → **50** (마크 예산이 깎는다)
  {
    name: "bar W2000 S8 stacked labels",
    kind: "bar",
    geometry: { plot: plot(2000), horizontal: false },
    S: 8,
    stacked: true,
    k: 2,
    fit: 250,
    fitEff: 50,
  },
  // line 폭 500 · minPointGap 3 → 166.6 → 166; P 5,000 / 1 → 166
  {
    name: "line W500",
    kind: "line",
    geometry: { plot: plot(500), horizontal: false },
    S: 1,
    stacked: false,
    k: 0,
    fit: 166,
    fitEff: 166,
  },
  // line 폭 2,000 · S 4 · k 0 → fit 666; P 5,000 / 4 = 1,250 → 666 (M 항 없음)
  {
    name: "line W2000 S4",
    kind: "line",
    geometry: { plot: plot(2000), horizontal: false },
    S: 4,
    stacked: false,
    k: 0,
    fit: 666,
    fitEff: 666,
  },
  // line 폭 6,000 · S 4 · k 0 → fit 2,000; P 5,000 / 4 = 1,250 → **1,250** (점 예산이 깎는다)
  {
    name: "line W6000 S4",
    kind: "line",
    geometry: { plot: plot(6000), horizontal: false },
    S: 4,
    stacked: false,
    k: 0,
    fit: 2000,
    fitEff: 1250,
  },
  // line 폭 2,000 · S 4 · dots (k 1) → fit 666; M 800 / 4 = 200 → **200**
  {
    name: "line W2000 S4 dots",
    kind: "line",
    geometry: { plot: plot(2000), horizontal: false },
    S: 4,
    stacked: false,
    k: 1,
    fit: 666,
    fitEff: 200,
  },
  // area 는 line 과 같은 축
  {
    name: "area W500",
    kind: "area",
    geometry: { plot: plot(500), horizontal: false },
    S: 1,
    stacked: false,
    k: 0,
    fit: 166,
    fitEff: 166,
  },
  // pie 반지름 60 → 둘레 376.99 / minArc 5 = 75.4 → 75 (링 수 S 와 무관)
  {
    name: "pie r60",
    kind: "pie",
    geometry: {
      plot: plot(200),
      horizontal: false,
      radius: { outer: 60, inner: 0 },
    },
    S: 1,
    stacked: false,
    k: 1,
    fit: 75,
    fitEff: 75,
  },
  {
    name: "pie r60 S3 rings",
    kind: "pie",
    geometry: {
      plot: plot(200),
      horizontal: false,
      radius: { outer: 60, inner: 30 },
    },
    S: 3,
    stacked: true,
    k: 1,
    fit: 75,
    fitEff: 75,
  },
  // radar 반지름 60 → 376.99 / minAxisGap 12 = 31.4 → 31
  {
    name: "radar r60",
    kind: "radar",
    geometry: {
      plot: plot(200),
      horizontal: false,
      radius: { outer: 60, inner: 0 },
    },
    S: 1,
    stacked: false,
    k: 1,
    fit: 31,
    fitEff: 31,
  },
  // radial 반지름 60 · inner 0 · minRing 5 → 12
  {
    name: "radial r60",
    kind: "radial",
    geometry: {
      plot: plot(200),
      horizontal: false,
      radius: { outer: 60, inner: 0 },
    },
    S: 1,
    stacked: false,
    k: 1,
    fit: 12,
    fitEff: 12,
  },
  // radial inner 30 → (60 − 30) / 5 = 6; sweep 180 은 링 두께와 무관
  {
    name: "radial r60 inner30 sweep180",
    kind: "radial",
    geometry: {
      plot: plot(200),
      horizontal: false,
      radius: { outer: 60, inner: 30 },
      sweep: 180,
    },
    S: 1,
    stacked: false,
    k: 1,
    fit: 6,
    fitEff: 6,
  },
  // pie sweep 은 항상 360 이지만 기하가 sweep 180 을 받으면 둘레 반 → 188.49 / 5 = 37
  {
    name: "pie r60 sweep180",
    kind: "pie",
    geometry: {
      plot: plot(200),
      horizontal: false,
      radius: { outer: 60, inner: 0 },
      sweep: 180,
    },
    S: 1,
    stacked: false,
    k: 1,
    fit: 37,
    fitEff: 37,
  },
];

describe("ADR-211 G1 — 손계산 오라클 (fit · fitEff)", () => {
  for (const row of FIT_ORACLE) {
    it(`${row.name} → fit ${row.fit} · fitEff ${row.fitEff}`, () => {
      const fit = slotFit(row.kind, row.geometry, row.S, row.stacked, U);
      expect(fit).toBe(row.fit);
      expect(resolveFitEff(row.kind, fit, row.S, row.k, U)).toBe(row.fitEff);
    });
  }

  it("P0 확정값이 기본 metrics 에 그대로 실린다 (rule 채널 없을 때)", () => {
    expect(CHART_DEFAULT_METRICS).toMatchObject({
      minSlot: 8,
      minPointGap: 3,
      minArc: 5,
      minAxisGap: 12,
      minRing: 5,
      markBudget: 800,
      pointBudget: 5000,
      rowCap: 20000,
      windowTrackHeight: 24,
    });
  });
});

describe("ADR-211 G1 — 창 clamp · 진단", () => {
  it("clamp: 마지막 창은 n − fitEff 에서 시작한다 (창 길이 불변)", () => {
    expect(clampWindowStart(5000, 1000, 62)).toBe(938);
    expect(clampWindowStart(-3, 1000, 62)).toBe(0);
    expect(clampWindowStart(10, 50, 62)).toBe(0);
    expect(clampWindowStart(Number.NaN, 1000, 62)).toBe(0);
    expect(clampWindowStart(7.9, 1000, 62)).toBe(7);
  });

  it("fitEff 0 + n > 0 → `budget.plotTooSmall` warning · 창 [0, 0)", () => {
    const budget = resolveDisplayBudget({
      kind: "bar",
      geometry: { plot: plot(4), horizontal: false },
      series: 1,
      stacked: false,
      n: 10,
      k: 1,
      metrics: U,
    });
    expect(budget.fitEff).toBe(0);
    expect(budget.window).toEqual({ start: 0, end: 0 });
    expect(budget.diagnostics.map((d) => [d.code, d.severity])).toEqual([
      ["budget.plotTooSmall", "warning"],
    ]);
  });

  it("n 0 이면 fit 0 이어도 진단이 없다 (데이터 없음은 empty 경로)", () => {
    const budget = resolveDisplayBudget({
      kind: "bar",
      geometry: { plot: plot(4), horizontal: false },
      series: 1,
      stacked: false,
      n: 0,
      k: 1,
      metrics: U,
    });
    expect(budget.diagnostics).toEqual([]);
    expect(budget.overflow).toBe(false);
  });

  it("auto 는 bar/line/area → window, pie/radar/radial → others; 명시는 그대로", () => {
    const mode = (kind: ChartType, overflow?: ChartProps["budgetOverflow"]) =>
      resolveDisplayBudget({
        kind,
        geometry: {
          plot: plot(500),
          horizontal: false,
          radius: { outer: 60, inner: 0 },
        },
        series: 1,
        stacked: false,
        n: 3,
        k: 1,
        metrics: U,
        overflow,
      }).mode;
    expect(mode("bar")).toBe("window");
    expect(mode("line")).toBe("window");
    expect(mode("area")).toBe("window");
    expect(mode("pie")).toBe("others");
    expect(mode("radar")).toBe("others");
    expect(mode("radial")).toBe("others");
    expect(mode("bar", "auto")).toBe("window");
    expect(mode("bar", "others")).toBe("others");
  });

  it("applyWindow 는 범주 index 를 0 부터 다시 매기고 시리즈 identity 는 유지한다", () => {
    const grid = {
      categories: ["a", "b", "c", "d", "e"],
      series: [
        {
          key: "s",
          id: "s",
          seriesIndex: 3,
          values: new Map([
            [0, 1],
            [2, 3],
            [4, 5],
          ]),
        },
      ],
      hasValues: true,
    };
    const visible = applyWindow(grid, { start: 2, end: 5 });
    expect(visible.categories).toEqual(["c", "d", "e"]);
    expect([...visible.series[0].values]).toEqual([
      [0, 3],
      [2, 5],
    ]);
    expect(visible.series[0].seriesIndex).toBe(3);
    // 창이 전체면 같은 객체 (복사 0)
    expect(applyWindow(grid, { start: 0, end: 5 })).toBe(grid);
  });

  it("capRows: R 초과면 앞 R 행 + `budget.rowsTruncated`, 이하면 같은 배열", () => {
    const rows = Array.from({ length: 20001 }, (_, i) => ({ i }));
    const capped = capRows(rows, U.rowCap);
    expect(capped.rows).toHaveLength(20000);
    expect(capped.rows[0]).toBe(rows[0]);
    expect(capped.diagnostic?.code).toBe("budget.rowsTruncated");
    expect(capped.diagnostic?.value).toBe("20001");
    const same = rows.slice(0, 20000);
    expect(capRows(same, U.rowCap).rows).toBe(same);
    expect(capRows(same, U.rowCap).diagnostic).toBeNull();
  });
});

// ── 실제 scene · 모델 ─────────────────────────────────────────────────────
const SIZE = { width: 500, height: 300 };
const bar = (overrides: Partial<ChartProps> = {}): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  ...overrides,
});
/** n 범주 × S 시리즈, 값 = 범주 index + 시리즈 offset — 마지막 범주가 전역 최대. */
function wideRows(n: number, S = 1): ChartRow[] {
  const out: ChartRow[] = [];
  for (let ci = 0; ci < n; ci++)
    for (let si = 0; si < S; si++)
      out.push({ category: `c${ci}`, value: ci + si * 0.5, series: `s${si}` });
  return out;
}

describe("ADR-211 G1 — 창 0 정적 (bar 1,000 범주)", () => {
  const rows = wideRows(1000);
  const props = bar({ showTooltip: true });

  it("visible 은 앞 fitEff 범주, domain 은 transformed(=input) 전체", () => {
    const model = resolveChartModel(rows, props, {
      size: SIZE,
      metrics: CHART_DEFAULT_METRICS,
      windowStart: 0,
    });
    // fit 은 plot.w 에서 — 손계산: plot.w / 8 내림 (plot 은 layout 이 정한다).
    const expectedFit = Math.floor(model.layout.plot.w / 8);
    expect(model.budget.fit).toBe(expectedFit);
    expect(model.budget.fitEff).toBe(expectedFit);
    expect(model.budget.overflow).toBe(true);
    expect(model.budget.window).toEqual({ start: 0, end: expectedFit });
    expect(model.visible.categories).toEqual(
      rows.slice(0, expectedFit).map((r) => r.category),
    );
    expect(model.transformed).toBe(model.input);
    // 값 축은 전체 최대 999 를 담는다 (창 밖 값) — 창을 옮겨도 축이 흔들리지 않는다.
    expect(model.layout.ticks.domain[1]).toBeGreaterThanOrEqual(999);
    expect(model.diagnostics).toEqual([]);
  });

  it("scene 은 fitEff 개 막대만 그리고 축 tick 은 visible 범주 안이다", () => {
    const scene = computeChartScene(props, rows, SIZE);
    const model = resolveChartModel(rows, props, {
      size: SIZE,
      metrics: CHART_DEFAULT_METRICS,
      windowStart: 0,
    });
    const rects = scene.marks.filter((m) => m.kind === "rect");
    expect(rects).toHaveLength(model.budget.fitEff);
    const visible = new Set(model.visible.categories);
    const xTicks = scene.axes
      .find((a) => a.axis === "x")!
      .ticks.map((t) => t.text);
    expect(xTicks.length).toBeGreaterThan(0);
    for (const t of xTicks) expect(visible.has(t)).toBe(true);
    // 창은 진단이 아니다 (정상 동작).
    expect(scene.diagnostics).toBeUndefined();
    expect(scene.empty).toBe(false);
  });

  it("두 leg byte 동일 — Canvas scene 의 tooltip 범주·값 = Recharts 모델 visible rows", () => {
    const scene = computeChartScene(props, rows, SIZE);
    const dom = resolveChartData(
      rows,
      props,
      CHART_DEFAULT_METRICS.seriesCount,
      {
        size: SIZE,
        metrics: CHART_DEFAULT_METRICS,
        windowStart: 0,
      },
    );
    const canvas = scene.tooltip!.bands.map((b) => [
      b.label,
      b.entries.map((e) => e.text),
    ]);
    const preview = dom.rows.map((r) => [r.category, [String(r.series0)]]);
    expect(JSON.stringify(canvas)).toBe(JSON.stringify(preview));
    expect(dom.rows).toHaveLength(dom.budget.fitEff);
    // DOM leg 의 layout 은 Canvas 와 같은 input 격자에서 나온다 — plot 이 같다.
    expect(dom.layout.plot).toEqual(scene.plot);
    // 값 축 domain: runtime (transformed) = layout (input) = Canvas y 축 눈금 — 창 밖 최대 999 포함.
    expect(dom.ticks.domain).toEqual(dom.layout.ticks.domain);
    const yTicks = scene.axes
      .find((a) => a.axis === "y")!
      .ticks.map((t) => t.text);
    expect(yTicks).toEqual(dom.ticks.ticks.map((t) => dom.layout.tickText(t)));
  });

  it("크기가 다르면 (Compare Mode 반폭) fitEff 도 다르다 — 각 leg 는 자기 크기의 손계산", () => {
    const half = resolveChartModel(rows, props, {
      size: { width: 250, height: 300 },
      metrics: CHART_DEFAULT_METRICS,
    });
    const full = resolveChartModel(rows, props, {
      size: SIZE,
      metrics: CHART_DEFAULT_METRICS,
    });
    expect(half.budget.fitEff).toBe(Math.floor(half.layout.plot.w / 8));
    expect(half.budget.fitEff).toBeLessThan(full.budget.fitEff);
  });

  it("S 4 묶음 line 은 P 가 아니라 fit 이 잡는다 (폭 500 → 166 > 1,250 아님) · dots 면 M 200", () => {
    const rows4 = wideRows(1000, 4);
    const line = resolveChartModel(
      rows4,
      bar({ chartType: "line", color: "series" }),
      { size: SIZE, metrics: CHART_DEFAULT_METRICS },
    );
    expect(line.budget.k).toBe(0);
    expect(line.budget.fitEff).toBe(Math.floor(line.layout.plot.w / 3));
    const dots = resolveChartModel(
      rows4,
      bar({ chartType: "line", color: "series", showDots: true }),
      { size: { width: 3000, height: 300 }, metrics: CHART_DEFAULT_METRICS },
    );
    expect(dots.budget.k).toBe(1);
    expect(dots.budget.fitEff).toBe(200);
  });
});

describe("ADR-211 G1 — 행 상한 R (두 leg 동일)", () => {
  // 20,050 행 · 범주 10 · 값 1 → 앞 20,000 행만: 범주마다 2,000 (전체면 2,005)
  const rows: ChartRow[] = Array.from({ length: 20050 }, (_, i) => ({
    category: `c${i % 10}`,
    value: 1,
  }));
  const props = bar({ showTooltip: true });

  it("scene: 앞 R 행 합산 + `budget.rowsTruncated` warning (empty 아님)", () => {
    const scene = computeChartScene(props, rows, SIZE);
    expect(scene.empty).toBe(false);
    expect(scene.diagnostics?.map((d) => d.code)).toEqual([
      "budget.rowsTruncated",
    ]);
    const sums = scene.tooltip!.bands.map((b) => b.entries[0].text);
    expect(sums).toEqual(Array(10).fill("2,000"));
  });

  it("DOM 모델도 같은 R — sourceRowCount 는 원본 20,050", () => {
    const dom = resolveChartData(rows, props, 8, {
      size: SIZE,
      metrics: CHART_DEFAULT_METRICS,
    });
    expect(dom.rows.map((r) => r.series0)).toEqual(Array(10).fill(2000));
    expect(dom.sourceRowCount).toBe(20050);
    expect(dom.diagnostics.map((d) => d.code)).toEqual([
      "budget.rowsTruncated",
    ]);
  });

  it("(A) 행 > 200 — Canvas 합계가 전체 행 합계다 (구 200행 샘플이면 20 이었을 값이 500)", () => {
    const rows5k: ChartRow[] = Array.from({ length: 5000 }, (_, i) => ({
      category: `c${i % 10}`,
      value: 1,
    }));
    const scene = computeChartScene(props, rows5k, SIZE);
    expect(scene.tooltip!.bands.map((b) => b.entries[0].text)).toEqual(
      Array(10).fill("500"),
    );
    expect(scene.diagnostics).toBeUndefined();
  });
});

describe("ADR-211 G1 — byte 동일 집합 회귀 (행 ≤ 200 · 범주 ≤ fitEff · 마크 ≤ M)", () => {
  const unbounded: ChartMetrics = {
    ...CHART_DEFAULT_METRICS,
    minSlot: 0.001,
    minPointGap: 0.001,
    minArc: 0.001,
    minAxisGap: 0.001,
    minRing: 0.001,
    markBudget: Number.MAX_SAFE_INTEGER,
    pointBudget: Number.MAX_SAFE_INTEGER,
    rowCap: Number.MAX_SAFE_INTEGER,
  };
  const rows: ChartRow[] = [
    { category: "Mon", value: 12, series: "A" },
    { category: "Tue", value: 30, series: "A" },
    { category: "Wed", value: 18, series: "A" },
    { category: "Mon", value: 20, series: "B" },
    { category: "Tue", value: 8, series: "B" },
    { category: "Wed", value: 25, series: "B" },
  ];
  const cases: Array<[string, Partial<ChartProps>]> = [
    ["bar dodged", { chartType: "bar", color: "series" }],
    [
      "bar stacked labels",
      {
        chartType: "bar",
        color: "series",
        stackType: "stacked",
        showValueLabels: true,
      },
    ],
    [
      "line horizontal",
      {
        chartType: "line",
        color: "series",
        orientation: "horizontal",
        showDots: true,
      },
    ],
    [
      "area expand",
      { chartType: "area", color: "series", stackType: "expand" },
    ],
    ["pie", { chartType: "pie", color: "series", showLegend: true }],
    ["radar", { chartType: "radar", color: "series" }],
    [
      "radial",
      { chartType: "radial", color: "series", startAngle: 0, endAngle: 180 },
    ],
  ];
  for (const [name, overrides] of cases) {
    it(`${name} — 예산이 있어도 없어도 scene 이 byte 동일하다`, () => {
      const props = bar({ showTooltip: true, ...overrides });
      const withBudget = computeChartScene(
        props,
        rows,
        SIZE,
        CHART_DEFAULT_METRICS,
      );
      const without = computeChartScene(props, rows, SIZE, unbounded);
      expect(JSON.stringify(withBudget)).toBe(JSON.stringify(without));
    });
  }
});

describe("ADR-211 G1 — 판독 수리 (labelText 창 offset · ticks 원천 · rule budget 병합)", () => {
  it("windowStart > 0 이면 labelText(ci) 는 visible index 의 범주명을 낸다 (input closure 아님)", () => {
    const rows = wideRows(1000);
    const props = bar({ labelKey: "category", showValueLabels: true });
    const model = resolveChartModel(rows, props, {
      size: SIZE,
      metrics: CHART_DEFAULT_METRICS,
      windowStart: 10,
    });
    expect(model.budget.window?.start).toBe(10);
    expect(model.visible.categories[0]).toBe("c10");
    expect(model.layout.labelText(0, 0)).toBe("c10");
    expect(model.layout.labelText(3, 0)).toBe("c13");
    // DOM 모델의 값 라벨도 같은 함수를 지난다.
    const dom = resolveChartData(rows, props, 8, {
      size: SIZE,
      metrics: CHART_DEFAULT_METRICS,
      windowStart: 10,
    });
    expect(dom.rows[0].category).toBe("c10");
    expect(dom.layout.labelText(0, 0)).toBe("c10");
  });

  it("scene 의 값 축과 DOM 모델의 ticks 는 model.ticks 하나에서 나온다", () => {
    const rows = wideRows(1000);
    const props = bar();
    const model = resolveChartModel(rows, props, {
      size: SIZE,
      metrics: CHART_DEFAULT_METRICS,
    });
    const dom = resolveChartData(rows, props, 8, {
      size: SIZE,
      metrics: CHART_DEFAULT_METRICS,
    });
    expect(dom.ticks).toEqual(model.ticks);
    expect(model.ticks).toEqual(model.layout.ticks); // P1: transformed = input
  });

  it("rule budget 채널의 명시 undefined 는 기본값을 지우지 않는다", () => {
    expect(
      mergeBudgetMetrics({ minSlot: undefined, rowCap: 100 }),
    ).toMatchObject({
      minSlot: 8,
      rowCap: 100,
    });
    expect(mergeBudgetMetrics({ minSlot: Number.NaN }).minSlot).toBe(8);
    expect(mergeBudgetMetrics(undefined)).toEqual(U);
  });

  it("pie/radar/radial (P1 미적용 모드) 은 fitEff 0 이어도 plotTooSmall 을 내지 않는다", () => {
    const budget = resolveDisplayBudget({
      kind: "pie",
      geometry: {
        plot: plot(20, 20),
        horizontal: false,
        radius: { outer: 2, inner: 0 },
      },
      series: 1,
      stacked: false,
      n: 10,
      k: 1,
      metrics: U,
    });
    expect(budget.fitEff).toBe(2);
    const tiny = resolveDisplayBudget({
      ...{
        kind: "pie" as const,
        geometry: {
          plot: plot(4, 4),
          horizontal: false,
          radius: { outer: 0.5, inner: 0 },
        },
        series: 1,
        stacked: false,
        n: 10,
        k: 1,
        metrics: U,
      },
    });
    expect(tiny.fitEff).toBe(0);
    expect(tiny.diagnostics).toEqual([]);
  });
});

describe("ADR-211 G1 — fitEff 0 scene", () => {
  it("플롯이 최소 슬롯보다 좁으면 마크 0 + `budget.plotTooSmall` (empty 아님, 데이터 보존)", () => {
    // 폭 100 · S 8 묶음 → plot.w ≈ 55 < 64 → fit 0
    const rows = wideRows(5, 8);
    const scene = computeChartScene(bar({ color: "series" }), rows, {
      width: 100,
      height: 300,
    });
    expect(scene.empty).toBe(false);
    expect(scene.marks).toEqual([]);
    expect(scene.diagnostics?.map((d) => d.code)).toEqual([
      "budget.plotTooSmall",
    ]);
  });
});
