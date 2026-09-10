/**
 * ADR-210 P1 / G1 — columns 모드 공통 모델 (T01 · T02 · T03 · T04 · T05 · T08).
 *
 * 기대값은 원시 표의 손계산이다 (`120+80`, `100+20` …). wide 와 long 은 **같은
 * grid** 를 내야 하고 (Decision B — columns 는 기존 grid 모델의 입력 확장), 순서·
 * 이름·색은 identity 로 회복되며, expand 의 값 라벨은 raw 다 (h1).
 */
import { describe, expect, it } from "vitest";
import {
  CHART_DEFAULT_PROPS,
  CHART_INVALID_SETTINGS_TEXT,
  computeChartScene,
} from "../computeChartScene";
import { seriesIdentity } from "../presentation";
import { resolveChartData } from "../runtimeData";
import { buildSeriesGrid, seriesLabel, stackBands } from "../series";
import type { ChartProps, ChartRow, RectMark, TextMark } from "../types";

const SIZE = { width: 320, height: 240 };
const WIDE: ChartRow[] = [
  { month: "Jan", desktop: 120, mobile: 80 },
  { month: "Feb", desktop: 40, mobile: 10 },
];
const LONG: ChartRow[] = [
  { month: "Jan", value: 120, series: "desktop" },
  { month: "Feb", value: 40, series: "desktop" },
  { month: "Jan", value: 80, series: "mobile" },
  { month: "Feb", value: 10, series: "mobile" },
];
const F = (key: string) => seriesIdentity("field", key);
const G = (key: string) => seriesIdentity("group", key);

const columns = (o: Partial<ChartProps> = {}): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  dimension: "month",
  metric: "",
  dataMode: "columns",
  valueFields: ["desktop", "mobile"],
  ...o,
});
const group = (o: Partial<ChartProps> = {}): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  dimension: "month",
  metric: "value",
  color: "series",
  ...o,
});
const values = (grid: ReturnType<typeof buildSeriesGrid>) =>
  grid.series.map((s) => [s.key, [...s.values.entries()]]);
const marksOf = (props: ChartProps, rows: ChartRow[]) =>
  computeChartScene(props, rows, SIZE).marks.filter(
    (m) => m.kind === "rect" || m.kind === "path",
  );
const valueLabels = (props: ChartProps, rows: ChartRow[]) =>
  computeChartScene(props, rows, SIZE)
    .marks.filter((m): m is TextMark => m.kind === "text" && m.role === "value")
    .map((t) => t.text);
// 값 축 눈금만 (`buildAxes` 는 [범주 축, 값 축] 순 — 범주 레이블도 role "tick" 이다).
const axisTicks = (props: ChartProps, rows: ChartRow[]) =>
  computeChartScene(props, rows, SIZE)
    .axes[1].ticks.filter((t) => t.role === "tick")
    .map((t) => t.text);

describe("T01 — wide(columns) 와 long(group) 은 같은 grid·같은 마크를 낸다", () => {
  it("grid: desktop 120/40 · mobile 80/10, 시리즈 순서 = valueFields 순서", () => {
    const wide = buildSeriesGrid(WIDE, columns(), 8);
    const long = buildSeriesGrid(LONG, group(), 8);
    expect(values(wide)).toEqual([
      [
        "desktop",
        [
          [0, 120],
          [1, 40],
        ],
      ],
      [
        "mobile",
        [
          [0, 80],
          [1, 10],
        ],
      ],
    ]);
    expect(values(long)).toEqual(values(wide));
    expect(wide.categories).toEqual(long.categories);
    expect(wide.series.map((s) => s.seriesIndex)).toEqual([0, 1]);
    // identity 만 다르다 — 원천이 다르므로 (field vs group).
    expect(wide.series.map((s) => s.id)).toEqual([F("desktop"), F("mobile")]);
    expect(long.series.map((s) => s.id)).toEqual([G("desktop"), G("mobile")]);
  });

  it("마크 기하가 4종 × stack 3종에서 동일하다 (columns 는 새 기하가 아니다)", () => {
    for (const chartType of ["bar", "line", "area", "radar"] as const) {
      for (const stackType of ["dodged", "stacked", "expand"] as const) {
        const w = marksOf(columns({ chartType, stackType }), WIDE);
        const l = marksOf(group({ chartType, stackType }), LONG);
        expect(w, `${chartType}/${stackType}`).toEqual(l);
      }
    }
  });

  it("runtime 모델도 같다 (내부 dataKey series0/1, raw 값)", () => {
    const w = resolveChartData(WIDE, columns({ chartType: "bar" }), 8);
    const l = resolveChartData(LONG, group({ chartType: "bar" }), 8);
    expect(w.rows).toEqual(l.rows);
    expect(w.keys).toEqual(["series0", "series1"]);
    expect(w.presentation.dataMode).toBe("columns");
    expect(w.presentation.ok).toBe(true);
  });
});

describe("T02 — 중복 합산·결측·0·음수", () => {
  const rows: ChartRow[] = [
    { month: "Jan", desktop: 100, mobile: null },
    { month: "Jan", desktop: 20, mobile: "n/a" },
    { month: "Feb", desktop: 0, mobile: -5 },
    { month: "Mar", desktop: "7", mobile: undefined },
  ];
  it("같은 범주는 합산 (100+20=120), null/비수치는 결측 (0 이 아니다), 실제 0 은 0, 숫자 문자열은 숫자", () => {
    const grid = buildSeriesGrid(rows, columns(), 8);
    expect(grid.categories).toEqual(["Jan", "Feb", "Mar"]);
    expect(values(grid)).toEqual([
      [
        "desktop",
        [
          [0, 120],
          [1, 0],
          [2, 7],
        ],
      ],
      ["mobile", [[1, -5]]],
    ]);
  });

  it("stacked/expand/dodged 가 4종에서 유한한 기하를 낸다 — 음수는 0 아래로, expand 는 |값| 합 기준", () => {
    const grid = buildSeriesGrid(rows, columns(), 8);
    expect(stackBands(grid, 1, "stacked").map((b) => [b.from, b.to])).toEqual([
      [0, 0],
      [-5, 0],
    ]);
    expect(stackBands(grid, 0, "expand").map((b) => [b.from, b.to])).toEqual([
      [0, 100],
    ]);
    for (const chartType of ["bar", "line", "area", "radar"] as const) {
      for (const stackType of ["dodged", "stacked", "expand"] as const) {
        const scene = computeChartScene(
          columns({ chartType, stackType }),
          rows,
          SIZE,
        );
        expect(scene.empty, `${chartType}/${stackType}`).toBe(false);
        for (const mark of scene.marks) {
          if (mark.kind === "path") expect(mark.d).not.toMatch(/NaN|undefined/);
          if (mark.kind === "rect") {
            for (const v of [mark.x, mark.y, mark.w, mark.h])
              expect(Number.isFinite(v)).toBe(true);
          }
        }
      }
    }
  });

  it("범주만 있고 유효값이 없으면 empty (설정 오류가 아니라 데이터 없음)", () => {
    const scene = computeChartScene(
      columns(),
      [{ month: "Jan", desktop: "x" }],
      SIZE,
    );
    expect(scene.empty).toBe(true);
    expect(scene.marks[0]).toMatchObject({ role: "empty", text: "No data" });
    expect(scene.diagnostics).toBeUndefined();
  });
});

describe("T03 — 원본 key/identity 보존 (reset · series0 · a.b · 빈 이름 · 따옴표 · 숫자1/문자열1)", () => {
  it("필드 이름이 내부 dataKey 와 겹쳐도 (series0/category) 충돌 없이 값을 읽는다", () => {
    const rows: ChartRow[] = [
      { category: "Jan", series0: 1, series1: 2, categoryIndex: 99, reset: 3 },
      { category: "Feb", series0: 4, series1: 5, categoryIndex: 99, reset: 6 },
    ];
    const props = columns({
      dimension: "category",
      valueFields: ["series1", "series0", "reset"],
    });
    const model = resolveChartData(rows, props, 8);
    expect(model.keys).toEqual(["series0", "series1", "series2"]);
    // 내부 series0 = 원본 series1 (valueFields 순서) — 원본 필드명이 내부 키를 덮지 않는다.
    expect(model.rows).toEqual([
      { category: "Jan", categoryIndex: 0, series0: 2, series1: 1, series2: 3 },
      { category: "Feb", categoryIndex: 1, series0: 5, series1: 4, series2: 6 },
    ]);
    expect(model.grid.series.map((s) => s.key)).toEqual([
      "series1",
      "series0",
      "reset",
    ]);
  });

  it("점이 든 필드 `a.b` 는 경로가 아니라 literal key 다", () => {
    const rows: ChartRow[] = [{ month: "Jan", "a.b": 5, a: { b: 999 } }];
    const grid = buildSeriesGrid(rows, columns({ valueFields: ["a.b"] }), 8);
    expect(values(grid)).toEqual([["a.b", [[0, 5]]]]);
  });

  it("빈 필드 이름·따옴표·같은 표시명은 identity 가 갈린다; 표시명은 원본 키를 대체하지 않는다", () => {
    const rows: ChartRow[] = [{ month: "Jan", "": 1, 'q"x': 2, other: 3 }];
    const grid = buildSeriesGrid(
      rows,
      columns({
        valueFields: ["", 'q"x', "other"],
        seriesConfig: [
          { key: F('q"x'), label: "Same" },
          { key: F("other"), label: "Same" },
        ],
      }),
      8,
    );
    // 빈 이름 필드는 readField 가 undefined 로 취급 — 값 없음 (기존 `!key` 방어 유지).
    expect(grid.series.map((s) => [s.id, seriesLabel(s, "series")])).toEqual([
      [F('q"x'), "Same"],
      [F("other"), "Same"],
      [F(""), "series"],
    ]);
    expect(grid.series.map((s) => s.key)).toEqual(['q"x', "other", ""]);
  });

  it('group 의 숫자 1 과 문자열 "1" 은 기존대로 한 시리즈로 합쳐진다 (문자열화 유지)', () => {
    const rows: ChartRow[] = [
      { month: "Jan", value: 10, series: 1 },
      { month: "Jan", value: 5, series: "1" },
    ];
    const grid = buildSeriesGrid(rows, group(), 8);
    expect(values(grid)).toEqual([["1", [[0, 15]]]]);
    expect(grid.series[0].id).toBe(G("1"));
  });
});

describe("T04 — 순서·이름·색 회복, 휴면 보존, 왕복", () => {
  const cfg = [
    { key: F("mobile"), label: "Mobile", colorToken: "--chart-series-5" },
    { key: F("desktop"), label: "Desktop" },
  ];

  it("seriesConfig 순서가 표시 순서다 — stack 누적·dodge 슬롯·legend·tooltip 모두", () => {
    const props = columns({
      seriesConfig: cfg,
      chartType: "bar",
      stackType: "stacked",
      showLegend: true,
      showTooltip: true,
      showAxis: false,
    });
    const grid = buildSeriesGrid(WIDE, props, 8);
    expect(grid.series.map((s) => s.key)).toEqual(["mobile", "desktop"]);
    // 누적: mobile 이 아래 (0→80), desktop 이 위 (80→200).
    expect(
      stackBands(grid, 0, "stacked").map((b) => [b.series.key, b.from, b.to]),
    ).toEqual([
      ["mobile", 0, 80],
      ["desktop", 80, 200],
    ]);
    const scene = computeChartScene(props, WIDE, SIZE);
    expect(
      scene.legend?.items.map((i) => [i.text.text, i.seriesIndex]),
    ).toEqual([
      ["Mobile", 4],
      ["Desktop", 0],
    ]);
    expect(
      scene.tooltip?.bands[0].entries.map((e) => [
        e.label,
        e.colorIndex,
        e.text,
      ]),
    ).toEqual([
      ["Mobile", 4, "80"],
      ["Desktop", 0, "120"],
    ]);
    // dodge 슬롯: 첫 막대 (x 가 작은 쪽) 가 mobile.
    const dodged = computeChartScene(
      columns({ seriesConfig: cfg, chartType: "bar", showAxis: false }),
      WIDE,
      SIZE,
    ).marks.filter((m): m is RectMark => m.kind === "rect");
    expect(dodged[0].seriesIndex).toBe(4);
    expect(dodged[1].seriesIndex).toBe(0);
    expect(dodged[0].x).toBeLessThan(dodged[1].x);
  });

  it("config 만 재정렬하면 미지정 색은 그대로 (팔레트 인덱스는 정렬 전 순서)", () => {
    const reordered = buildSeriesGrid(
      WIDE,
      columns({ seriesConfig: [{ key: F("mobile") }, { key: F("desktop") }] }),
      8,
    );
    expect(reordered.series.map((s) => [s.key, s.seriesIndex])).toEqual([
      ["mobile", 1],
      ["desktop", 0],
    ]);
    // valueFields 자체를 바꾸면 미지정 색은 달라진다 (문서대로).
    const swapped = buildSeriesGrid(
      WIDE,
      columns({ valueFields: ["mobile", "desktop"] }),
      8,
    );
    expect(swapped.series.map((s) => [s.key, s.seriesIndex])).toEqual([
      ["mobile", 0],
      ["desktop", 1],
    ]);
  });

  it("행 순서를 뒤집어도 columns 의 시리즈 순서·색은 valueFields 가 정한다 (group 은 출현 순)", () => {
    const reversed = [...WIDE].reverse();
    const grid = buildSeriesGrid(reversed, columns(), 8);
    expect(grid.categories).toEqual(["Feb", "Jan"]);
    expect(grid.series.map((s) => [s.key, s.seriesIndex])).toEqual([
      ["desktop", 0],
      ["mobile", 1],
    ]);
    const longReversed = buildSeriesGrid([...LONG].reverse(), group(), 8);
    expect(longReversed.series.map((s) => [s.key, s.seriesIndex])).toEqual([
      ["mobile", 0],
      ["desktop", 1],
    ]);
  });

  it("필드 삭제 → 휴면, 재추가 → 같은 identity 로 이름/색/순서 회복. 원본 rows·config write 0", () => {
    const rows = WIDE.map((r) => ({ ...r }));
    const config = cfg.map((c) => ({ ...c }));
    const removed = buildSeriesGrid(
      rows,
      columns({ valueFields: ["desktop"], seriesConfig: config }),
      8,
    );
    expect(
      removed.series.map((s) => [
        s.key,
        seriesLabel(s, "series"),
        s.seriesIndex,
      ]),
    ).toEqual([["desktop", "Desktop", 0]]);
    const restored = buildSeriesGrid(
      rows,
      columns({ valueFields: ["desktop", "mobile"], seriesConfig: config }),
      8,
    );
    expect(
      restored.series.map((s) => [
        s.key,
        seriesLabel(s, "series"),
        s.seriesIndex,
      ]),
    ).toEqual([
      ["mobile", "Mobile", 4],
      ["desktop", "Desktop", 0],
    ]);
    expect(rows).toEqual(WIDE);
    expect(config).toEqual(cfg);
  });

  it("group ↔ columns 왕복: dataMode 만 바꾸면 legacy metric/color 와 휴면 config 가 각자 보존된다", () => {
    const both: ChartRow[] = [
      { month: "Jan", value: 1, series: "A", desktop: 120, mobile: 80 },
      { month: "Jan", value: 2, series: "B", desktop: 0, mobile: 0 },
    ];
    const props = columns({
      metric: "value",
      color: "series",
      seriesConfig: [
        { key: G("B"), label: "Group B" },
        { key: F("mobile"), label: "Mobile" },
      ],
    });
    const asColumns = buildSeriesGrid(both, props, 8);
    expect(
      asColumns.series.map((s) => [s.key, seriesLabel(s, "series")]),
    ).toEqual([
      ["mobile", "Mobile"],
      ["desktop", "desktop"],
    ]);
    const asGroup = buildSeriesGrid(both, { ...props, dataMode: "group" }, 8);
    expect(
      asGroup.series.map((s) => [s.key, seriesLabel(s, "series")]),
    ).toEqual([
      ["B", "Group B"],
      ["A", "A"],
    ]);
    expect(values(asGroup)).toEqual([
      ["B", [[0, 2]]],
      ["A", [[0, 1]]],
    ]);
  });

  it("빈 문자열 label 은 legend/tooltip 에 빈 이름으로 나간다 (기본 이름으로 되돌리지 않는다)", () => {
    const scene = computeChartScene(
      columns({
        seriesConfig: [{ key: F("desktop"), label: "" }],
        showLegend: true,
        showTooltip: true,
      }),
      WIDE,
      SIZE,
    );
    expect(scene.legend?.items.map((i) => i.text.text)).toEqual(["", "mobile"]);
    expect(scene.tooltip?.bands[0].entries.map((e) => e.label)).toEqual([
      "",
      "mobile",
    ]);
  });
});

describe("T05 — 형식은 raw 에만, expand 축은 %, 기하 불변", () => {
  it("currency: 값 라벨·tooltip 은 raw $120.00, expand 축은 0%~100%, 기하 60/40", () => {
    const props = columns({
      chartType: "bar",
      stackType: "expand",
      showValueLabels: true,
      showTooltip: true,
      valueFormat: "currency",
      valueCurrency: "USD",
    });
    expect(valueLabels(props, WIDE).sort()).toEqual([
      "$10.00",
      "$120.00",
      "$40.00",
      "$80.00",
    ]);
    expect(axisTicks(props, WIDE)).toEqual([
      "0%",
      "20%",
      "40%",
      "60%",
      "80%",
      "100%",
    ]);
    const scene = computeChartScene(props, WIDE, SIZE);
    expect(scene.tooltip?.bands[0].entries.map((e) => e.text)).toEqual([
      "$120.00",
      "$80.00",
    ]);
    // 기하는 형식과 무관 — 축 여백 (눈금 문자열 폭) 을 빼면 auto 와 좌표가 같다.
    //   여백은 문자열 길이에서 오므로 "100%" 가 "100" 보다 plot 을 조금 줄인다 — 그것은
    //   마크 비율 (60/40) 이 아니라 자리 계산이다.
    const noAxis = { ...props, showAxis: false };
    expect(marksOf(noAxis, WIDE)).toEqual(
      marksOf({ ...noAxis, valueFormat: undefined, valueCurrency: undefined }, WIDE),
    );
    const model = resolveChartData(WIDE, props, 8);
    expect(model.bands[0].get(0)).toEqual({ from: 0, to: 60 });
    expect(model.bands[1].get(0)).toEqual({ from: 60, to: 100 });
  });

  it("percent ratio: raw 0.25 축/라벨은 25%, 명시 2자리면 25.00%; stacked 축은 raw 단위 %", () => {
    const rows: ChartRow[] = [{ month: "Jan", a: 0.25, b: 0.5 }];
    const props = columns({
      valueFields: ["a", "b"],
      chartType: "bar",
      stackType: "stacked",
      showValueLabels: true,
      valueFormat: "percent",
      valuePercentUnit: "ratio",
    });
    expect(valueLabels(props, rows).sort()).toEqual(["25%", "50%"]);
    expect(axisTicks(props, rows)).toEqual(["0%", "20%", "40%", "60%", "80%"]);
    expect(
      valueLabels({ ...props, valueFractionDigits: 2 }, rows).sort(),
    ).toEqual(["25.00%", "50.00%"]);
    const points = columns({ ...props, valuePercentUnit: "percentagePoints" });
    expect(
      valueLabels(points, [{ month: "Jan", a: 25, b: 50 }]).sort(),
    ).toEqual(["25%", "50%"]);
  });

  it("auto/미설정은 기존 문자열 그대로 — expand 축에 % 를 소급하지 않는다 (group 도 동일)", () => {
    const props = group({
      chartType: "bar",
      stackType: "expand",
      showValueLabels: true,
    });
    expect(valueLabels(props, LONG).sort()).toEqual(["10", "120", "40", "80"]);
    expect(axisTicks(props, LONG)).toEqual([
      "0",
      "20",
      "40",
      "60",
      "80",
      "100",
    ]);
  });

  it("decimal ko-KR 1234.5 는 '1,234.5' — locale 는 표시 옵션이고 축 domain 은 같다", () => {
    const rows: ChartRow[] = [{ month: "Jan", a: 1234.5 }];
    const en = computeChartScene(
      columns({
        valueFields: ["a"],
        showValueLabels: true,
        valueFormat: "decimal",
      }),
      rows,
      SIZE,
    );
    const ko = computeChartScene(
      columns({
        valueFields: ["a"],
        showValueLabels: true,
        valueFormat: "decimal",
        valueLocale: "ko-KR",
      }),
      rows,
      SIZE,
    );
    const label = (s: typeof en) =>
      s.marks
        .filter((m): m is TextMark => m.kind === "text" && m.role === "value")
        .map((t) => t.text);
    expect(label(en)).toEqual(["1,234.5"]);
    expect(label(ko)).toEqual(["1,234.5"]);
    expect(en.plot).toEqual(ko.plot);
  });

  it("pie/radial 의 도넛 합계도 raw 형식이다 (통화)", () => {
    const rows: ChartRow[] = [
      { month: "Jan", value: 120 },
      { month: "Feb", value: 80 },
    ];
    const scene = computeChartScene(
      {
        ...CHART_DEFAULT_PROPS,
        dimension: "month",
        metric: "value",
        chartType: "pie",
        innerRadius: 60,
        showTotal: true,
        valueFormat: "currency",
        valueCurrency: "KRW",
      },
      rows,
      SIZE,
    );
    const texts = scene.marks
      .filter((m): m is TextMark => m.kind === "text")
      .map((t) => t.text);
    expect(texts).toContain("₩200");
  });
});

describe("T08 — 설정 오류 상태: 데이터 보존, 안내 텍스트, 임의 fallback 0", () => {
  it("columns + 빈 valueFields → 설정 안내 scene (legacy metric 으로 그리지 않는다)", () => {
    const props = columns({ valueFields: [], metric: "desktop" });
    const scene = computeChartScene(props, WIDE, SIZE);
    expect(scene.empty).toBe(true);
    expect(scene.marks).toHaveLength(1);
    expect(scene.marks[0]).toMatchObject({
      role: "empty",
      text: CHART_INVALID_SETTINGS_TEXT,
    });
    expect(scene.diagnostics?.map((d) => d.code)).toEqual([
      "valueFields.empty",
    ]);
    // 같은 rows 를 legacy metric 으로 읽으면 그림이 있다 — 즉 위 empty 는 fallback 을 막은 결과다.
    expect(
      computeChartScene({ ...props, dataMode: "group" }, WIDE, SIZE).empty,
    ).toBe(false);
  });

  it("columns + pie/radial import → unsupported, 모델의 grid 는 보존", () => {
    const props = columns({ chartType: "pie" });
    const scene = computeChartScene(props, WIDE, SIZE);
    expect(scene.empty).toBe(true);
    expect(scene.diagnostics?.[0]).toMatchObject({
      code: "columns.unsupportedChartType",
      severity: "error",
    });
    const model = resolveChartData(WIDE, props, 8);
    expect(model.presentation.ok).toBe(false);
    expect(model.grid.series.map((s) => s.key)).toEqual(["desktop", "mobile"]);
    expect(model.rows[0]).toMatchObject({ series0: 120, series1: 80 });
  });

  it("source 재연결로 필드가 사라지면 값 없는 시리즈로 남고 (누락 표시 가능) 다른 metric 으로 몰래 대체하지 않는다", () => {
    const reconnected: ChartRow[] = [
      { month: "Jan", desktop: 120, visitors: 999 },
    ];
    const grid = buildSeriesGrid(reconnected, columns(), 8);
    expect(values(grid)).toEqual([
      ["desktop", [[0, 120]]],
      ["mobile", []],
    ]);
    const scene = computeChartScene(
      columns({ showLegend: true }),
      reconnected,
      SIZE,
    );
    expect(scene.empty).toBe(false);
    expect(scene.legend?.items.map((i) => i.text.text)).toEqual([
      "desktop",
      "mobile",
    ]);
  });

  it("warning 만 있으면 그리고 진단을 scene 에 싣는다 (중복 필드 first-wins)", () => {
    const scene = computeChartScene(
      columns({ valueFields: ["desktop", "desktop", "mobile"] }),
      WIDE,
      SIZE,
    );
    expect(scene.empty).toBe(false);
    expect(scene.diagnostics?.map((d) => `${d.severity}:${d.code}`)).toEqual([
      "warning:valueFields.duplicate",
    ]);
    expect(scene.legend).toBeNull();
    expect(
      marksOf(columns({ valueFields: ["desktop", "desktop", "mobile"] }), WIDE),
    ).toEqual(marksOf(columns(), WIDE));
  });

  it("currency 미지정 import → 설정 오류 (다른 형식으로 몰래 렌더하지 않는다)", () => {
    const scene = computeChartScene(
      columns({ valueFormat: "currency" }),
      WIDE,
      SIZE,
    );
    expect(scene.empty).toBe(true);
    expect(scene.diagnostics?.[0].code).toBe("valueCurrency.missing");
  });
});
