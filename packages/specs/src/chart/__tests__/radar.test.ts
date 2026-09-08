import { describe, expect, it } from "vitest";
import { buildRadarMarks } from "../marks/radar";
import { angleScale, radiusScale } from "../polar";
import { buildSeriesGrid } from "../series";
import { CHART_DEFAULT_PROPS, computeChartScene } from "../computeChartScene";
import type { ChartRow } from "../types";

const CENTER = { x: 100, y: 100, outer: 80, inner: 0 };

function gridOf(rows: ChartRow[], color?: string) {
  return buildSeriesGrid(
    rows,
    { dimension: "category", metric: "value", ...(color ? { color } : {}) },
    8,
  );
}

const ROWS: ChartRow[] = [
  { category: "A", value: 10, series: "s1" },
  { category: "B", value: 20, series: "s1" },
  { category: "C", value: 30, series: "s1" },
  { category: "A", value: 30, series: "s2" },
  { category: "B", value: 10, series: "s2" },
  { category: "C", value: 20, series: "s2" },
];

function build(rows = ROWS, opts: Partial<Parameters<typeof buildRadarMarks>[0]> = {}) {
  const grid = gridOf(rows, "series");
  return buildRadarMarks({
    grid,
    angle: angleScale(grid.categories.length),
    value: radiusScale([0, 30], [CENTER.inner, CENTER.outer]),
    center: CENTER,
    strokeWidth: 2,
    showValueLabels: false,
    fontSize: 11,
    ...opts,
  });
}

describe("buildRadarMarks", () => {
  it("시리즈당 닫힌 다각형 1개를 낸다", () => {
    const { marks } = build();
    expect(marks).toHaveLength(2);
    for (const mark of marks) {
      expect(mark.kind).toBe("path");
      expect(mark.d.endsWith("Z")).toBe(true);
      expect(mark.fillSeries).toBeDefined();
      expect(mark.strokeSeries).toBeDefined();
    }
  });

  it("꼭짓점이 각도 축과 같은 방향에 온다 (12시=0, 시계)", () => {
    // 값 30 = 바깥 반지름 80 → 12시 방향 첫 꼭짓점은 (100, 20)
    const { marks } = build([
      { category: "A", value: 30, series: "s1" },
      { category: "B", value: 0, series: "s1" },
      { category: "C", value: 0, series: "s1" },
    ]);
    expect(marks[0].d.startsWith("M 100 20")).toBe(true);
  });

  it("값 없는 범주는 subpath 를 나누지 않고 중심으로 접는다 (R3)", () => {
    const rows: ChartRow[] = [
      { category: "A", value: 30, series: "s1" },
      { category: "B", value: "n/a", series: "s1" },
      { category: "C", value: 30, series: "s1" },
    ];
    const { marks } = build(rows);
    // subpath 가 하나 (M 이 1번) 이고 꼭짓점 3개
    expect(marks[0].d.match(/M /g)).toHaveLength(1);
    expect(marks[0].d).toContain("L 100 100");
  });

  it("bbox 가 다각형을 덮는다 (컬링 상위집합)", () => {
    const { marks } = build();
    const box = marks[0].bbox;
    expect(box.x).toBeLessThanOrEqual(CENTER.x);
    expect(box.w).toBeGreaterThan(0);
    expect(box.h).toBeGreaterThan(0);
  });

  it("범주 3 미만이면 다각형이 없다 (선 하나는 도형이 아니다)", () => {
    const { marks } = build([
      { category: "A", value: 10, series: "s1" },
      { category: "B", value: 20, series: "s1" },
    ]);
    expect(marks).toHaveLength(0);
  });

  it("d 에 NaN/Infinity 가 없다 (G2)", () => {
    const rows: ChartRow[] = [
      { category: "A", value: Number.NaN, series: "s1" },
      { category: "B", value: -50, series: "s1" },
      { category: "C", value: 30, series: "s1" },
    ];
    const { marks } = build(rows);
    for (const mark of marks) {
      expect(mark.d).not.toMatch(/NaN|Infinity/);
    }
  });

  it("showValueLabels 면 꼭짓점마다 값 레이블", () => {
    const { labels } = build(ROWS, { showValueLabels: true });
    expect(labels.length).toBe(6);
    expect(labels[0].role).toBe("value");
  });

  it("결정성 — 같은 입력이면 같은 d", () => {
    expect(build().marks.map((m) => m.d)).toEqual(
      build().marks.map((m) => m.d),
    );
  });
});

describe("radar scene — R8 무시 계약 · G2 경계", () => {
  // 시리즈 2개 — `stackType` 무시 계약은 단일 시리즈에서 vacuous 하다
  //   (`grid.series.length > 1` 조건에 걸려 어차피 "none" 이 된다).
  const base = {
    ...CHART_DEFAULT_PROPS,
    chartType: "radar" as const,
    color: "series",
  };
  const size = { width: 300, height: 240 };
  const rows: ChartRow[] = ROWS;

  function scene(patch: Partial<typeof base> = {}) {
    return computeChartScene({ ...base, ...patch }, rows, size);
  }

  it.each([
    ["orientation", { orientation: "horizontal" as const }],
    ["curve", { curve: "monotone" as const }],
    ["colorBy", { colorBy: "category" as const }],
    ["stackType", { stackType: "stacked" as const }],
  ])("%s 는 radar 좌표를 바꾸지 않는다", (_name, patch) => {
    expect(scene(patch).marks).toEqual(scene().marks);
  });

  it("showDots 는 좌표를 바꾸지 않고 마크를 더한다", () => {
    // 시리즈 수만큼 점 마크가 붙는다 (시리즈당 1개 — dots.ts 의 subpath 규약).
    expect(scene({ showDots: true }).marks.length).toBe(
      scene().marks.length + 2,
    );
  });

  it.each([
    ["행 0", [] as ChartRow[], size],
    ["값 전부 비수치", [{ category: "A", value: "x" }], size],
    ["크기 0", rows, { width: 0, height: 0 }],
    ["단일 범주", [{ category: "A", value: 5 }], size],
  ])("경계 — %s 에서 유한한 좌표만 낸다", (_name, r, s) => {
    const out = computeChartScene(base, r as ChartRow[], s);
    const json = JSON.stringify(out);
    expect(json).not.toMatch(/NaN|Infinity|null,"y"/);
    for (const mark of out.marks) {
      if (mark.kind === "path") expect(mark.d).not.toMatch(/NaN|Infinity/);
    }
  });

  it("반지름 음수 0건 — 음수 값이 섞여도 bbox 가 중심 밖으로 안 뒤집힌다", () => {
    const out = computeChartScene(base, [
      { category: "A", value: -100 },
      { category: "B", value: 50 },
      { category: "C", value: 100 },
    ], size);
    for (const mark of out.marks) {
      if (mark.kind === "path") {
        expect(mark.bbox.w).toBeGreaterThanOrEqual(0);
        expect(mark.bbox.h).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("결정성 — 같은 입력이면 같은 scene", () => {
    expect(JSON.stringify(scene())).toBe(JSON.stringify(scene()));
  });

  it("gridType 이 격자 모양을 가른다 (원 격자는 A 명령)", () => {
    const polygon = scene({ showGrid: true, gridType: "polygon" });
    const circle = scene({ showGrid: true, gridType: "circle" });
    const radialAxis = (s: typeof polygon) =>
      s.axes.find((a) => a.axis === "radial");
    const pGrid = radialAxis(polygon)?.grid ?? [];
    const cGrid = radialAxis(circle)?.grid ?? [];
    expect(pGrid.length).toBeGreaterThan(0);
    expect(pGrid.length).toBe(cGrid.length);
    for (const g of pGrid) if (g.kind === "path") expect(g.d).not.toContain("A ");
    for (const g of cGrid) if (g.kind === "path") expect(g.d).toContain("A ");
  });

  it("범주 50 이면 각도 레이블을 솎아낸다 (R9)", () => {
    const many: ChartRow[] = Array.from({ length: 50 }, (_, i) => ({
      category: `category-${i}`,
      value: i + 1,
    }));
    const out = computeChartScene(base, many, size);
    const angular = out.axes.find((a) => a.axis === "angular");
    expect(angular?.grid.length).toBe(50);
    expect(angular!.ticks.length).toBeLessThan(50);
  });
});
