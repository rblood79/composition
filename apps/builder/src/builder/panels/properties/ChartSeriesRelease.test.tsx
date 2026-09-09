/**
 * ADR-209 후속 F0/F1 — Series 해제와 원본 키 보존.
 *
 * 옵션은 **실제 패널이 호출하는 생산자**(`buildChartSemanticFields`)를 통과시키고, 그 입력인
 * 편집 계약도 canonical store 에 시드한 노드로 실제 `resolveEditContract` 를 통과시킨다.
 * 합성 옵션 배열을 `GenericFieldRenderer` 에 직접 넘긴 결과는 이 게이트의 증거가 아니다.
 */
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChartInitialProps } from "@composition/specs";
import { resolveEditContract } from "@composition/shared";

import { I18nProvider } from "@/i18n";
import type { DataTable } from "@/types/builder/data.types";
import {
  resetPanelFixture,
  seedPanelElements,
} from "../../__tests__/panelFixture";
import {
  getCanonicalNode,
  getActiveCanonicalDocument,
} from "../../stores/canonical/canonicalElementsBridge";
import { useDataStore } from "../../stores/data";
import { buildChartSemanticFields } from "./chartFieldOptions";
import { GenericFieldRenderer } from "./generic/GenericFieldRenderer";

const COLUMN_TABLE: DataTable = {
  id: "table-review-m1",
  name: "review-m1",
  project_id: "panel-fixture-test-project",
  schema: [
    { key: "category", type: "string" },
    { key: "value", type: "number" },
    { key: "series", type: "string" },
  ],
  mockData: [{ category: "Jan", value: 10, series: "A" }],
  useMockData: true,
};

function seedCollections(tables: DataTable[]): void {
  useDataStore.setState({
    collections: new Map(tables.map((table) => [table.name, table])),
  } as never);
}

/** 저장 위치를 top-level 로만 둔 Chart — canonical 변환이 `x-composition.dataBinding` 에 싣는다. */
function seedExtensionOnlyChart(overrides: Record<string, unknown> = {}): void {
  seedPanelElements([
    {
      id: "chart",
      type: "Chart",
      props: {
        ...createChartInitialProps("bar"),
        dimension: "category",
        metric: "value",
        color: "series",
        ...overrides,
      },
      dataBinding: { source: "dataTable", name: "review-m1" } as never,
      parent_id: null,
      page_id: "page-1",
    },
  ]);
}

/** 패널이 넘기는 것과 같은 ko 라벨 (`chart.none` / `chart.columnQualifier`). */
const KO_LABELS = { none: "없음", columnQualifier: "필드" };

function chartFields(
  labels: { none: string; columnQualifier: string } = KO_LABELS,
): ReturnType<typeof buildChartSemanticFields> {
  const node = getCanonicalNode("chart");
  if (!node) throw new Error("canonical node 미시드");
  const contract = resolveEditContract(node, getActiveCanonicalDocument());
  return buildChartSemanticFields(
    contract.fields.filter((field) => field.origin === "semantic"),
    Array.from(useDataStore.getState().collections.values()),
    labels,
  );
}

beforeEach(() => {
  resetPanelFixture();
  seedCollections([COLUMN_TABLE]);
});
afterEach(() => {
  cleanup();
  resetPanelFixture();
  seedCollections([]);
  vi.restoreAllMocks();
});

describe("F0 — 편집 계약의 binding 입력 채널", () => {
  it("extension 에만 있는 binding 도 편집 계약과 옵션 생산자에 도달한다", () => {
    seedExtensionOnlyChart();
    const node = getCanonicalNode("chart")!;
    // 전제: 저장 위치가 extension 하나뿐이다.
    expect(
      (node as { "x-composition"?: { dataBinding?: unknown } })["x-composition"]
        ?.dataBinding,
    ).toEqual({ source: "dataTable", name: "review-m1" });
    expect(Object.hasOwn(node.props ?? {}, "dataBinding")).toBe(false);

    const contract = resolveEditContract(node, getActiveCanonicalDocument());
    expect(
      contract.fields.find((field) => field.key === "dataBinding")
        ?.currentValue,
    ).toEqual({ source: "dataTable", name: "review-m1" });

    // schema 가 있으므로 컬럼 Select 가 기대 결과다 — 문자열 입력 fallback 은 실패다.
    const series = chartFields().find((field) => field.key === "color")!;
    expect(series.kind).toBe("enum");
    expect(series.options?.map((option) => option.value)).toContain("series");
  });
});

describe("F0 — Series 해제 항목", () => {
  it("연결된 Series 옵션의 첫 항목이 해제(빈 값)다", () => {
    seedExtensionOnlyChart();
    const series = chartFields().find((field) => field.key === "color")!;
    expect(series.options?.[0]).toEqual({ value: "", label: "없음" });
    expect(series.options?.map((option) => option.value)).toEqual([
      "",
      "series",
      "category",
      "value",
    ]);
  });

  it("Category/Value 에는 해제 항목을 새로 추가하지 않는다", () => {
    seedExtensionOnlyChart();
    const fields = chartFields();
    for (const key of ["dimension", "metric"]) {
      const field = fields.find((f) => f.key === key)!;
      expect(field.options?.some((option) => option.value === "")).toBe(false);
    }
  });
});

describe("F0 — 원본 키 `reset`", () => {
  it("컬럼명 `reset` 을 선택하면 저장 값이 `reset` 이다", () => {
    seedCollections([
      {
        ...COLUMN_TABLE,
        schema: [
          { key: "category", type: "string" },
          { key: "reset", type: "string" },
        ],
      },
    ]);
    seedExtensionOnlyChart({ color: "" });
    const update = vi.fn();
    const ui = render(
      <I18nProvider initialLocale="ko-KR">
        <GenericFieldRenderer
          fields={chartFields()}
          elementId="chart"
          literalOptionFields={["dimension", "metric", "color"]}
          onSemanticUpdate={update}
          onStyleUpdate={vi.fn()}
        />
      </I18nProvider>,
    );
    const group = ui.getByRole("group", { name: "시리즈" });
    fireEvent.click(within(group).getByRole("button"));
    fireEvent.click(ui.getByRole("option", { name: "reset" }));
    expect(update).toHaveBeenCalledWith("color", "reset");
  });

  it("None 선택은 빈 문자열을 저장한다", () => {
    seedExtensionOnlyChart();
    const update = vi.fn();
    const ui = render(
      <I18nProvider initialLocale="ko-KR">
        <GenericFieldRenderer
          fields={chartFields()}
          elementId="chart"
          literalOptionFields={["dimension", "metric", "color"]}
          onSemanticUpdate={update}
          onStyleUpdate={vi.fn()}
        />
      </I18nProvider>,
    );
    const group = ui.getByRole("group", { name: "시리즈" });
    fireEvent.click(within(group).getByRole("button"));
    fireEvent.click(ui.getByRole("option", { name: "없음" }));
    expect(update).toHaveBeenCalledWith("color", "");
  });
});

describe("F1 — 원본 키·라벨 충돌 (T2)", () => {
  it("한글·예약어·UI key 형태의 컬럼명이 옵션 값으로 손실 없이 실린다", () => {
    const raw = ["범주", "reset", 'value:""', "Series"];
    seedCollections([
      {
        ...COLUMN_TABLE,
        schema: raw.map((key) => ({ key, type: "string" as const })),
      },
    ]);
    seedExtensionOnlyChart({ color: "" });
    const series = chartFields().find((field) => field.key === "color")!;
    expect(series.options?.map((option) => option.value)).toEqual(["", ...raw]);
    // 중복 item key 없음 — literal UI key 는 원본 값과 일대일이다.
    expect(new Set(series.options?.map((option) => option.value)).size).toBe(
      raw.length + 1,
    );
  });

  it("None 라벨과 같은 이름의 컬럼은 보조 표시로 구분하되 저장 값은 그대로다", () => {
    seedCollections([
      {
        ...COLUMN_TABLE,
        schema: [
          { key: "없음", type: "string" },
          { key: "series", type: "string" },
        ],
      },
    ]);
    seedExtensionOnlyChart({ color: "없음" });
    const series = chartFields().find((field) => field.key === "color")!;
    expect(series.options).toEqual([
      { value: "", label: "없음" },
      { value: "없음", label: "없음 (필드)" },
      { value: "series", label: "series" },
    ]);
  });

  it("언어 전환은 None·보조 라벨만 바꾸고 원본 키는 유지한다 (T6)", () => {
    seedCollections([
      {
        ...COLUMN_TABLE,
        schema: [
          { key: "없음", type: "string" },
          { key: "series", type: "string" },
        ],
      },
    ]);
    seedExtensionOnlyChart({ color: "없음" });
    const en = chartFields({ none: "None", columnQualifier: "Field" }).find(
      (field) => field.key === "color",
    )!;
    expect(en.options).toEqual([
      { value: "", label: "None" },
      // en 로케일에서는 "없음" 이 None 라벨과 충돌하지 않으므로 보조 표시가 붙지 않는다.
      { value: "없음", label: "없음" },
      { value: "series", label: "series" },
    ]);
  });
});

describe("F1 — source schema 변화 (T7)", () => {
  it("현재 값이 source 에서 사라져도 값을 보존하고 자동 선택하지 않는다", () => {
    seedCollections([
      {
        ...COLUMN_TABLE,
        schema: [
          { key: "category", type: "string" },
          { key: "value", type: "number" },
        ],
      },
    ]);
    seedExtensionOnlyChart();
    const series = chartFields().find((field) => field.key === "color")!;
    expect(series.currentValue).toBe("series");
    expect(series.options?.map((option) => option.value)).toEqual([
      "",
      "series",
      "category",
      "value",
    ]);
  });

  it("컬럼을 찾을 수 없으면 기존 문자열 입력 fallback 을 유지한다", () => {
    seedCollections([]);
    seedExtensionOnlyChart();
    const series = chartFields().find((field) => field.key === "color")!;
    expect(series.kind).toBe("string");
    expect(series.options).toBeUndefined();
  });

  it("legacy 문서의 color 생략은 조회만으로 빈 값을 기록하지 않는다", () => {
    seedExtensionOnlyChart();
    const node = getCanonicalNode("chart")!;
    // 시드 자체가 color 를 갖고 있으므로, 생략 문서는 props 에서 지운 상태로 다시 만든다.
    seedPanelElements([
      {
        id: "chart",
        type: "Chart",
        props: (() => {
          const { color: _omitted, ...rest } = node.props as Record<
            string,
            unknown
          >;
          return rest;
        })(),
        dataBinding: { source: "dataTable", name: "review-m1" } as never,
        parent_id: null,
        page_id: "page-1",
      },
    ]);
    const series = chartFields().find((field) => field.key === "color")!;
    expect(series.isOverridden).toBe(false);
    expect(Object.hasOwn(getCanonicalNode("chart")!.props ?? {}, "color")).toBe(
      false,
    );
  });
});

describe("F1 — 6종 공통 (T8)", () => {
  for (const kind of [
    "bar",
    "line",
    "area",
    "pie",
    "radar",
    "radial",
  ] as const) {
    it(`${kind}: 해제 항목이 첫 자리이고 매핑 축은 유지된다`, () => {
      seedPanelElements([
        {
          id: "chart",
          type: "Chart",
          props: {
            ...createChartInitialProps(kind),
            dimension: "category",
            metric: "value",
            color: "series",
          },
          dataBinding: { source: "dataTable", name: "review-m1" } as never,
          parent_id: null,
          page_id: "page-1",
        },
      ]);
      const fields = chartFields();
      expect(fields.find((f) => f.key === "color")!.options?.[0]).toEqual({
        value: "",
        label: "없음",
      });
      expect(fields.find((f) => f.key === "dimension")!.currentValue).toBe(
        "category",
      );
      expect(fields.find((f) => f.key === "metric")!.currentValue).toBe(
        "value",
      );
      // 연결된 source 가 있으면 정적 Sample Rows 필드는 노출하지 않는다 (기존 계약).
      expect(fields.some((f) => f.key === "data")).toBe(false);
    });
  }
});
