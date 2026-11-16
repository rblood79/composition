/**
 * ADR-306 G4 — category family 손계산 fixture (breakdown §7.1 · 외부 oracle) + 진단 · 예산 · 크기 표.
 *
 * 수치는 ztd-charts 0.5.0 (`3c4376c`) 식을 손으로 푼 값이다 — 코드 출력으로 만들지 않았다:
 * - waffle (가장 큰 나머지): [38, 33, 29] / 100 칸 = 그대로 · [1, 1, 1] → 33.3 씩 → 바닥 33 · 남은 1 칸은
 *   첫 항목 → [34, 33, 33] · valueMax 200 에 [50, 30] → 정확히 [25, 15] · 칸 합 40 (= 80 / 200).
 * - pareto 표본 합 100: 누적 54 · 79 · 86 … 100 — 기준 80 이면 강조 2 개 (79 < 79.5 · 다음 86 > 80.5).
 * - funnel [1000, 600, 150]: 이전 대비 60 % · 25 % → 강조 = 3 단계 · 첫 대비 60 % · 15 %.
 * - waterfall 표본: 3200 → +1100 → +450 → −380 → −270 → 합계 (값 없음 = 누적 4100). domain
 *   `fitDomain(0, 4750, 3)`: step 2000 · 6000 − 4750 > 600 → 4750 × 1.07 = 5082.5.
 * - lollipop 표본 [14 … 82]: `fitDomain(14, 82, 4)` → 0 포함 · step 20 · 100 − 82 > 6 → 87.74.
 * - stream silhouette [[1, 2], [3, 4]]: 위치마다 합의 절반 아래에서 쌓는다 → s0 [−2, −1] · [−3, −1],
 *   s1 [−1, 2] · [−1, 3].
 * - bump 값 → 순위: 한 시점의 값 [10, 30, 20] → [3, 1, 2].
 * - marimekko 표본: 열 합 Search 45 · PMax 35 · Social 20 (합 100).
 * - skyline: 폭 600 · 기간 14 → 칸 600 / 14.55 ≥ 20 → 합치지 않음 · 기간 10 을 3 개씩 → 첫 묶음 [0, 1)
 *   (10 − 3 × 3 = 1 — 덜 찬 묶음이 가장 오래된 쪽) · 둘째 [1, 4).
 */
import { describe, expect, it } from "vitest";
import {
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
} from "../../computeChartScene";
import { getChartDescriptor } from "../../authoring";
import type { ChartProps, ChartRow, ChartScene, Mark } from "../../types";
import { categoryFamily, CATEGORY_TYPES } from "../category";
import {
  funnelModel,
  lollipopModel,
  paretoModel,
  segmentedModel,
  waffleModel,
  waterfallModel,
} from "../category/bars";
import { groupRange, marimekkoModel, mergeFactor } from "../category/blocks";
import { categoryContext } from "../category/common";
import { bumpModel, slopeModel, sparklineModel } from "../category/lines";
import { allocateCells, ranks, stack } from "../shapes";

type CategoryType = (typeof CATEGORY_TYPES)[number];
const SIZE = { width: 640, height: 360 };
const props = (patch: Partial<ChartProps>): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  ...patch,
});
const sampled = (type: CategoryType, patch: Partial<ChartProps> = {}) => ({
  props: props({
    ...getChartDescriptor(type).defaults,
    chartType: type,
    showTooltip: true,
    ...categoryFamily.sampleProps(type),
    ...patch,
  }),
  rows: categoryFamily.sample(type),
});
const ctxOf = (
  type: CategoryType,
  patch: Partial<ChartProps> = {},
  rows?: ChartRow[],
) => {
  const s = sampled(type, patch);
  return categoryContext(s.props, rows ?? s.rows, SIZE, CHART_DEFAULT_METRICS);
};
const sceneOf = (
  type: CategoryType,
  patch: Partial<ChartProps> = {},
  rows?: ChartRow[],
  size = SIZE,
): ChartScene => {
  const s = sampled(type, patch);
  return categoryFamily.buildScene(
    s.props,
    rows ?? s.rows,
    size,
    CHART_DEFAULT_METRICS,
  );
};

/** scene 안의 모든 숫자가 유한한가 (path 문자열의 NaN 포함). */
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
    }
  };
  scene.marks.forEach((m, i) => check(m, `marks[${i}]`));
  scene.axes.forEach((a, i) => {
    a.grid.forEach((m, j) => check(m, `axes[${i}].grid[${j}]`));
    a.ticks.forEach((m, j) => check(m, `axes[${i}].ticks[${j}]`));
  });
  return bad;
}

describe("ADR-306 G4 — 공용 계산 (손계산)", () => {
  it("allocateCells — 합은 칸 수 (반올림 뒤에도)", () => {
    expect(allocateCells([38, 33, 29], 100)).toEqual([38, 33, 29]);
    expect(allocateCells([1, 1, 1], 100)).toEqual([34, 33, 33]);
    expect(allocateCells([50, 30], 100, 200)).toEqual([25, 15]);
  });
  it("stack silhouette · ranks", () => {
    const st = stack(
      [
        [1, 2],
        [3, 4],
      ],
      "silhouette",
    );
    expect(st.y0).toEqual([
      [-2, -3],
      [-1, -1],
    ]);
    expect(st.y1).toEqual([
      [-1, -1],
      [2, 3],
    ]);
    expect(ranks([10, 30, 20])).toEqual([3, 1, 2]);
  });
  it("skyline 합치기 · 묶음 범위", () => {
    expect(mergeFactor(600, 14)).toBe(1);
    expect(groupRange(0, 10, 3)).toEqual([0, 1]);
    expect(groupRange(1, 10, 3)).toEqual([1, 4]);
  });
});

describe("ADR-306 G4 — category 모델 (손계산)", () => {
  it("waffle — 칸 합 100 · 첫 항목 강조", () => {
    const model = waffleModel(
      ctxOf("waffle", {}, [
        { segment: "A", customers: 38 },
        { segment: "B", customers: 33 },
        { segment: "C", customers: 29 },
      ]),
    )!;
    expect(model.counts).toEqual([38, 33, 29]);
    expect(model.counts.reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("pareto — 마지막 누적 100 % · 기준 80 강조 2", () => {
    const model = paretoModel(ctxOf("pareto"))!;
    expect(
      model.bars.map((b) => Math.round(b.cum * 10) / 10).slice(0, 3),
    ).toEqual([54, 79, 86]);
    expect(model.bars[model.bars.length - 1].cum).toBeCloseTo(100, 10);
    expect(model.bars.filter((b) => b.hi)).toHaveLength(2);
  });
  it("funnel — 이전 대비 · 첫 대비 · 가장 낮은 전환 강조", () => {
    const rows = [
      { stage: "A", users: 1000 },
      { stage: "B", users: 600 },
      { stage: "C", users: 150 },
    ];
    const prev = funnelModel(ctxOf("funnel", {}, rows))!;
    expect(prev.stages.map((s) => s.rate)).toEqual([null, 60, 25]);
    expect(prev.hi).toBe(2);
    const first = funnelModel(ctxOf("funnel", { rateBase: "first" }, rows))!;
    expect(first.stages.map((s) => s.rate)).toEqual([null, 60, 15]);
  });
  it("waterfall — 누적 · 값 없는 합계 = 누적 · domain", () => {
    const model = waterfallModel(ctxOf("waterfall"))!;
    expect(model.steps.map((s) => [s.start, s.end])).toEqual([
      [0, 3200],
      [3200, 4300],
      [4300, 4750],
      [4750, 4370],
      [4370, 4100],
      [0, 4100],
    ]);
    expect(model.steps.map((s) => s.total)).toEqual([
      true,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(model.domain[0]).toBe(0);
    expect(model.domain[1]).toBeCloseTo(5082.5, 10);
    const end = waterfallModel(ctxOf("waterfall", { endTotal: true }))!;
    expect(end.steps[end.steps.length - 1]).toMatchObject({
      row: -1,
      end: 4100,
      total: true,
    });
  });
  it("lollipop — 큰 순서 · 0 포함 domain · 최댓값 강조", () => {
    const model = lollipopModel(ctxOf("lollipop", { sort: "ascending" }))!;
    expect(model.items[0].value).toBe(14);
    expect(model.domain[0]).toBe(0);
    expect(model.domain[1]).toBeCloseTo(87.74, 10);
    expect(model.items[model.hi].value).toBe(82);
  });
  it("segmented — 비중 합 1 · 0 이하는 0", () => {
    const model = segmentedModel(
      ctxOf("segmented", {}, [
        { method: "a", amount: 3 },
        { method: "b", amount: -5 },
        { method: "c", amount: 1 },
      ]),
    )!;
    expect(model.total).toBe(4);
    expect(model.parts.map((p) => p.share)).toEqual([0.75, 0.25, 0]);
  });
  it("marimekko — 열 합 · 합계", () => {
    const model = marimekkoModel(ctxOf("marimekko"))!;
    expect(model.cols).toEqual(["Search", "PMax", "Social"]);
    expect(model.colTotals.map((v) => Math.round(v * 10) / 10)).toEqual([
      45, 35, 20,
    ]);
    expect(model.total).toBeCloseTo(100, 10);
  });
  it("bump — group 형태 (ADR-312 — `dataMode` 로 고름) 는 값으로 순위 · 가장 많이 오른 계열 강조", () => {
    const rows = [
      { m: "1", app: "A", v: 10 },
      { m: "1", app: "B", v: 30 },
      { m: "1", app: "C", v: 20 },
      { m: "2", app: "A", v: 40 },
      { m: "2", app: "B", v: 30 },
      { m: "2", app: "C", v: 20 },
    ];
    const model = bumpModel(
      ctxOf(
        "bump",
        { dimension: "m", color: "app", metric: "v", dataMode: "group" },
        rows,
      ),
    )!;
    expect(model.lines.map((l) => l.ranks)).toEqual([
      [3, 1],
      [1, 2],
      [2, 3],
    ]);
    expect(model.lines.find((l) => l.hi)?.name).toBe("A");
  });
  it("slope — 첫 · 끝 시점 · pair 형태 (ADR-312 — 항목 = `color` 는 형태와 무관)", () => {
    const group = slopeModel(ctxOf("slope"))!;
    expect(group.periods).toEqual(["2024", "2025"]);
    expect(group.items.find((it) => it.label === "Our brand")).toMatchObject({
      a: 18,
      b: 27,
    });
    expect(group.items[group.hi].label).toBe("Our brand");
    const columns = slopeModel(
      ctxOf(
        "slope",
        {
          color: "name",
          dataMode: "pair",
          startField: "y1",
          endField: "y2",
        },
        [
          { name: "x", y1: 1, y2: 5 },
          { name: "y", y1: 4, y2: 2 },
        ],
      ),
    )!;
    expect(columns.periods).toEqual(["y1", "y2"]);
    expect(columns.items.map((it) => [it.a, it.b])).toEqual([
      [1, 5],
      [4, 2],
    ]);
  });
  it("sparkline — 끝의 빈 값은 건너뛴 마지막 값", () => {
    const model = sparklineModel(
      ctxOf("sparkline", {}, [
        { day: "1", revenue: 3 },
        { day: "2", revenue: 5 },
        { day: "3", revenue: null },
      ]),
    )!;
    expect(model.last).toBe(1);
  });
});

describe("ADR-306 G4 — 12 종 scene (표본 · 경계 입력)", () => {
  for (const type of CATEGORY_TYPES)
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

  for (const type of CATEGORY_TYPES) {
    it(`${type} — 행 0 은 빈 상태 · 역할 비면 설정 오류`, () => {
      expect(sceneOf(type, {}, []).empty).toBe(true);
      const broken = sceneOf(type, {
        dimension: "",
        metric: "",
        color: undefined,
        dataMode: "group",
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
  }

  it("예산 — rowCap 을 넘으면 앞 행만 + budget.rowsTruncated", () => {
    const rows = Array.from(
      { length: CHART_DEFAULT_METRICS.rowCap + 5 },
      (_, i) => ({
        feature: `f${i}`,
        usage: i,
      }),
    );
    const scene = sceneOf("lollipop", {}, rows);
    expect(
      scene.diagnostics?.some((d) => d.code === "budget.rowsTruncated"),
    ).toBe(true);
  });

  it("작은 상자 (Library 표본 칸 140×78) — 범례 · 겹치는 보조 라벨을 내지 않는다", () => {
    const small = { width: 140, height: 78 };
    expect(sceneOf("marimekko", {}, undefined, small).legend).toBeNull();
    expect(sceneOf("marimekko").legend).not.toBeNull();
    const texts = (scene: ChartScene) =>
      scene.marks.filter((m) => m.kind === "text").length;
    expect(texts(sceneOf("bump", {}, undefined, small))).toBe(0);
    expect(texts(sceneOf("bump"))).toBeGreaterThan(0);
    const skyline = sceneOf("skyline", {}, undefined, small);
    expect(skyline.legend).toBeNull();
    expect(
      skyline.marks.some(
        (m) => m.kind === "text" && /Peak|Front peak/.test(m.text),
      ),
    ).toBe(false);
  });

  /** 범주 수천 개 · 아주 작은 · 큰 상자에서 rect 폭 · 높이가 음수 · NaN 이 아니다 (판독 MEDIUM — marimekko). */
  for (const type of CATEGORY_TYPES)
    it(`${type} — 범주가 아주 많아도 기하가 음수 · NaN 이 아니다`, () => {
      const s = sampled(type);
      const dimension = s.props.dimension;
      const many: ChartRow[] = [];
      for (let k = 0; k < 400; k++)
        for (const row of s.rows)
          many.push({ ...row, [dimension]: `${String(row[dimension])}-${k}` });
      for (const size of [
        { width: 640, height: 360 },
        { width: 140, height: 78 },
        { width: 40, height: 30 },
      ]) {
        const scene = sceneOf(type, {}, many, size);
        expect(finiteScene(scene), `${size.width}`).toEqual([]);
        const negative = scene.marks.filter(
          (m) => m.kind === "rect" && (m.w < 0 || m.h < 0),
        );
        expect(negative, `${size.width}`).toEqual([]);
      }
    });

  it("숫자 옵션이 NaN · 문자여도 기본값으로 (waffle cells · columns · skyline depth)", () => {
    for (const [type, patch] of [
      ["waffle", { cells: NaN, columns: NaN }],
      ["waffle", { cells: "x", columns: null }],
      ["skyline", { depth: NaN }],
    ] as const)
      expect(
        finiteScene(sceneOf(type, patch as unknown as Partial<ChartProps>)),
        type,
      ).toEqual([]);
  });
});
