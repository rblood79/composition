/**
 * ADR-312 Phase 4 · G4 — 시리즈 표시 표 공통 (breakdown §2.5 · 본문 Decision 6 · F9).
 *
 * 색이 이름 붙은 항목을 가르는 종류가 `seriesConfig` 를 시리즈 경로와 같은 identity (`["group", 값]` ·
 * `["field", key]`) · 같은 규칙 (표의 항목이 앞 · 표의 이름 · 표의 색, 나머지는 출현 순서) 으로 읽는다. 기대 값은
 * fixture 와 표에서 손으로 정했다 (토큰 `--chart-series-N` = 팔레트 자리 N − 1).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { computeChartScene } from "../computeChartScene";
import { loadChartFamily } from "../families/registry";
import { seriesIdentity } from "../presentation";
import { chartSeriesItems, chartSeriesKind } from "../seriesItems";
import type {
  ChartFamilyId,
  ChartProps,
  ChartRow,
  ChartScene,
  ChartType,
} from "../types";

beforeAll(async () => {
  for (const id of [
    "kpi",
    "category",
    "distribution",
    "matrix",
  ] as ChartFamilyId[])
    await loadChartFamily(id);
});

const SIZE = { width: 520, height: 320 };
const scene = (
  chartType: ChartType,
  rows: ChartRow[],
  extra: Partial<ChartProps> = {},
): ChartScene =>
  computeChartScene(
    { chartType, showTooltip: true, showLegend: true, ...extra } as ChartProps,
    rows,
    SIZE,
  );
const group = (value: string) => seriesIdentity("group", value);
const field = (key: string) => seriesIdentity("field", key);
const legend = (s: ChartScene) =>
  (s.legend?.items ?? []).map((item) => ({
    label: item.label,
    color: item.seriesIndex,
    ...(item.swatch.fillPaint ? { paint: item.swatch.fillPaint } : {}),
  }));
const texts = (s: ChartScene): string[] =>
  JSON.stringify(s.marks)
    .match(/"text":"[^"]*"/g)!
    .map((t) => t.slice(8, -1));

describe("ADR-312 G4 — 적용 대상 표", () => {
  it("색 항목이 있는 종류는 모두 원천이 있다", () => {
    for (const type of [
      "bar",
      "line",
      "area",
      "pie",
      "radar",
      "radial",
      "scatter",
      "stream",
      "bump",
      "skyline",
      "marimekko",
      "segmented",
      "waffle",
      "dumbbell",
      "histogram",
      "slope",
      "parallel",
    ] as ChartType[])
      expect(chartSeriesKind(type), type).toBeDefined();
    for (const type of [
      "gauge",
      "lollipop",
      "heatmap",
      "treemap",
    ] as ChartType[])
      expect(chartSeriesKind(type), type).toBeUndefined();
  });
});

describe("ADR-312 G4 — family 가 표의 이름 · 색 · 순서를 읽는다", () => {
  it("marimekko — 계열 b 를 표 맨 앞 · 이름 「Bee」 · 색 5 (자리 4), a 는 출현 순서 자리 0", () => {
    const rows: ChartRow[] = [
      { category: "x", series: "a", value: 2 },
      { category: "x", series: "b", value: 3 },
      { category: "y", series: "a", value: 1 },
    ];
    const s = scene("marimekko", rows, {
      color: "series",
      seriesConfig: [
        { key: group("b"), label: "Bee", colorToken: "--chart-series-5" },
      ],
    });
    expect(legend(s)).toEqual([
      { label: "Bee", color: 4 },
      { label: "a", color: 0 },
    ]);
  });

  it("segmented — 표가 없으면 색은 출현 순서 (정렬 뒤 자리가 아니다), 표의 이름 · 색", () => {
    const rows: ChartRow[] = [
      { category: "A", value: 2 },
      { category: "B", value: 5 },
    ];
    // 내림차순 정렬로 B 가 앞이지만 색은 출현 순서: A = 0 · B = 1.
    const plain = scene("segmented", rows);
    const rects = plain.marks.filter((m) => m.kind === "rect") as {
      seriesIndex?: number;
    }[];
    expect(rects.map((r) => r.seriesIndex)).toEqual([1, 0]);
    const named = scene("segmented", rows, {
      seriesConfig: [
        { key: group("A"), label: "Alpha", colorToken: "--chart-series-3" },
      ],
    });
    expect(texts(named)).toContain("Alpha");
    const named2 = named.marks.filter((m) => m.kind === "rect") as {
      seriesIndex?: number;
    }[];
    expect(named2.map((r) => r.seriesIndex)).toEqual([1, 2]);
  });

  it("waffle — 표의 이름 · 색 (A = 「Alpha」 자리 2)", () => {
    const rows: ChartRow[] = [
      { category: "A", value: 2 },
      { category: "B", value: 5 },
    ];
    const s = scene("waffle", rows, {
      seriesConfig: [
        { key: group("A"), label: "Alpha", colorToken: "--chart-series-3" },
      ],
    });
    const json = JSON.stringify(s);
    expect(json).toContain("Alpha");
    const colors = new Set(
      (s.marks as { seriesIndex?: number; fillSeries?: number }[])
        .map((m) => m.seriesIndex ?? m.fillSeries)
        .filter((v) => v !== undefined),
    );
    expect(colors.has(2)).toBe(true);
  });

  it("dumbbell — 앞 값 열 「Before」 · 색 2 (자리 1), 뒤 값은 역할 칠 그대로", () => {
    const rows: ChartRow[] = [{ category: "A", start: 1, end: 4 }];
    const s = scene("dumbbell", rows, {
      seriesConfig: [
        {
          key: field("start"),
          label: "Before",
          colorToken: "--chart-series-2",
        },
      ],
    });
    expect(legend(s)).toEqual([
      { label: "Before", color: 1 },
      { label: "end", color: 0, paint: "accent" },
    ]);
    const dots = s.marks.filter((m) => m.kind === "path") as {
      fillSeries?: number;
      fillPaint?: string;
    }[];
    expect(dots[0]).toMatchObject({ fillSeries: 1 });
    expect(dots[1]).toMatchObject({ fillPaint: "accent" });
    expect(s.targets![0].entries[0]).toMatchObject({
      label: "Before",
      series: 1,
    });
  });

  it("histogram 묶음 — 묶음 이름 · 선 색 (b = 「Beta」 자리 3)", () => {
    const rows: ChartRow[] = [];
    for (let i = 0; i < 20; i++)
      rows.push({ value: i % 7, series: i % 2 ? "a" : "b" });
    const s = scene("histogram", rows, {
      seriesConfig: [
        { key: group("b"), label: "Beta", colorToken: "--chart-series-4" },
      ],
    });
    expect(s.targets![0].entries.map((e) => e.label)).toContain("Beta");
    expect(
      (s.marks as { strokeSeries?: number; fillSeries?: number }[]).some(
        (m) => m.strokeSeries === 3 || m.fillSeries === 3,
      ),
    ).toBe(true);
  });

  it("slope — 항목 이름 · 선 색 (a = 「Apple」 자리 4)", () => {
    const rows: ChartRow[] = [
      { category: "2023", series: "a", value: 1 },
      { category: "2024", series: "a", value: 4 },
      { category: "2023", series: "b", value: 2 },
      { category: "2024", series: "b", value: 3 },
    ];
    const s = scene("slope", rows, {
      seriesConfig: [
        { key: group("a"), label: "Apple", colorToken: "--chart-series-5" },
      ],
    });
    expect(texts(s).some((t) => t.includes("Apple"))).toBe(true);
    expect(s.targets!.map((t) => t.title)).toContain("Apple");
    expect(
      (s.marks as { strokeSeries?: number }[]).some(
        (m) => m.strokeSeries === 4,
      ),
    ).toBe(true);
  });

  it('parallel — 축 이름은 `["field", key]` 로 읽는다 (원 key 는 이제 읽지 않는다)', () => {
    const rows: ChartRow[] = [
      { speed: 1, cost: 2 },
      { speed: 3, cost: 1 },
    ];
    const props = { valueFields: ["speed", "cost"] };
    const named = scene("parallel", rows, {
      ...props,
      seriesConfig: [{ key: field("speed"), label: "Speed!" }],
    });
    expect(JSON.stringify(named)).toContain("Speed!");
  });
});

describe("ADR-312 G4 — 패널과 그림이 같은 목록", () => {
  it("chartSeriesItems — 표의 항목이 앞, 나머지는 출현 순서 · natural 은 표를 뺀다", () => {
    const rows: ChartRow[] = [
      { category: "A", value: 2 },
      { category: "B", value: 5 },
      { category: "C", value: 1 },
    ];
    const props = {
      chartType: "segmented",
      seriesConfig: [{ key: group("C"), label: "Sea" }],
    } as ChartProps;
    expect(
      chartSeriesItems(props, rows, 8).map((i) => [
        i.key,
        i.label,
        i.seriesIndex,
      ]),
    ).toEqual([
      ["C", "Sea", 2],
      ["A", undefined, 0],
      ["B", undefined, 1],
    ]);
    expect(
      chartSeriesItems(props, rows, 8, { natural: true }).map((i) => i.key),
    ).toEqual(["A", "B", "C"]);
  });

  it("잘못된 표는 시리즈 경로와 같은 진단 (`seriesConfig.invalid`)", () => {
    const diagnostics: never[] = [];
    chartSeriesItems(
      { chartType: "marimekko", seriesConfig: [{ key: "x" }] } as never,
      [{ category: "x", series: "a", value: 1 }],
      8,
      { diagnostics },
    );
    expect(diagnostics.map((d: { code: string }) => d.code)).toContain(
      "seriesConfig.invalid",
    );
  });
});
