/**
 * ADR-152 Phase 1b — Chart 매핑 Select 는 collection 필드를 `#<fieldId>` 로 저장하고 key 로
 * 표시한다. 구 형식 (key) 현재 값은 같은 필드의 `#id` 항목으로 접힌다.
 */
import { describe, expect, it } from "vitest";
import type { ResolvedField } from "@composition/shared";
import { buildChartSemanticFields } from "./chartFieldOptions";
import type { DataTable } from "../../../types/builder/data.types";

const table: DataTable = {
  id: "c1",
  name: "Sales",
  project_id: "p",
  schema: [
    { id: "f-month", key: "month", type: "string" },
    { id: "f-value", key: "value", type: "number" },
  ],
  mockData: [{ month: "Jan", value: 1 }],
  useMockData: true,
};
const field = (key: string, currentValue: unknown): ResolvedField => ({
  key,
  kind: "string",
  label: key,
  section: "content",
  origin: "semantic",
  isOverridden: true,
  baseValue: undefined,
  currentValue,
});
const LABELS = { none: "None", columnQualifier: "field" };

describe("buildChartSemanticFields — #fieldId 저장 · key 표시", () => {
  it("옵션 값은 #id, 라벨은 key; 구 형식 현재 값 (key) 은 #id 로 접힌다", () => {
    const [dimension] = buildChartSemanticFields(
      [
        field("dataBinding", {
          source: "dataTable",
          collectionId: "c1",
          name: "Sales",
        }),
        field("dimension", "month"),
      ],
      [table],
      LABELS,
    ).filter((f) => f.key === "dimension");
    expect(dimension.currentValue).toBe("#f-month");
    expect(dimension.options).toEqual([
      { value: "#f-month", label: "month" },
      { value: "#f-value", label: "value" },
    ]);
  });

  it("이미 #id 인 현재 값은 그대로, 정적 items 출처 (id 없음) 는 key 저장", () => {
    const [metric] = buildChartSemanticFields(
      [field("items", [{ a: 1, b: 2 }]), field("metric", "a")],
      [],
      LABELS,
    ).filter((f) => f.key === "metric");
    expect(metric.currentValue).toBe("a");
    expect(metric.options?.map((o) => o.value)).toEqual(["a", "b"]);
  });

  it("ADR-306 — 해제 항목은 종류의 선택 역할에만 (sparkline Category · bump Value 는 선택, bar 는 아님)", () => {
    const optionsOf = (chartType: string, key: string) =>
      buildChartSemanticFields(
        [
          field("chartType", chartType),
          field("items", [{ a: 1, b: 2 }]),
          field(key, "a"),
        ],
        [],
        LABELS,
      )
        .find((f) => f.key === key)!
        .options?.map((o) => o.value);
    expect(optionsOf("sparkline", "dimension")).toEqual(["", "a", "b"]);
    // ADR-312 — bump 의 첫 형태 (ranked) 에서 Rank 는 필수, histogram 의 Series 는 선택
    expect(optionsOf("bump", "rankField")).toEqual(["a", "b"]);
    expect(optionsOf("histogram", "color")).toEqual(["", "a", "b"]);
    expect(optionsOf("bar", "dimension")).toEqual(["a", "b"]);
    expect(optionsOf("bar", "color")).toEqual(["", "a", "b"]);
    expect(optionsOf("funnel", "dimension")).toEqual(["a", "b"]);
  });

  it("ADR-312 — 칸 라벨 · 해제 항목은 지금 형태의 역할에서 (scatter X · Y, slope 형태별, sparkline Category 선택)", () => {
    const build = (props: Record<string, unknown>, key: string) =>
      buildChartSemanticFields(
        [
          ...Object.entries(props).map(([k, v]) => field(k, v)),
          field(key, "a"),
        ],
        [],
        LABELS,
      ).find((f) => f.key === key)!;
    const items = { items: [{ a: 1, b: 2 }] };
    expect(build({ ...items, chartType: "scatter" }, "dimension").label).toBe(
      "X",
    );
    expect(build({ ...items, chartType: "scatter" }, "metric").label).toBe("Y");
    expect(build({ ...items, chartType: "bar" }, "dimension").label).toBe(
      "Category",
    );
    expect(build({ ...items, chartType: "slope" }, "dimension").label).toBe(
      "Period",
    );
    expect(
      build({ ...items, chartType: "slope", dataMode: "pair" }, "color").label,
    ).toBe("Item");
    // 해제 항목 ("") 은 선택 역할에만 — sparkline 의 Category 는 선택, bar 의 Category 는 필수
    const values = (props: Record<string, unknown>, key: string) =>
      (build({ ...items, ...props }, key).options ?? []).map((o) => o.value);
    expect(values({ chartType: "sparkline" }, "dimension")[0]).toBe("");
    expect(values({ chartType: "bar" }, "dimension")[0]).toBe("a");
  });

  it("ADR-312 F3 — 표본 행 편집기 칸 = 지금 형태의 역할이 가리키는 열 + 행에만 있는 열", () => {
    const dataField = {
      ...field("data", [{ category: "a", start: 1, end: 2, note: "x" }]),
      kind: "items-manager",
      itemsManager: {
        itemsKey: "data",
        itemTypeName: "ChartRow",
        defaultItem: { category: "New", value: 0, series: "A" },
        itemSchema: [
          { key: "category", type: "string", label: "Category" },
          { key: "value", type: "string", label: "Value" },
          { key: "series", type: "string", label: "Series" },
        ],
        labelKey: "category",
      },
    } as unknown as ResolvedField;
    const [data] = buildChartSemanticFields(
      [field("chartType", "dumbbell"), dataField],
      [],
      LABELS,
    ).filter((f) => f.key === "data");
    expect(data.itemsManager?.itemSchema.map((c) => [c.key, c.label])).toEqual([
      ["category", "Category"],
      ["start", "Start"],
      ["end", "End"],
      ["note", "note"],
    ]);
    expect(data.itemsManager?.defaultItem).toEqual({
      category: "New",
      start: 0,
      end: 0,
      note: "New",
    });
  });

  it("ADR-312 F14 — 원천 열 (보기 결과 schema) 이 있으면 그것이 선택지 — 집계 열은 key 로", () => {
    const [metric] = buildChartSemanticFields(
      [
        field("dataBinding", {
          source: "dataTable",
          collectionId: "c1",
          name: "Sales",
        }),
        field("metric", "total"),
      ],
      [table],
      LABELS,
      [{ key: "month", id: "f-month" }, { key: "total" }],
    ).filter((f) => f.key === "metric");
    expect(metric.options?.map((o) => o.value)).toEqual(["total", "#f-month"]);
  });
});

