/**
 * ADR-312 Phase 5 live — Data 패널에서 만든 표 (Sales: region · product · month · sales · cost · units) 에 36 종을
 * 연결해 찾은 결함 셋의 회귀 (사용자 요청 2026-11-17 「모든 차트를 data 패널에서 생성한 table 에 collection
 * 방식으로 연동해서 테스트」).
 * 1. 산점도 X 가 「아무 형」 이라 연결 때 첫 글자 열 (`region`) 을 받아 점이 없었다 (기본 x 축은 숫자).
 * 2. 시리즈 격자 columns 의 시리즈 이름이 저장된 참조 (`#id`) 그대로라 skyline 범례에 id 글자가 그려졌다.
 * 3. 선택 키 역할이 어느 행에도 없는 열을 가리키면 모든 행이 한 항목으로 합쳐졌다 (sparkline 810 하나) —
 *    그런 선택 역할은 역할 값 풀기 (`resolveChartRoleDefaults`) 가 해제로 읽는다 (모든 consumer 공통).
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { clearFieldIdIndex, registerFieldIds } from "../../data/fieldIdIndex";
import { createChartInitialProps } from "../authoring";
import { computeChartScene } from "../computeChartScene";
import { applyChartRowPolicy } from "../families/rowPolicy";
import { loadChartFamily } from "../families/registry";
import {
  reconcileChartRoles,
  resolveChartRoleDefaults,
  validateChartRoles,
} from "../roles";
import { buildSeriesGrid } from "../series";
import type { ChartProps, ChartRow } from "../types";

const COLUMNS = [
  { key: "region", id: "f-region", type: "string" as const },
  { key: "product", id: "f-product", type: "string" as const },
  { key: "month", id: "f-month", type: "date" as const },
  { key: "sales", id: "f-sales", type: "number" as const },
  { key: "cost", id: "f-cost", type: "number" as const },
  { key: "units", id: "f-units", type: "number" as const },
];
const ROWS: ChartRow[] = [
  {
    region: "Seoul",
    product: "A",
    month: "2026-01-01",
    sales: 120,
    cost: 80,
    units: 12,
  },
  {
    region: "Busan",
    product: "B",
    month: "2026-02-01",
    sales: 70,
    cost: 50,
    units: 7,
  },
  {
    region: "Seoul",
    product: "B",
    month: "2026-03-01",
    sales: 90,
    cost: 60,
    units: 9,
  },
];

beforeAll(async () => {
  await loadChartFamily("category");
});
afterEach(() => clearFieldIdIndex());

describe("ADR-312 live — Sales 표 연결", () => {
  it("산점도 연결 — X 는 숫자 열 (sales), Y 는 다음 숫자 열 (cost)", () => {
    const patch = reconcileChartRoles({
      props: { chartType: "scatter", dimension: "category", metric: "value" },
      columns: COLUMNS,
    });
    expect(patch).toMatchObject({ dimension: "#f-sales", metric: "#f-cost" });
  });

  it("산점도 시간 축이면 X 는 날짜 열 · 날짜 열에 숫자 경고 없음", () => {
    const props = {
      chartType: "scatter",
      dimensionScale: "time",
      dimension: "category",
      metric: "value",
    } as ChartProps;
    expect(reconcileChartRoles({ props, columns: COLUMNS })).toMatchObject({
      dimension: "#f-month",
    });
    expect(
      validateChartRoles(
        { ...props, dimension: "month", metric: "sales" },
        ROWS,
      ),
    ).toEqual([]);
  });

  it("columns 시리즈 — 이름은 필드 key, identity 는 저장 참조 (`#id`)", () => {
    registerFieldIds(COLUMNS);
    const grid = buildSeriesGrid(
      ROWS,
      {
        dimension: "#f-region",
        metric: "",
        color: "",
        dataMode: "columns",
        valueFields: ["#f-sales", "#f-cost"],
      },
      8,
    );
    expect(grid.series.map((s) => s.key)).toEqual(["sales", "cost"]);
    expect(grid.series.map((s) => s.id)).toEqual([
      '["field","#f-sales"]',
      '["field","#f-cost"]',
    ]);
    // 값도 그대로 읽힌다 — Seoul sales 120 + 90.
    expect(grid.series[0].values.get(0)).toBe(210);
  });

  it("skyline (columns) 범례에 id 글자가 없다", () => {
    registerFieldIds(COLUMNS);
    const scene = computeChartScene(
      {
        chartType: "skyline",
        showLegend: true,
        dimension: "#f-region",
        dataMode: "columns",
        valueFields: ["#f-sales", "#f-cost"],
      } as ChartProps,
      ROWS,
      { width: 520, height: 320 },
    );
    const labels = (scene.legend?.items ?? []).map((i) => i.label);
    expect(labels).toEqual(["sales", "cost"]);
  });

  it("선택 키 역할이 없는 열 — 해제로 읽고 묶지 않는다 (sparkline 의 `dimension: category`)", () => {
    const props = resolveChartRoleDefaults(
      {
        chartType: "sparkline",
        dimension: "category",
        metric: "sales",
      } as ChartProps,
      ROWS,
    );
    expect(props.dimension).toBe("");
    expect(applyChartRowPolicy(props, ROWS).sources).toBeNull();
    // 있는 열은 그대로, 필수 역할은 건드리지 않는다.
    expect(
      resolveChartRoleDefaults(
        {
          chartType: "sparkline",
          dimension: "region",
          metric: "missing",
        } as ChartProps,
        ROWS,
      ),
    ).toMatchObject({ dimension: "region", metric: "missing" });
  });
});

describe("ADR-312 live — 다시 연결하면 형이 틀린 지정을 고친다", () => {
  it("글자 열을 가리키는 산점도 X (`#f-region`) → 숫자 열", () => {
    expect(
      reconcileChartRoles({
        props: {
          chartType: "scatter",
          dimension: "#f-region",
          metric: "#f-sales",
        },
        columns: COLUMNS,
      }),
    ).toEqual({ dimension: "#f-cost" });
  });
});

describe("ADR-312 live — 원본 template 은 역할 값을 들지 않는다", () => {
  it("생성 props 에 dimension · metric · color 가 없다 (연결한 원천에 없는 열을 물려주지 않는다)", () => {
    for (const type of [
      undefined,
      "bar",
      "pie",
      "scatter",
      "sparkline",
    ] as const) {
      const props = createChartInitialProps(type) as Record<string, unknown>;
      expect([props.dimension, props.metric, props.color]).toEqual([
        undefined,
        undefined,
        undefined,
      ]);
    }
  });
});
