/**
 * ADR-306 Phase 5 G4 — 기존 9 항목 보강 (breakdown §2.1) 손계산 + 두 consumer 공용 builder.
 *
 * 값은 손으로 푼 것이다:
 * - 표본 합: Mon 12 + 20 = 32 · Tue 30 + 8 = 38 · Wed 18 + 25 = 43 · Thu 24 + 14 = 38 → bar 내림차순
 *   [Wed, Tue, Thu, Mon] (같은 합 Tue · Thu 는 원래 순서).
 * - pie 오름차순 (크기 — 절대값): A 만 [12, 30, 18, 24] → [Mon, Wed, Thu, Tue].
 * - 값 축: 데이터 [8, 30] — 0 포함이 기본 (domain [0, 30]). `includeZero: false` 면 0 이 빠져 하한 > 0.
 *   `valueMax: 100` → 축 끝 100 (데이터 30 ≤ 100). `valueMax: 20` (< 30) 은 데이터를 자르지 않아 무시.
 *   `valueMin: -20` → 하한 −20.
 * - 크기 점: size 최댓값 150 → 반지름 rMax 18, √(15 / 150) × 18 = 5.69 (rMin 3 보다 크다).
 */
import { describe, expect, it } from "vitest";
import { applyWindow } from "../budget";
import {
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
  computeChartScene,
} from "../computeChartScene";
import { chartValueTicks } from "../layout";
import { resolveChartModel } from "../model";
import { buildSeriesGrid } from "../series";
import type { ChartProps, ChartRow, Mark, PathMark, TextMark } from "../types";

const ROWS: ChartRow[] = [
  { category: "Mon", value: 12, series: "A" },
  { category: "Tue", value: 30, series: "A" },
  { category: "Wed", value: 18, series: "A" },
  { category: "Thu", value: 24, series: "A" },
  { category: "Mon", value: 20, series: "B" },
  { category: "Tue", value: 8, series: "B" },
  { category: "Wed", value: 25, series: "B" },
  { category: "Thu", value: 14, series: "B" },
];
const SIZE = { width: 480, height: 300 };
const props = (patch: Partial<ChartProps>): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  color: "series",
  ...patch,
});
const model = (patch: Partial<ChartProps>, rows = ROWS) =>
  resolveChartModel(rows, props(patch), {
    size: SIZE,
    metrics: CHART_DEFAULT_METRICS,
  });
const scene = (patch: Partial<ChartProps>, rows = ROWS) =>
  computeChartScene(props(patch), rows, SIZE, CHART_DEFAULT_METRICS);
const texts = (marks: readonly Mark[]) =>
  marks.filter((m): m is TextMark => m.kind === "text");
const paths = (marks: readonly Mark[]) =>
  marks.filter((m): m is PathMark => m.kind === "path");

describe("ADR-306 §2.1 — 정렬 (bar · pie)", () => {
  it("bar sort descending → [Wed, Tue, Thu, Mon] (같은 합은 원래 순서) · none 은 데이터 순서", () => {
    expect(
      model({ chartType: "bar", sort: "descending" }).input.categories,
    ).toEqual(["Wed", "Tue", "Thu", "Mon"]);
    expect(
      model({ chartType: "bar", sort: "ascending" }).input.categories,
    ).toEqual(["Mon", "Tue", "Thu", "Wed"]);
    expect(model({ chartType: "bar" }).input.categories).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
    ]);
  });

  it("pie sort ascending 은 크기 순 — 시리즈 값도 같이 옮긴다", () => {
    const rows = ROWS.filter((r) => r.series === "A");
    const m = model({ chartType: "pie", sort: "ascending" }, rows);
    expect(m.input.categories).toEqual(["Mon", "Wed", "Thu", "Tue"]);
    expect([...m.input.series[0].values.entries()].sort()).toEqual([
      [0, 12],
      [1, 18],
      [2, 24],
      [3, 30],
    ]);
  });

  it("line 은 sort 를 읽지 않는다 (descriptor 옵션 표와 같다)", () => {
    expect(
      model({ chartType: "line", sort: "descending" }).input.categories,
    ).toEqual(["Mon", "Tue", "Wed", "Thu"]);
  });
});

describe("ADR-306 §2.1 — 값 축 (0 포함 · 하한 · 상한)", () => {
  const grid = (chartType: ChartProps["chartType"]) =>
    buildSeriesGrid(ROWS, props({ chartType }), 8);
  it("line — 기본 0 포함 [0, 30], includeZero false 면 하한 > 0", () => {
    expect(
      chartValueTicks(props({ chartType: "line" }), grid("line"), "none")
        .domain,
    ).toEqual([0, 30]);
    const d = chartValueTicks(
      props({ chartType: "line", includeZero: false }),
      grid("line"),
      "none",
    ).domain;
    expect(d[0]).toBeGreaterThan(0);
    expect(d[0]).toBeLessThanOrEqual(8);
  });

  it("valueMax 100 → 축 끝 100 · 끝 눈금도 100 · valueMax 20 (< 데이터 30) 은 무시", () => {
    const t = chartValueTicks(
      props({ chartType: "line", valueMax: 100 }),
      grid("line"),
      "none",
    );
    expect(t.domain).toEqual([0, 100]);
    expect(t.ticks[t.ticks.length - 1]).toBe(100);
    expect(
      chartValueTicks(
        props({ chartType: "line", valueMax: 20 }),
        grid("line"),
        "none",
      ).domain,
    ).toEqual([0, 30]);
  });

  it("valueMin −20 → 하한 −20 · bar 는 valueMin 을 읽지 않는다", () => {
    expect(
      chartValueTicks(
        props({ chartType: "area", valueMin: -20 }),
        grid("area"),
        "none",
      ).domain[0],
    ).toBe(-20);
    expect(
      chartValueTicks(
        props({ chartType: "bar", valueMin: -20 }),
        grid("bar"),
        "none",
      ).domain[0],
    ).toBe(0);
  });

  it("valueMin 5 (> 0, ≤ 데이터 최소 8) → 하한 5 — 0 포함보다 우선 · 10 (> 8) 은 데이터를 자르니 무시 (판독)", () => {
    expect(
      chartValueTicks(
        props({ chartType: "line", valueMin: 5 }),
        grid("line"),
        "none",
      ).domain,
    ).toEqual([5, 30]);
    expect(
      chartValueTicks(
        props({ chartType: "line", valueMin: 10 }),
        grid("line"),
        "none",
      ).domain,
    ).toEqual([0, 30]);
  });

  it("radial · radar valueMax 100 → domain [0, 100] (scene 의 극좌표도 같은 함수)", () => {
    for (const chartType of ["radial", "radar"] as const)
      expect(
        chartValueTicks(
          props({ chartType, valueMax: 100 }),
          grid(chartType),
          "none",
        ).domain,
        chartType,
      ).toEqual([0, 100]);
  });

  it("includeZero false 인 area 의 바닥은 축 안 (0 이 축 밖이면 축 끝)", () => {
    const s = scene({
      chartType: "area",
      includeZero: false,
      color: undefined,
    });
    for (const p of paths(s.marks))
      expect(p.bbox.y + p.bbox.h).toBeLessThanOrEqual(
        s.plot.y + s.plot.h + 0.01,
      );
  });
});

describe("ADR-306 §2.1 — line · area 보강", () => {
  const gap: ChartRow[] = [
    { category: "Mon", value: 12 },
    { category: "Tue", value: null },
    { category: "Wed", value: 18 },
    { category: "Thu", value: 24 },
  ];
  it("connectNulls — 값 없는 범주에서 끊기 (M 둘) vs 잇기 (M 하나)", () => {
    const subpaths = (patch: Partial<ChartProps>) =>
      (
        paths(
          scene({ chartType: "line", color: undefined, ...patch }, gap).marks,
        )[0].d.match(/M/g) ?? []
      ).length;
    expect(subpaths({})).toBe(2);
    expect(subpaths({ connectNulls: true })).toBe(1);
  });

  it("범위 띠 — 아래 · 위 경계 필드 → 시리즈 색 0.18 면 · 축이 위 경계를 덮는다", () => {
    const rows = ROWS.filter((r) => r.series === "A").map((r) => ({
      ...r,
      lo: Number(r.value) - 5,
      hi: Number(r.value) + 60,
    }));
    const s = scene(
      {
        chartType: "line",
        color: undefined,
        lowerFields: ["lo"],
        upperFields: ["hi"],
      },
      rows,
    );
    const band = paths(s.marks).find((p) => p.fillOpacity === 0.18);
    expect(band?.fillSeries).toBe(0);
    // 위 경계 최댓값 90 이 축 안 — 띠 위 끝이 plot 위로 나가지 않는다.
    const m = model(
      {
        chartType: "line",
        color: undefined,
        lowerFields: ["lo"],
        upperFields: ["hi"],
      },
      rows,
    );
    expect(m.ticks.domain[1]).toBeGreaterThanOrEqual(90);
    // 누적이면 그리지 않는다 (ztd 와 같음).
    expect(
      paths(
        scene(
          {
            chartType: "area",
            stackType: "stacked",
            lowerFields: ["lo"],
            upperFields: ["hi"],
          },
          [...rows, ...ROWS.filter((r) => r.series === "B")],
        ).marks,
      ).some((p) => p.fillOpacity === 0.18),
    ).toBe(false);
  });

  it("endLabels — 시리즈 이름이 그림 오른쪽 · 그림 폭이 그만큼 줄어든다", () => {
    const off = scene({ chartType: "line" });
    const on = scene({ chartType: "line", endLabels: true });
    expect(on.plot.w).toBeLessThan(off.plot.w);
    const names = texts(on.marks).filter((t) => t.role === "legend");
    expect(names.map((t) => t.text).sort()).toEqual(["A", "B"]);
    for (const t of names)
      expect(t.x).toBeCloseTo(on.plot.x + on.plot.w + 6, 1);
  });
});

describe("ADR-306 §2.1 — 산점도 보강 (bubble · scatter)", () => {
  const pts: ChartRow[] = [
    { x: 1, y: 2, size: 15, name: "a" },
    { x: 2, y: 4, size: 150, name: "b" },
    { x: 3, y: 5, size: 60, name: "c" },
    { x: 4, y: 9, size: 30, name: "d" },
  ];
  const base = {
    chartType: "scatter" as const,
    dimension: "x",
    metric: "y",
    color: undefined,
  };
  const radii = (d: string) =>
    [...d.matchAll(/A (\d+(?:\.\d+)?) /g)].map((m) => Number(m[1]));

  it("sizeField — 가장 큰 값이 rMax 18 · 15 → √(15/150)×18 = 5.69", () => {
    const s = scene({ ...base, sizeField: "size" }, pts);
    const dots = paths(s.marks);
    expect(dots).toHaveLength(1);
    const r = radii(dots[0].d);
    expect(Math.max(...r)).toBe(18);
    expect(r).toContain(5.69);
    expect(dots[0].fillOpacity).toBe(0.75);
  });

  it("크기 점은 상자 안 — 축 끝의 큰 점도 그림 상자를 넘지 않는다 (live 에서 발견)", () => {
    const s = scene({ ...base, sizeField: "size" }, pts);
    const box = paths(s.marks)[0].bbox;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.w).toBeLessThanOrEqual(SIZE.width);
    expect(box.y + box.h).toBeLessThanOrEqual(SIZE.height);
    // 그림이 가장 큰 반지름 (18) 만큼 안으로 — 크기 없는 산점도보다 좁다.
    // (크기 열이 있어도 `sizeField: ""` 는 해제 — ADR-312 기본 열 이름 읽기 밖)
    expect(s.plot.w).toBeLessThan(
      scene({ ...base, sizeField: "" }, pts).plot.w - 30,
    );
  });

  it("작은 상자 (Library 칸 140 × 78) — 큰 반지름이 그림 짧은 변의 1/8 로 줄고 점이 상자 안", () => {
    const small = { width: 140, height: 78 };
    const s = computeChartScene(
      props({ ...base, sizeField: "size" }),
      pts,
      small,
      CHART_DEFAULT_METRICS,
    );
    const dot = paths(s.marks)[0];
    // 그림 높이 < 78 → 큰 반지름 ≤ 78 / 8 (기본 18 이 아니다).
    expect(Math.max(...radii(dot.d))).toBeLessThanOrEqual(small.height / 8);
    expect(dot.bbox.x).toBeGreaterThanOrEqual(0);
    expect(dot.bbox.y).toBeGreaterThanOrEqual(0);
    expect(dot.bbox.x + dot.bbox.w).toBeLessThanOrEqual(small.width);
    expect(dot.bbox.y + dot.bbox.h).toBeLessThanOrEqual(small.height);
  });

  it("sizeRange [4, 10] → 가장 큰 반지름 10 · 범위가 글자여도 (패널 목록 칸)", () => {
    const s = scene(
      { ...base, sizeField: "size", sizeRange: ["4", "10"] },
      pts,
    );
    expect(Math.max(...radii(paths(s.marks)[0].d))).toBe(10);
  });

  it("labelField — 점 이름 4 개 · 크기 없이도", () => {
    const s = scene({ ...base, labelField: "name" }, pts);
    expect(
      texts(s.marks)
        .map((t) => t.text)
        .sort(),
    ).toEqual(["a", "b", "c", "d"]);
  });

  it("fit linear — 증가 추세 (화면 y 가 위로) · 점의 x 범위 안", () => {
    const s = scene({ ...base, fit: "linear" }, pts);
    const fit = s.marks.find(
      (m) => m.kind === "line" && m.role === "reference",
    );
    expect(fit?.kind).toBe("line");
    if (fit?.kind !== "line") return;
    expect(fit.y2).toBeLessThan(fit.y1);
    expect(fit.x2).toBeGreaterThan(fit.x1);
  });

  it("quadrants — 파선 둘 + 칸 이름", () => {
    const s = scene(
      {
        ...base,
        quadrants: ["Low x High y", "High both", "Low both", "High x Low y"],
      },
      pts,
    );
    const dashed = s.marks.filter((m) => m.kind === "line" && m.dash);
    expect(dashed).toHaveLength(2);
    expect(texts(s.marks).some((t) => t.text === "High both")).toBe(true);
  });

  it("보조 값은 창 자르기를 따라 옮긴다 (범주 인덱스 0 부터 다시)", () => {
    const grid = buildSeriesGrid(
      pts,
      props({ ...base, sizeField: "size" }),
      8,
      undefined,
    );
    const win = applyWindow(grid, { start: 1, end: 3 } as never);
    expect([...(win.series[0].extras?.size?.entries() ?? [])]).toEqual([
      [0, 150],
      [1, 60],
    ]);
  });
});

describe("ADR-306 §2.1 — donut 가운데 이름", () => {
  const pie = { chartType: "pie" as const, innerRadius: 60, color: undefined };
  const rows = ROWS.filter((r) => r.series === "A");
  it("합계를 끈 도넛 — centerLabel 한 줄 · 합계를 켜면 합계 아래 설명", () => {
    expect(
      texts(scene({ ...pie, centerLabel: "Total" }, rows).marks).map(
        (t) => t.text,
      ),
    ).toContain("Total");
    const total = texts(
      scene({ ...pie, centerLabel: "Visits", showTotal: true }, rows).marks,
    ).map((t) => t.text);
    expect(total).toContain("Visits");
    expect(total).toContain("84");
  });
});
