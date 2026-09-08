import { describe, expect, it } from "vitest";
import { CHART_DEFAULT_PROPS, computeChartScene } from "../computeChartScene";
import { buildRadialMarks } from "../marks/radial";
import { buildSeriesGrid } from "../series";
import { hitTooltipBand } from "../tooltip";
import type { ChartRow } from "../types";

const CENTER = { x: 100, y: 100, outer: 90, inner: 20 };

const ROWS: ChartRow[] = [
  { category: "A", value: 60 },
  { category: "B", value: 30 },
  { category: "C", value: 90 },
];

function build(rows = ROWS, patch: Partial<Parameters<typeof buildRadialMarks>[0]> = {}) {
  const grid = buildSeriesGrid(
    rows,
    { dimension: "category", metric: "value" },
    8,
  );
  return buildRadialMarks({
    grid,
    center: CENTER,
    domain: [0, 100],
    seriesCount: 8,
    stackMode: "none",
    showValueLabels: false,
    fontSize: 11,
    ...patch,
  });
}

describe("buildRadialMarks", () => {
  it("범주당 트랙 호 + 값 호 2겹을 낸다", () => {
    const { marks } = build();
    // 3 범주 × (트랙 + 값) = 6
    expect(marks).toHaveLength(6);
    const tracks = marks.filter((m) => m.role === "grid");
    expect(tracks).toHaveLength(3);
  });

  it("링은 바깥에서 안쪽으로 쌓인다 — 첫 범주가 가장 바깥", () => {
    const { rings } = build();
    expect(rings[0].outer).toBeGreaterThan(rings[1].outer);
    expect(rings[2].inner).toBeGreaterThanOrEqual(CENTER.inner);
  });

  it("값이 domain 상한이면 한 바퀴, 절반이면 180도", () => {
    const { rings } = build([{ category: "A", value: 50 }]);
    expect(rings[0].slices[0].sweep).toBeCloseTo(180, 5);
  });

  it("값 없는 범주는 트랙만 남기고 값 호를 안 그린다", () => {
    const { marks } = build([
      { category: "A", value: 50 },
      { category: "B", value: "x" },
    ]);
    expect(marks.filter((m) => m.role === "grid")).toHaveLength(2);
    expect(marks.filter((m) => m.role === undefined)).toHaveLength(1);
  });

  it("누적 — 같은 링에서 시리즈가 각도로 이어 붙는다", () => {
    const rows: ChartRow[] = [
      { category: "A", value: 30, series: "s1" },
      { category: "A", value: 20, series: "s2" },
    ];
    const grid = buildSeriesGrid(
      rows,
      { dimension: "category", metric: "value", color: "series" },
      8,
    );
    const { rings } = buildRadialMarks({
      grid,
      center: CENTER,
      domain: [0, 100],
      seriesCount: 8,
      stackMode: "stacked",
      showValueLabels: false,
      fontSize: 11,
    });
    const slices = rings[0].slices;
    expect(slices).toHaveLength(2);
    expect(slices[0].start).toBeCloseTo(0, 5);
    expect(slices[1].start).toBeCloseTo(slices[0].start + slices[0].sweep, 5);
  });

  it("d 에 NaN/Infinity 가 없다 (G2)", () => {
    const { marks } = build([
      { category: "A", value: Number.NaN },
      { category: "B", value: -40 },
      { category: "C", value: 100 },
    ]);
    for (const mark of marks) expect(mark.d).not.toMatch(/NaN|Infinity/);
  });

  it("범주 0개면 마크 0", () => {
    expect(build([]).marks).toHaveLength(0);
  });
});

describe("radial scene — R8 무시 계약 · G2 경계", () => {
  const base = { ...CHART_DEFAULT_PROPS, chartType: "radial" as const };
  const size = { width: 300, height: 240 };

  function scene(patch: Partial<typeof base> = {}) {
    return computeChartScene({ ...base, ...patch }, ROWS, size);
  }

  it.each([
    ["orientation", { orientation: "horizontal" as const }],
    ["curve", { curve: "step" as const }],
    ["showDots", { showDots: true }],
    ["gridType", { gridType: "circle" as const }],
  ])("%s 는 radial 좌표를 바꾸지 않는다", (_name, patch) => {
    expect(scene(patch).marks).toEqual(scene().marks);
  });

  it("radial 은 극좌표 축을 그리지 않는다 (트랙이 격자 노릇)", () => {
    expect(scene({ showGrid: true }).axes).toEqual([]);
  });

  it.each([
    ["행 0", [] as ChartRow[], size],
    ["값 전부 비수치", [{ category: "A", value: "x" }], size],
    ["크기 0", ROWS, { width: 0, height: 0 }],
    ["단일 범주", [{ category: "A", value: 5 }], size],
  ])("경계 — %s 에서 유한한 좌표만 낸다", (_name, r, s) => {
    const out = computeChartScene(base, r as ChartRow[], s);
    for (const mark of out.marks) {
      if (mark.kind === "path") expect(mark.d).not.toMatch(/NaN|Infinity/);
    }
  });

  it("결정성 — 같은 입력이면 같은 scene", () => {
    expect(JSON.stringify(scene())).toBe(JSON.stringify(scene()));
  });
});

describe("극좌표 툴팁", () => {
  const size = { width: 300, height: 240 };

  it("radial — 링 하나가 밴드 하나이고 히트가 반지름으로 갈린다", () => {
    const scene = computeChartScene(
      { ...CHART_DEFAULT_PROPS, chartType: "radial", showTooltip: true },
      ROWS,
      size,
    );
    const tip = scene.tooltip!;
    expect(tip.bands).toHaveLength(3);
    for (const band of tip.bands) expect(band.ring).toBeDefined();

    // 바깥 링 한가운데를 찍으면 첫 범주가 나온다 (각도는 무관 — 반지름이 가른다).
    const c = tip.center!;
    const outerBand = tip.bands[0].ring!;
    const r = (outerBand.inner + outerBand.outer) / 2;
    expect(hitTooltipBand(tip, c.x, c.y - r)?.categoryIndex).toBe(0);
    expect(hitTooltipBand(tip, c.x + r, c.y)?.categoryIndex).toBe(0);

    // 안쪽 링을 찍으면 마지막 범주
    const innerBand = tip.bands[2].ring!;
    const ri = (innerBand.inner + innerBand.outer) / 2;
    expect(hitTooltipBand(tip, c.x, c.y - ri)?.categoryIndex).toBe(2);
  });

  it("radar — 범주 부채꼴 하나에 시리즈 전부가 실린다", () => {
    const rows: ChartRow[] = [
      { category: "A", value: 10, series: "s1" },
      { category: "B", value: 20, series: "s1" },
      { category: "C", value: 30, series: "s1" },
      { category: "A", value: 5, series: "s2" },
      { category: "B", value: 15, series: "s2" },
      { category: "C", value: 25, series: "s2" },
    ];
    const scene = computeChartScene(
      {
        ...CHART_DEFAULT_PROPS,
        chartType: "radar",
        color: "series",
        showTooltip: true,
      },
      rows,
      size,
    );
    const tip = scene.tooltip!;
    expect(tip.bands).toHaveLength(3);
    expect(tip.bands[0].entries).toHaveLength(2);
    // 12시 방향(첫 범주) 을 찍으면 A
    const c = tip.center!;
    const hit = hitTooltipBand(tip, c.x, c.y - (c.outer + c.inner) / 2);
    expect(hit?.label).toBe("A");
  });

  it("showTooltip=false 면 tooltip 은 null (Skia 는 정적)", () => {
    const scene = computeChartScene(
      { ...CHART_DEFAULT_PROPS, chartType: "radial" },
      ROWS,
      size,
    );
    expect(scene.tooltip).toBeNull();
  });
});
