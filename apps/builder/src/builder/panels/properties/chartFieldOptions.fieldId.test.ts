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
        field("dataBinding", { source: "dataTable", collectionId: "c1", name: "Sales" }),
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
      [
        field("items", [{ a: 1, b: 2 }]),
        field("metric", "a"),
      ],
      [],
      LABELS,
    ).filter((f) => f.key === "metric");
    expect(metric.currentValue).toBe("a");
    expect(metric.options?.map((o) => o.value)).toEqual(["a", "b"]);
  });
});
