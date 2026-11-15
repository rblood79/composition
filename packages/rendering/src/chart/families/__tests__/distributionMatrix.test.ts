/**
 * ADR-306 G4 — distribution · matrix family 손계산 fixture (breakdown §7.1 · 외부 oracle) + 진단 · 예산 ·
 * 크기 표.
 *
 * 수치는 ztd-charts 0.5.0 (`3c4376c`) 식을 손으로 푼 값이다 — 코드 출력으로 만들지 않았다:
 * - box · histogram: 그룹 A 표본 [1, 9] → n 2 · 중앙값 5 (격자 합산이면 10).
 * - quantileSorted [1, 2, 3, 4] 의 0.25 → (4 − 1) × 0.25 = 0.75 → 1 + 0.75 × 1 = 1.75 (numpy linear).
 * - boxStats Tukey [1, 2, 3, 4, 100]: q1 2 · q3 4 · iqr 2 → 울타리 [−1, 7] → 수염 1 · 4 · 이상값 [100].
 * - binEdges [1 … 5]: 30 개 미만 Sturges ⌈log₂ 5⌉ + 1 = 4 구간 → 폭 4 / 4 = 1 → [1, 2, 3, 4, 5] ·
 *   개수 [1, 1, 1, 2] (마지막 구간만 끝값 포함).
 * - dotUnit(120, 25): 1 → 120 · 2 → 60 · 5 → 24 ≤ 25 → 5.
 * - histogram 경계 [0, 250, 500, 750] · 값 [100, 200, 300, 500, 600] → [2, 1, 2] · 기준 400 이 둘째 구간의
 *   (400 − 250) / 250 = 0.6 자리 → 넘은 몫 0.4.
 * - 사전 집계 [0, 10) 3 · [20, 30) 1 → 사이 빈 구간 [10, 20) 0 을 채운다 · p50 = 목표 2 → 첫 구간 안
 *   2 / 3 → 6.667.
 * - candlestick 같은 기간 (10, 14, 8, 12) · (12, 18, 11, 15) 를 합치면 (10, 18, 8, 15) · 거래량 합.
 * - 이동평균 [1, 2, 3, 4] 기간 2 → [NaN, 1.5, 2.5, 3.5].
 * - calendar: 2024-02-29 은 목요일 (UTC 4). 첫 날 2024-02-26 (월) — 주 시작 0 이면 그 주 일요일
 *   02-25 부터 → 02-29 는 0 주 · 요일 4, 주 시작 1 이면 02-26 부터 → 0 주 · 요일 3. 2023-02-29 는 없는 날.
 * - heatmap 단계: 비율 0 → 1 · 0.5 → 3 · 1 → 4, 같은 칸 두 행은 합산.
 */
import { describe, expect, it } from "vitest";
import {
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
} from "../../computeChartScene";
import { getChartDescriptor } from "../../authoring";
import type { ChartProps, ChartRow, ChartScene, Mark } from "../../types";
import { categoryContext } from "../category/common";
import { distributionFamily, DISTRIBUTION_TYPES } from "../distribution";
import {
  histogramModel,
  histogramQuantile,
  pastShare,
} from "../distribution/histogram";
import { boxModel, ridgelineModel } from "../distribution/spread";
import { matrixFamily, MATRIX_TYPES } from "../matrix";
import {
  calendarModel,
  calendarStep,
  heatmapModel,
  stepOf,
  utcDay,
} from "../matrix/grid";
import { parallelModel } from "../matrix/parallel";
import {
  type Candle,
  candlestickModel,
  maPeriods,
  mergeCandles,
  movingAverage,
} from "../matrix/price";
import {
  beeswarm,
  binCounts,
  binEdges,
  binIndex,
  boxStats,
  dotUnit,
  kde,
  quantileSorted,
} from "../stats";

type Type = (typeof DISTRIBUTION_TYPES)[number] | (typeof MATRIX_TYPES)[number];
const TYPES: readonly Type[] = [...DISTRIBUTION_TYPES, ...MATRIX_TYPES];
const familyOf = (type: Type) =>
  (DISTRIBUTION_TYPES as readonly string[]).includes(type)
    ? distributionFamily
    : matrixFamily;
const SIZE = { width: 640, height: 360 };
const props = (patch: Partial<ChartProps>): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  ...patch,
});
const sampled = (type: Type, patch: Partial<ChartProps> = {}) => ({
  props: props({
    ...getChartDescriptor(type).defaults,
    chartType: type,
    showTooltip: true,
    ...familyOf(type).sampleProps(type),
    ...patch,
  }),
  rows: familyOf(type).sample(type),
});
const ctxOf = (type: Type, patch: Partial<ChartProps>, rows: ChartRow[]) =>
  categoryContext(
    sampled(type, patch).props,
    rows,
    SIZE,
    CHART_DEFAULT_METRICS,
    false,
  );
const sceneOf = (
  type: Type,
  patch: Partial<ChartProps> = {},
  rows?: ChartRow[],
  size = SIZE,
): ChartScene => {
  const s = sampled(type, patch);
  return familyOf(type).buildScene(
    s.props,
    rows ?? s.rows,
    size,
    CHART_DEFAULT_METRICS,
  );
};

function finiteScene(scene: ChartScene): string[] {
  const bad: string[] = [];
  const check = (mark: Mark, where: string) => {
    for (const [key, value] of Object.entries(mark)) {
      if (typeof value === "number" && !Number.isFinite(value))
        bad.push(`${where}.${key}`);
      if (
        key === "d" &&
        typeof value === "string" &&
        /NaN|Infinity/.test(value)
      )
        bad.push(`${where}.d`);
      if (key === "bbox" && value && typeof value === "object")
        for (const [bk, bv] of Object.entries(value))
          if (typeof bv === "number" && !Number.isFinite(bv))
            bad.push(`${where}.bbox.${bk}`);
    }
  };
  scene.marks.forEach((m, i) => check(m, `marks[${i}]`));
  scene.axes.forEach((a, i) => {
    a.grid.forEach((m, j) => check(m, `axes[${i}].grid[${j}]`));
    a.ticks.forEach((m, j) => check(m, `axes[${i}].ticks[${j}]`));
  });
  for (const t of scene.targets ?? [])
    if (![t.x, t.y].every(Number.isFinite)) bad.push(`target ${t.id}`);
  return bad;
}

describe("ADR-306 G4 — 분포 통계 (손계산)", () => {
  it("quantileSorted · boxStats (Tukey · 백분위 수염)", () => {
    expect(quantileSorted([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 9);
    const st = boxStats([1, 2, 3, 4, 100]);
    expect([st.q1, st.median, st.q3, st.lo, st.hi]).toEqual([2, 3, 4, 1, 4]);
    expect(st.outliers).toEqual([100]);
    const pct = boxStats([1, 2, 3, 4, 5], [25, 75]);
    expect([pct.lo, pct.hi]).toEqual([2, 4]);
    expect(pct.outliers).toEqual([1, 5]);
  });

  it("binEdges (Sturges) · binIndex (마지막 구간만 끝 포함) · binCounts · dotUnit", () => {
    const edges = binEdges([1, 2, 3, 4, 5]);
    expect(edges).toEqual([1, 2, 3, 4, 5]);
    expect(binCounts([1, 2, 3, 4, 5], edges).counts).toEqual([1, 1, 1, 2]);
    expect(binIndex([0, 10, 20], 20)).toBe(1);
    expect(binIndex([0, 10, 20], 10)).toBe(1);
    expect(binIndex([0, 10, 20], -1)).toBe(-1);
    expect(dotUnit(120, 25)).toBe(5);
    expect(dotUnit(10, 25)).toBe(1);
  });

  it("kde 는 밀도 (넓은 격자 위 적분 ≈ 1) · beeswarm 은 원이 겹치지 않는다", () => {
    const xs = Array.from({ length: 2201 }, (_, k) => -10 + k * 0.01);
    const dens = kde([0, 1, 2], xs);
    expect(dens.reduce((a, b) => a + b, 0) * 0.01).toBeCloseTo(1, 3);
    const ys = beeswarm([100, 100, 100, 100, 100], 3);
    const sorted = [...ys].sort((a, b) => a - b);
    for (let k = 1; k < sorted.length; k++)
      expect(sorted[k] - sorted[k - 1]).toBeGreaterThanOrEqual(7.2 - 1e-3);
  });
});

describe("ADR-306 G4 — distribution 모델 (손계산)", () => {
  const twoValues: ChartRow[] = [
    { g: "A", v: 1 },
    { g: "A", v: 9 },
  ];
  it("box — 그룹 A [1, 9] → n 2 · 중앙값 5 (격자 합산 아님)", () => {
    const model = boxModel(
      ctxOf("box", { dimension: "g", metric: "v" }, twoValues),
    )!;
    expect(model.groups[0].stats.n).toBe(2);
    expect(model.groups[0].stats.median).toBe(5);
  });

  it("histogram — 같은 표본의 p50 = 5 · 경계 지정 개수 · 기준이 걸친 구간의 몫", () => {
    const m = histogramModel(
      ctxOf("histogram", { metric: "v", color: undefined }, twoValues),
    )!;
    expect(histogramQuantile(m, 0, 50)).toBe(5);
    const rows = [100, 200, 300, 500, 600].map((ms) => ({ ms }));
    const edged = histogramModel(
      ctxOf("histogram", { edges: [0, 250, 500, 750], threshold: 400 }, rows),
    )!;
    expect(edged.bins.map((b) => b.counts[0])).toEqual([2, 1, 2]);
    expect(pastShare(edged.bins[1], 400, false)).toBeCloseTo(0.4, 9);
    expect(pastShare(edged.bins[2], 400, false)).toBe(1);
    // 기준이 걸친 구간은 두 색 (중립 + accent), 넘은 구간은 accent 하나.
    const scene = sceneOf(
      "histogram",
      { edges: [0, 250, 500, 750], threshold: 400 },
      rows,
    );
    const fills = scene.marks.filter(
      (mk) => mk.kind === "path" && mk.fillPaint !== undefined,
    );
    expect(fills.map((mk) => (mk as { fillPaint?: string }).fillPaint)).toEqual(
      ["neutral", "neutral", "accent", "accent"],
    );
  });

  it("histogram 사전 집계 — 빈 구간 채움 · 구간 안 어림 분위", () => {
    const rows = [
      { a: 0, b: 10, n: 3 },
      { a: 20, b: 30, n: 1 },
    ];
    const m = histogramModel(
      ctxOf(
        "histogram",
        { binStartField: "a", binEndField: "b", countField: "n" },
        rows,
      ),
    )!;
    expect(m.binned).toBe(true);
    expect(m.bins.map((b) => [b.x0, b.x1, b.counts[0]])).toEqual([
      [0, 10, 3],
      [10, 20, 0],
      [20, 30, 1],
    ]);
    expect(histogramQuantile(m, 0, 50)).toBeCloseTo(20 / 3, 9);
  });

  it("histogram — 그룹이 셋이면 앞의 둘만 + budget.groupsTruncated", () => {
    const rows = ["a", "b", "c"].flatMap((g) =>
      [1, 2, 3].map((v) => ({ g, v })),
    );
    const scene = sceneOf("histogram", { metric: "v", color: "g" }, rows);
    expect(
      scene.diagnostics?.some((d) => d.code === "budget.groupsTruncated"),
    ).toBe(true);
  });

  it("ridgeline — sort ascending 은 중앙값 오름차순 (ztd `median`)", () => {
    const rows = [
      ...[5, 6, 7].map((v) => ({ g: "mid", v })),
      ...[1, 2, 3].map((v) => ({ g: "low", v })),
      ...[9, 10, 11].map((v) => ({ g: "high", v })),
    ];
    const order = (sort: ChartProps["sort"]) =>
      ridgelineModel(
        ctxOf("ridgeline", { dimension: "g", metric: "v", sort }, rows),
      )!.ridges.map((r) => r.name);
    expect(order("none")).toEqual(["mid", "low", "high"]);
    expect(order("ascending")).toEqual(["low", "mid", "high"]);
    expect(order("descending")).toEqual(["high", "mid", "low"]);
  });

  it("분포 통계는 원본 전체 — rowCap 을 넘어도 잘린 표본으로 중앙값을 내지 않는다", () => {
    const n = CHART_DEFAULT_METRICS.rowCap + 10;
    const rows = Array.from({ length: n }, (_, i) => ({
      g: "A",
      v: i < CHART_DEFAULT_METRICS.rowCap ? 0 : 1000,
    }));
    const ctx = categoryContext(
      sampled("box", { dimension: "g", metric: "v" }).props,
      rows,
      SIZE,
      CHART_DEFAULT_METRICS,
      false,
    );
    expect(boxModel(ctx)!.groups[0].stats.n).toBe(n);
    const scene = sceneOf("box", { dimension: "g", metric: "v" }, rows);
    expect(
      scene.diagnostics?.some((d) => d.code === "budget.rowsTruncated"),
    ).not.toBe(true);
  });
});

describe("ADR-306 G4 — matrix 모델 (손계산)", () => {
  it("candlestick — 합치기 (10,18,8,15) · 거래량 합 · 이동평균 · 기간 거름", () => {
    const c = (
      o: number,
      h: number,
      l: number,
      cl: number,
      v: number,
      i: number,
    ): Candle => ({
      i,
      span: 1,
      label: `d${i}`,
      o,
      h,
      l,
      c: cl,
      v,
      rows: [i],
    });
    const merged = mergeCandles(
      [c(10, 14, 8, 12, 100, 0), c(12, 18, 11, 15, 50, 1)],
      1.9,
    );
    // max < 2 면 합치지 않는다 (ztd) — 상한 1 은 2 로 본다.
    expect(merged).toHaveLength(2);
    const [q] = mergeCandles(
      [
        c(10, 14, 8, 12, 100, 0),
        c(12, 18, 11, 15, 50, 1),
        c(1, 1, 1, 1, 1, 2),
        c(1, 1, 1, 1, 1, 3),
      ],
      2,
    );
    expect([q.o, q.h, q.l, q.c, q.v, q.span]).toEqual([10, 18, 8, 15, 150, 2]);
    expect(movingAverage([1, 2, 3, 4], 2)).toEqual([NaN, 1.5, 2.5, 3.5]);
    expect(maPeriods([1, 5, 20, 30, 2], 10)).toEqual([5, 2]);
  });

  it("calendar — 윤일 칸 위치 (주 시작 0 / 1) · 없는 날 거부 · UTC", () => {
    expect(utcDay("2024-02-29")).toBe(Date.UTC(2024, 1, 29));
    expect(utcDay("2023-02-29")).toBeNull();
    const rows = [
      { date: "2024-02-26", n: 1 },
      { date: "2024-02-29", n: 3 },
    ];
    const at = (weekStart: number) =>
      calendarModel(
        ctxOf("calendar", { dimension: "date", metric: "n", weekStart }, rows),
      )!.days.find((d) => d.t === Date.UTC(2024, 1, 29))!;
    expect([at(0).week, at(0).wd]).toEqual([0, 4]);
    expect([at(1).week, at(1).wd]).toEqual([0, 3]);
    const model = calendarModel(
      ctxOf("calendar", { dimension: "date", metric: "n" }, rows),
    )!;
    expect(calendarStep(model, 0)).toBe("step-0");
    expect(calendarStep(model, 3)).toBe("step-4");
  });

  it("heatmap — 같은 칸 합산 · 단계 4 등분", () => {
    const rows = [
      { x: "a", y: "r", v: 2 },
      { x: "a", y: "r", v: 3 },
      { x: "b", y: "r", v: 1 },
    ];
    const m = heatmapModel(
      ctxOf("heatmap", { dimension: "x", rowField: "y", metric: "v" }, rows),
    )!;
    expect(Array.from(m.vals)).toEqual([5, 1]);
    expect([stepOf(0), stepOf(0.5), stepOf(1)]).toEqual([
      "step-1",
      "step-3",
      "step-4",
    ]);
  });

  it("parallel — 값 필드 2 개 미만은 설정 오류 · invertFields 는 작은 값이 위", () => {
    const s = sampled("parallel");
    expect(
      parallelModel(ctxOf("parallel", { valueFields: ["price"] }, s.rows)),
    ).toBeNull();
    const m = parallelModel(ctxOf("parallel", {}, s.rows))!;
    expect(m.inverted).toEqual([true, true, false, false, false]);
  });
});

describe("ADR-306 G4 — 8 종 scene (표본 · 경계 입력)", () => {
  for (const type of TYPES)
    for (const size of [
      { width: 320, height: 240 },
      { width: 640, height: 360 },
      { width: 160, height: 48 },
    ])
      it(`${type} ${size.width}×${size.height} 표본 — 마크 있음 · 숫자 유한 · 설정 오류 없음`, () => {
        const scene = sceneOf(type, {}, undefined, size);
        expect(finiteScene(scene)).toEqual([]);
        expect(
          (scene.diagnostics ?? []).filter((d) => d.severity === "error"),
        ).toEqual([]);
        if (size.width >= 320) {
          expect(scene.empty).toBe(false);
          expect(scene.marks.length).toBeGreaterThan(0);
          expect(scene.targets?.length ?? 0).toBeGreaterThan(0);
        }
      });

  for (const type of TYPES) {
    it(`${type} — 행 0 은 빈 상태 · 역할 비면 설정 오류`, () => {
      expect(sceneOf(type, {}, []).empty).toBe(true);
      const broken = sceneOf(type, {
        dimension: "",
        metric: "",
        rowField: "",
        closeField: "",
        countField: undefined,
        valueFields: [],
      });
      expect(broken.empty).toBe(true);
      expect(broken.diagnostics?.some((d) => d.code === "role.missing")).toBe(
        true,
      );
    });
    it(`${type} — 음수 · 0 · 결측 행에서도 숫자 유한`, () => {
      const s = sampled(type);
      const rows = s.rows.map((row, i) => {
        const out: ChartRow = { ...row };
        for (const [k, v] of Object.entries(row))
          if (typeof v === "number")
            out[k] = i % 3 === 0 ? -v : i % 3 === 1 ? 0 : null;
        return out;
      });
      expect(finiteScene(sceneOf(type, {}, rows))).toEqual([]);
    });
    it(`${type} — 항목 하나 · 긴 한국어 라벨에서도 숫자 유한`, () => {
      const s = sampled(type);
      const dimension = s.props.dimension;
      const one = s.rows.slice(0, 1).map((row) => ({
        ...row,
        ...(dimension ? { [dimension]: row[dimension] } : {}),
      }));
      const longKo = s.rows.map((row) =>
        dimension &&
        typeof row[dimension] === "string" &&
        type !== "calendar" &&
        type !== "candlestick"
          ? {
              ...row,
              [dimension]: `아주 긴 한국어 범주 이름 ${String(row[dimension])}`,
            }
          : row,
      );
      expect(finiteScene(sceneOf(type, {}, one))).toEqual([]);
      expect(finiteScene(sceneOf(type, {}, longKo))).toEqual([]);
    });
    it(`${type} — 범주 · 행이 아주 많아도 기하가 음수 · NaN 이 아니다`, () => {
      const s = sampled(type);
      const dimension = s.props.dimension;
      const many: ChartRow[] = [];
      for (let k = 0; k < 60; k++)
        for (const row of s.rows)
          many.push(
            dimension && type !== "calendar" && type !== "candlestick"
              ? { ...row, [dimension]: `${String(row[dimension])}-${k}` }
              : row,
          );
      for (const size of [
        { width: 640, height: 360 },
        { width: 140, height: 78 },
        { width: 40, height: 30 },
      ]) {
        const scene = sceneOf(type, {}, many, size);
        expect(finiteScene(scene), `${size.width}`).toEqual([]);
        expect(
          scene.marks.filter((m) => m.kind === "rect" && (m.w < 0 || m.h < 0)),
          `${size.width}`,
        ).toEqual([]);
        expect(
          scene.marks.filter(
            (m) => m.kind === "path" && (m.bbox.w < 0 || m.bbox.h < 0),
          ),
          `${size.width}`,
        ).toEqual([]);
      }
    });
  }

  it("작은 상자 (Library 칸 140 × 78 · 147 × 83) — parallel 은 축 이름을 빼고도 선을 그린다 (Phase 5 live 에서 발견)", () => {
    for (const size of [
      { width: 140, height: 78 },
      { width: 147, height: 83 },
    ]) {
      const scene = sceneOf("parallel", {}, undefined, size);
      expect(
        scene.marks.filter((m) => m.kind === "path").length,
        `${size.width}`,
      ).toBeGreaterThan(0);
    }
  });

  it("작은 상자 (Library 표본 칸) — candlestick 거래량 · 이동평균 이름, parallel 축 끝 값을 내지 않는다", () => {
    const small = { width: 180, height: 110 };
    const texts = (scene: ChartScene) =>
      scene.marks
        .filter((m) => m.kind === "text")
        .map((m) => m.kind === "text" && m.text);
    const candle = sceneOf("candlestick", {}, undefined, small);
    expect(candle.marks.some((m) => m.kind === "rect")).toBe(false);
    expect(texts(candle).some((t) => /^MA/.test(String(t)))).toBe(false);
    const big = sceneOf("candlestick");
    expect(big.marks.some((m) => m.kind === "rect")).toBe(true);
    expect(texts(big).some((t) => /^MA5/.test(String(t)))).toBe(true);
    const tickTexts = (scene: ChartScene) =>
      scene.marks.filter((m) => m.kind === "text" && m.role === "tick").length;
    expect(tickTexts(sceneOf("parallel", {}, undefined, small))).toBe(0);
    expect(tickTexts(sceneOf("parallel"))).toBe(10);
    // 합친 봉의 축 글자는 첫 기간만.
    expect(
      candle.axes.flatMap((a) => a.ticks).some((t) => t.text.includes("~")),
    ).toBe(false);
  });

  it("판독 MEDIUM — 그룹 · 행 이름이 수천이어도 펼치기 인자 상한에 걸리지 않는다", () => {
    const groups = (n: number) =>
      Array.from({ length: n * 2 }, (_, i) => ({ g: `g${i >> 1}`, v: i % 7 }));
    for (const [type, patch, rows] of [
      ["ridgeline", { dimension: "g", metric: "v" }, groups(2000)],
      ["box", { dimension: "g", metric: "v", shape: "violin" }, groups(3000)],
      [
        "heatmap",
        { dimension: "x", rowField: "y", metric: "v" },
        Array.from({ length: 130_000 }, (_, i) => ({
          x: "a",
          y: `r${i}`,
          v: i,
        })),
      ],
    ] as const)
      expect(
        () => sceneOf(type, patch as Partial<ChartProps>, rows as ChartRow[]),
        type,
      ).not.toThrow();
  });

  it("판독 MEDIUM — candlestick 은 시각 전체로 정렬한다 (같은 날 시간봉 · epoch)", () => {
    const hourly = [
      "2025-01-03T10:00:00Z",
      "2025-01-03T09:00:00Z",
      "2025-01-02T10:00:00Z",
      "2025-01-02T09:00:00Z",
    ].map((date, i) => ({ date, close: 10 - i }));
    const order = (rows: ChartRow[]) =>
      candlestickModel(
        ctxOf("candlestick", { dimension: "date", closeField: "close" }, rows),
      )!.candles.map((q) => q.c);
    expect(order(hourly)).toEqual([7, 8, 9, 10]);
    const epoch = [
      { date: Date.UTC(2025, 0, 2), close: 2 },
      { date: Date.UTC(2025, 0, 1), close: 1 },
    ];
    expect(order(epoch)).toEqual([1, 2]);
  });

  it("숫자 옵션이 NaN · 문자여도 기본값으로", () => {
    for (const [type, patch] of [
      [
        "histogram",
        { bins: NaN, binWidth: NaN, edges: ["x"], percentiles: ["p", "pp50"] },
      ],
      ["beeswarm", { dotRadius: NaN }],
      ["ridgeline", { overlap: NaN, bandwidth: "x" }],
      ["calendar", { weekStart: NaN, cellGap: "x" }],
      ["candlestick", { movingAverages: ["x", NaN], valueMin: NaN }],
      ["box", { whiskers: ["x", 200] }],
    ] as const)
      expect(
        finiteScene(sceneOf(type, patch as unknown as Partial<ChartProps>)),
        type,
      ).toEqual([]);
  });

  it("histogram 모양 dots · step · 밀도 곡선 · log 도 숫자 유한", () => {
    for (const patch of [
      { shape: "dots" },
      { shape: "step" },
      { kde: true },
      { log: true },
      { shape: "step", color: "g" },
    ] as const) {
      const rows =
        "color" in patch
          ? distributionFamily
              .sample("histogram")
              .map((r, i) => ({ ...r, g: i % 2 ? "A" : "B" }))
          : undefined;
      const scene = sceneOf("histogram", patch as Partial<ChartProps>, rows);
      expect(finiteScene(scene), JSON.stringify(patch)).toEqual([]);
      expect(scene.marks.length).toBeGreaterThan(0);
    }
  });

  it("box 모양 violin · both · 수염 백분위도 숫자 유한", () => {
    for (const patch of [
      { shape: "violin" },
      { shape: "both" },
      { whiskers: [5, 95] },
    ] as const)
      expect(
        finiteScene(sceneOf("box", patch as Partial<ChartProps>)),
        JSON.stringify(patch),
      ).toEqual([]);
  });
});
