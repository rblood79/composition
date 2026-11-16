/**
 * ADR-312 Phase 3 · G3 — 행 정책 (breakdown §2.4 · 본문 Decision 5 · 사용자 결정 4 「전부 표준대로」).
 *
 * 기대 값은 손계산이다 (breakdown §6.1 Q5 — 구현 출력으로 만들지 않는다). fixture 는 키가 겹치는 작은 표 (3 ~ 5 행)
 * 이고, 표본 테이블은 중복 키가 없어 「표본 scene 전후 동일」 의 회귀 확인에만 쓴다 (Q1).
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  CHART_DESCRIPTORS,
  completeChartCreationProps,
  createChartInitialProps,
} from "../authoring";
import { computeChartScene } from "../computeChartScene";
import { applyChartRowPolicy } from "../families/rowPolicy";
import { loadChartFamily } from "../families/registry";
import { CHART_FORMS, chartForms, resolveChartRoleDefaults } from "../roles";
import type {
  ChartFamilyId,
  ChartProps,
  ChartRow,
  ChartScene,
  ChartType,
} from "../types";

const FAMILIES: ChartFamilyId[] = [
  "kpi",
  "category",
  "distribution",
  "matrix",
  "network",
];
beforeAll(async () => {
  for (const id of FAMILIES) await loadChartFamily(id);
});

const SIZE = { width: 480, height: 300 };
const scene = (
  chartType: ChartType,
  rows: ChartRow[],
  extra: Partial<ChartProps> = {},
): ChartScene =>
  computeChartScene(
    { chartType, showTooltip: true, ...extra } as ChartProps,
    rows,
    SIZE,
  );
/** target 하나 = 「제목 → 원본 행 · 툴팁 줄」 */
const targets = (s: ChartScene) =>
  Object.fromEntries(
    (s.targets ?? []).map((t) => [
      t.title,
      {
        rows: [...t.rows].sort((a, b) => a - b),
        entries: Object.fromEntries(t.entries.map((e) => [e.label, e.text])),
      },
    ]),
  );
const codes = (s: ChartScene) => (s.diagnostics ?? []).map((d) => d.code);

// 범주 A 가 두 행 (2 · 3), B 가 한 행 (5).
const AB: ChartRow[] = [
  { category: "A", value: 2, start: 1, end: 4, goal: 3 },
  { category: "B", value: 5, start: 2, end: 3, goal: 1 },
  { category: "A", value: 3, start: 1, end: 2, goal: 2 },
];

describe("ADR-312 G3 — 선언", () => {
  it("모든 형태에 행 정책이 있고, sum 의 키 역할은 그 형태의 역할이다", () => {
    for (const [type, forms] of Object.entries(CHART_FORMS))
      for (const form of forms) {
        expect(["sum", "row", "sample"], `${type}/${form.id}`).toContain(
          form.rows,
        );
        const roles = form.roles.map((u) => u.role);
        for (const key of form.key)
          expect(roles, `${type}/${form.id} key ${key}`).toContain(key);
        if (form.rows !== "sum") expect(form.key).toEqual([]);
      }
  });

  it("사용자 결정 4 — 바뀌는 종류는 공용 묶기를 지난다 (스스로 합치지 않는다)", () => {
    const changed: ChartType[] = [
      "lollipop",
      "segmented",
      "waffle",
      "funnel",
      "pareto",
      "bullet",
      "dumbbell",
      "gauge",
      "sparkline",
      "slope",
    ];
    for (const type of changed)
      for (const form of chartForms(type)) {
        expect(form.rows, type).toBe("sum");
        expect(form.grouped, type).toBeUndefined();
      }
    expect(chartForms("bump")[0]).toMatchObject({ id: "ranked", rows: "sum" });
    expect(chartForms("bump")[0].grouped).toBeUndefined();
  });
});

describe("ADR-312 G3 — 공용 묶기 (`applyChartRowPolicy`)", () => {
  const props = (extra: Partial<ChartProps>) =>
    ({ chartType: "lollipop", ...extra }) as ChartProps;

  it("키가 같은 행을 합치고 원본 행 번호를 남긴다", () => {
    const out = applyChartRowPolicy(
      props({ dimension: "category", metric: "value" }),
      AB,
    );
    expect(out.rows.map((r) => [r.category, r.value])).toEqual([
      ["A", 5],
      ["B", 5],
    ]);
    expect(out.sources).toEqual([[0, 2], [1]]);
    expect(out.diagnostics).toEqual([]);
  });

  it("비숫자는 결측 — 0 이 아니다. 숫자가 하나도 없으면 첫 행 값", () => {
    const rows: ChartRow[] = [
      { category: "A", value: "n/a" },
      { category: "A", value: 4 },
      { category: "B", value: "x" },
      { category: "B", value: "y" },
    ];
    const out = applyChartRowPolicy(
      props({ dimension: "category", metric: "value" }),
      rows,
    );
    expect(out.rows.map((r) => r.value)).toEqual([4, "x"]);
  });

  it("키가 겹치지 않으면 입력 그대로 (같은 배열)", () => {
    const rows = AB.slice(0, 2);
    const out = applyChartRowPolicy(
      props({ dimension: "category", metric: "value" }),
      rows,
    );
    expect(out.rows).toBe(rows);
    expect(out.sources).toBeNull();
  });

  it("키 역할에 값이 없으면 묶지 않는다 (sparkline 의 선택 `dimension`)", () => {
    const out = applyChartRowPolicy(
      { chartType: "sparkline", metric: "value" } as ChartProps,
      AB,
    );
    expect(out.sources).toBeNull();
  });

  it("행마다 표식 · 표본 · 스스로 합치는 형태는 지나지 않는다", () => {
    for (const chartType of [
      "scatter",
      "waterfall",
      "candlestick",
      "box",
      "bar",
      "heatmap",
    ] as ChartType[])
      expect(
        applyChartRowPolicy(
          { chartType, dimension: "category", metric: "value" } as ChartProps,
          AB,
        ).sources,
        chartType,
      ).toBeNull();
  });

  it("가산이 아닌 역할이 갈리면 첫 행 값 + `rows.duplicate` (bullet 의 구간 경계)", () => {
    const rows: ChartRow[] = [
      { category: "A", value: 2, goal: 3, poor: 10 },
      { category: "A", value: 3, goal: 2, poor: 20 },
    ];
    const out = applyChartRowPolicy(
      {
        chartType: "bullet",
        dimension: "category",
        metric: "value",
        goalField: "goal",
        rangeFields: ["poor"],
      } as ChartProps,
      rows,
    );
    expect(out.rows).toEqual([{ category: "A", value: 5, goal: 5, poor: 10 }]);
    expect(out.diagnostics).toMatchObject([
      { code: "rows.duplicate", severity: "warning", value: "rangeFields" },
    ]);
  });

  it("가산이 아닌 역할이 같으면 경고하지 않는다", () => {
    const rows: ChartRow[] = [
      { category: "A", value: 2, poor: 10 },
      { category: "A", value: 3, poor: 10 },
    ];
    const out = applyChartRowPolicy(
      {
        chartType: "bullet",
        dimension: "category",
        metric: "value",
        rangeFields: ["poor"],
      } as ChartProps,
      rows,
    );
    expect(out.diagnostics).toEqual([]);
  });
});

describe("ADR-312 G3 — 종류마다 중복 키 fixture (scene, 손계산)", () => {
  it.each(["lollipop", "segmented", "waffle", "funnel", "pareto"] as const)(
    "%s — A = 2 + 3 = 5 (행 0 · 2), B = 5",
    (type) => {
      const t = targets(scene(type, AB));
      expect(Object.keys(t).sort()).toEqual(["A", "B"]);
      expect(t.A.rows).toEqual([0, 2]);
      expect(t.B.rows).toEqual([1]);
      expect(Object.values(t.A.entries)).toContain("5");
    },
  );

  it("gauge — 여러 행이면 합 (값 2 + 5 + 3 = 10, 목표 3 + 1 + 2 = 6)", () => {
    const t = Object.values(targets(scene("gauge", AB, { goalField: "goal" })));
    expect(t).toHaveLength(1);
    expect(t[0].rows).toEqual([0, 1, 2]);
    expect(t[0].entries).toMatchObject({ Current: "10", Target: "6" });
  });

  it("bullet — 같은 범주의 실적 · 목표를 합친다 (A 실적 5 · 목표 5)", () => {
    const t = targets(scene("bullet", AB, { goalField: "goal" }));
    expect(t.A).toMatchObject({
      rows: [0, 2],
      entries: { Actual: "5", Target: "5" },
    });
    expect(t.B.entries).toMatchObject({ Actual: "5", Target: "1" });
  });

  it("dumbbell — 같은 범주의 앞 · 뒤를 합친다 (A 앞 1 + 1 = 2, 뒤 4 + 2 = 6)", () => {
    const t = targets(scene("dumbbell", AB));
    expect(t.A.rows).toEqual([0, 2]);
    expect(Object.values(t.A.entries)).toEqual(
      expect.arrayContaining(["2", "6", "+4"]),
    );
  });

  it("sparkline — `dimension` 이 있으면 같은 항목을 합친다, 없으면 행 순서 그대로", () => {
    const t = targets(scene("sparkline", AB));
    expect(t.A).toMatchObject({ rows: [0, 2], entries: { Value: "5" } });
    const plain = AB.map(({ value }) => ({ value }));
    expect(scene("sparkline", plain).targets).toHaveLength(3);
  });

  it("slope group — 같은 시점 · 항목을 합친다 (a 2023 = 1 + 2 = 3, 지금까지는 마지막 행 2)", () => {
    const rows: ChartRow[] = [
      { category: "2023", series: "a", value: 1 },
      { category: "2024", series: "a", value: 4 },
      { category: "2023", series: "a", value: 2 },
      { category: "2024", series: "b", value: 3 },
      { category: "2023", series: "b", value: 1 },
    ];
    const t = targets(scene("slope", rows));
    expect(t.a).toMatchObject({
      rows: [0, 1, 2],
      entries: { "2023": "3", "2024": "4", Change: "+1" },
    });
    expect(t.b.entries).toMatchObject({ "2023": "1", "2024": "3" });
  });

  it("slope pair — 같은 항목을 합친다 (a 앞 1 + 3 = 4, 뒤 2 + 4 = 6)", () => {
    const rows: ChartRow[] = [
      { series: "a", start: 1, end: 2 },
      { series: "a", start: 3, end: 4 },
      { series: "b", start: 1, end: 1 },
    ];
    const t = targets(scene("slope", rows, { dataMode: "pair" }));
    expect(t.a).toMatchObject({
      rows: [0, 1],
      entries: { start: "4", end: "6", Change: "+2" },
    });
  });

  it("bump ranked — 같은 시점 · 항목의 순위는 첫 행 + `rows.duplicate` (지금까지는 1 + 3 = 4 로 더했다)", () => {
    const rows: ChartRow[] = [
      { category: "Jan", series: "a", rank: 1 },
      { category: "Jan", series: "a", rank: 3 },
      { category: "Jan", series: "b", rank: 2 },
      { category: "Feb", series: "a", rank: 2 },
      { category: "Feb", series: "b", rank: 1 },
    ];
    const s = scene("bump", rows);
    expect(targets(s).Jan.entries).toMatchObject({ a: "#1", b: "#2" });
    expect(codes(s)).toContain("rows.duplicate");
  });

  it("행마다 표식 — waterfall 은 같은 이름의 단계도 두 단계다", () => {
    expect(scene("waterfall", AB).targets).toHaveLength(3);
  });
});

describe("ADR-312 G3 — 스스로 합치는 종류도 같은 정책 (HC2 — 코드는 그대로, fixture 로 고정)", () => {
  it.each<[ChartType, Partial<ChartProps>, ChartRow[], string, string]>([
    [
      "heatmap",
      {},
      [
        { category: "x", row: "r", value: 2 },
        { category: "x", row: "r", value: 3 },
        { category: "y", row: "r", value: 1 },
      ],
      "r · x",
      "Value",
    ],
    [
      "calendar",
      {},
      [
        { category: "2026-01-01", value: 2 },
        { category: "2026-01-01", value: 3 },
        { category: "2026-01-02", value: 1 },
      ],
      "2026-01-01",
      "Value",
    ],
    [
      "marimekko",
      { color: "series" },
      [
        { category: "x", series: "s", value: 2 },
        { category: "x", series: "s", value: 3 },
        { category: "y", series: "s", value: 1 },
      ],
      "x · s",
      "Value",
    ],
    [
      "sankey",
      {},
      [
        { source: "a", target: "b", value: 2 },
        { source: "a", target: "b", value: 3 },
        { source: "b", target: "c", value: 1 },
      ],
      "a → b",
      "Flow",
    ],
    [
      "treemap",
      {},
      [
        { group: "g", category: "x", value: 2 },
        { group: "g", category: "x", value: 3 },
        { group: "g", category: "y", value: 1 },
      ],
      "g › x",
      "Value",
    ],
  ])("%s — 같은 키 2 + 3 = 5", (type, extra, rows, title, label) => {
    const t = targets(scene(type, rows, extra));
    expect(t[title].rows).toEqual([0, 1]);
    expect(t[title].entries[label]).toBe("5");
  });

  it("histogram binned — 같은 구간의 개수 2 + 3 = 5", () => {
    const t = targets(
      scene(
        "histogram",
        [
          { binStart: 0, binEnd: 1, count: 2 },
          { binStart: 0, binEnd: 1, count: 3 },
          { binStart: 1, binEnd: 2, count: 1 },
        ],
        { dataMode: "binned" },
      ),
    );
    expect(t["0 – 1"].rows).toEqual([0, 1]);
    expect(t["0 – 1"].entries.Count).toMatch(/^5 /);
  });
});

describe("ADR-312 G3 — 표본은 키가 겹치지 않는다 (표본 scene 전후 동일)", () => {
  it.each(CHART_DESCRIPTORS.map((d) => [d.paletteId, d] as const))(
    "%s",
    async (_, d) => {
      const props = (await completeChartCreationProps(
        createChartInitialProps(d.chartType, d.paletteId) as never,
      )) as unknown as ChartProps & { data: ChartRow[] };
      const resolved = resolveChartRoleDefaults(props, props.data);
      const out = applyChartRowPolicy(resolved, props.data);
      expect(out.sources).toBeNull();
      expect(out.rows).toBe(props.data);
    },
  );
});
