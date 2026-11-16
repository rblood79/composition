/**
 * ADR-212 Phase 3 — 필드 단위 역참조. 어떤 요소가 특정 필드를 참조하는가 (152 역참조의
 * 필드 세분): 바인딩 `fieldMap` (label/value/description/icon) · `columnMapping` 키 ·
 * `{field}` / `{#fieldId}` 템플릿 (문자열 prop 전수). collection 에 바인딩된 요소만 센다.
 */
import { describe, expect, it } from "vitest";
import type { DataTable } from "../../../../types/builder/data.types";
import { resolveFieldUsage, type UsageBearingElement } from "./fieldUsage";

const table: DataTable = {
  id: "c1",
  name: "Users",
  project_id: "p",
  schema: [
    { id: "f-id", key: "id", type: "string" },
    { id: "f-name", key: "name", type: "string" },
    { id: "f-email", key: "email", type: "email" },
  ],
  mockData: [],
  useMockData: true,
} as unknown as DataTable;

const bound = (
  id: string,
  extra: Record<string, unknown>,
): UsageBearingElement => ({
  id,
  type: "ListBox",
  props: {
    dataBinding: { source: "dataTable", collectionId: "c1", name: "Users" },
    ...extra,
  },
});

describe("resolveFieldUsage", () => {
  it("fieldMap 값이 field.id 또는 key 면 그 요소를 센다", () => {
    const els: UsageBearingElement[] = [
      bound("e1", {
        dataBinding: {
          source: "dataTable",
          collectionId: "c1",
          name: "Users",
          fieldMap: { value: "f-name" },
        },
      }),
      bound("e2", {
        dataBinding: {
          source: "dataTable",
          collectionId: "c1",
          name: "Users",
          fieldMap: { label: "name" },
        },
      }),
      bound("e3", {
        dataBinding: {
          source: "dataTable",
          collectionId: "c1",
          name: "Users",
          fieldMap: { value: "email" },
        },
      }),
    ];
    const usage = resolveFieldUsage(els, table, table.schema[1]); // name
    expect(usage.map((u) => u.id).sort()).toEqual(["e1", "e2"]);
    expect(usage[0].reason).toBe("fieldMap");
  });

  it("columnMapping 에 그 필드 key 가 있으면 센다 (차트 시리즈·테이블 열)", () => {
    const els = [
      bound("chart", {
        columnMapping: {
          name: { key: "name", type: "string" },
          email: { key: "email" },
        },
      }),
    ];
    expect(
      resolveFieldUsage(els, table, table.schema[1]).map((u) => u.id),
    ).toEqual(["chart"]);
    expect(
      resolveFieldUsage(els, table, table.schema[0]).map((u) => u.id),
    ).toEqual([]); // id 미참조
  });

  it("문자열 prop 의 {field} / {#fieldId} 템플릿을 센다", () => {
    const els = [
      bound("t1", { content: "Hi {name}, your email is {email}" }),
      bound("t2", { label: "id {#f-id}" }),
      bound("t3", { content: "no fields here" }),
    ];
    expect(
      resolveFieldUsage(els, table, table.schema[1]).map((u) => u.id),
    ).toEqual(["t1"]);
    expect(
      resolveFieldUsage(els, table, table.schema[0]).map((u) => u.id),
    ).toEqual(["t2"]);
    expect(
      resolveFieldUsage(els, table, table.schema[2]).map((u) => u.id),
    ).toEqual(["t1"]);
  });

  it("다른 collection 에 바인딩된 요소는 세지 않는다", () => {
    const els: UsageBearingElement[] = [
      {
        id: "other",
        type: "ListBox",
        props: {
          dataBinding: {
            source: "dataTable",
            collectionId: "c2",
            name: "Orders",
            fieldMap: { value: "name" },
          },
        },
      },
    ];
    expect(resolveFieldUsage(els, table, table.schema[1])).toEqual([]);
  });

  it("한 요소가 여러 축으로 참조해도 1회만 (첫 이유)", () => {
    const els = [
      bound("multi", {
        dataBinding: {
          source: "dataTable",
          collectionId: "c1",
          name: "Users",
          fieldMap: { value: "name" },
        },
        content: "{name}",
      }),
    ];
    const usage = resolveFieldUsage(els, table, table.schema[1]);
    expect(usage.length).toBe(1);
    expect(usage[0].id).toBe("multi");
  });

  it("바인딩 없이 columnMapping/템플릿만 있어도 센다 (바인딩 없는 텍스트 요소)", () => {
    const els: UsageBearingElement[] = [
      { id: "loose", type: "Text", props: { content: "{email}" } },
    ];
    expect(
      resolveFieldUsage(els, table, table.schema[2]).map((u) => u.id),
    ).toEqual(["loose"]);
  });

  it("중첩 문자열 (배열·객체 prop) 안의 템플릿도 스캔", () => {
    const els: UsageBearingElement[] = [
      {
        id: "nested",
        type: "Text",
        props: { items: [{ label: "{name}" }], meta: { title: "x" } },
      },
    ];
    expect(
      resolveFieldUsage(els, table, table.schema[1]).map((u) => u.id),
    ).toEqual(["nested"]);
  });

  // ADR-312 F11 — Phase 0 재현 (세 축 어디에도 들지 않음) → Phase 1 의 네 번째 축 (Chart 역할).
  it("ADR-312 F11 — 연결된 Chart 의 역할 prop 이 가리키는 필드는 사용처에 나온다 (`#id` · key · 목록 역할)", () => {
    const chart: UsageBearingElement = {
      ...bound("chart", { dimension: "#f-id", metric: "name" }),
      type: "lib:definition:Chart",
      componentType: "Chart",
    };
    const usage = (index: number) =>
      resolveFieldUsage([chart], table, table.schema[index]);
    expect(usage(0)).toEqual([
      { id: "chart", type: "lib:definition:Chart", reason: "chartRole" },
    ]);
    expect(usage(1).map((u) => u.reason)).toEqual(["chartRole"]);
    expect(usage(2)).toEqual([]);
    const list: UsageBearingElement = {
      ...bound("chart2", { valueFields: ["email"] }),
      componentType: "Chart",
    };
    expect(
      resolveFieldUsage([list], table, table.schema[2]).map((u) => u.id),
    ).toEqual(["chart2"]);
    // 연결하지 않은 Chart 의 역할은 표본 열을 가리킨다 — 세지 않는다
    const sample: UsageBearingElement = {
      id: "sample",
      componentType: "Chart",
      props: { metric: "name" },
    };
    expect(resolveFieldUsage([sample], table, table.schema[1])).toEqual([]);
  });
});
