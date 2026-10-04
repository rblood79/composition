/**
 * ADR-152 Phase 1b — 차트 dimension/metric/color 의 `#<fieldId>` 참조가 색인으로 행 key 를
 * 읽는다. key 참조 (v1) 와 같은 격자 · 미등록 id 는 빈 범주 · rename 재등록 뒤 유지.
 */
import { afterEach, describe, expect, it } from "vitest";
import { CHART_DEFAULT_PROPS } from "../authoring";
import { clearFieldIdIndex, registerFieldIds } from "../../data/fieldIdIndex";
import { buildSeriesGrid } from "../series";
import type { ChartProps, ChartRow } from "../types";

const ROWS: ChartRow[] = [
  { month: "Jan", value: 120, series: "desktop" },
  { month: "Feb", value: 40, series: "desktop" },
  { month: "Jan", value: 80, series: "mobile" },
];
const SCHEMA = [
  { id: "f-month", key: "month" },
  { id: "f-value", key: "value" },
  { id: "f-series", key: "series" },
];
const props = (o: Partial<ChartProps>): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  ...o,
});
const values = (grid: ReturnType<typeof buildSeriesGrid>) =>
  grid.series.map((s) => [s.key, [...s.values.entries()]]);

afterEach(() => clearFieldIdIndex());

describe("chart `#fieldId` 참조", () => {
  it("id 참조 격자 == key 참조 격자", () => {
    registerFieldIds(SCHEMA);
    const byKey = buildSeriesGrid(
      ROWS,
      props({ dimension: "month", metric: "value", color: "series" }),
      8,
    );
    const byId = buildSeriesGrid(
      ROWS,
      props({ dimension: "#f-month", metric: "#f-value", color: "#f-series" }),
      8,
    );
    expect(values(byId)).toEqual(values(byKey));
    expect(byId.categories).toEqual(byKey.categories);
  });

  it("rename (key 변경 + 행 migrate) 뒤 같은 `#id` 가 새 key 를 읽는다", () => {
    registerFieldIds([{ id: "f-month", key: "period" }, SCHEMA[1]]);
    const grid = buildSeriesGrid(
      ROWS.map(({ month, ...r }) => ({ ...r, period: month })),
      props({ dimension: "#f-month", metric: "#f-value" }),
      8,
    );
    expect(grid.categories).toEqual(["Jan", "Feb"]);
  });

  it("미등록 id 는 빈 범주 (throw 0)", () => {
    const grid = buildSeriesGrid(
      ROWS,
      props({ dimension: "#nope", metric: "value" }),
      8,
    );
    expect(grid.categories).toEqual([""]);
  });
});
