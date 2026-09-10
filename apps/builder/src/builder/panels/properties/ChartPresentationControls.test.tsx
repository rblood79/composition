/**
 * ADR-210 P2 / G2 — 실제 Properties 생산자·컨트롤 (T06 · 배열 동일성 · 모드/형식 묶음 patch).
 *
 * 편집 계약은 canonical store 에 시드한 노드로 **실제 `resolveEditContract`** 를, 필드는
 * **실제 생산자 `buildChartSemanticFields`** 를, 컬럼 후보는 실제 `chartColumnCandidates`
 * 를 통과한다. 컨트롤의 patch 는 패널이 끼우는 `chartPresentationPatch` 를 거쳐 단언한다 —
 * 합성 옵션 배열을 컨트롤에 직접 넘긴 결과는 이 게이트의 증거가 아니다.
 */
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChartInitialProps, seriesIdentity } from "@composition/specs";
import { resolveEditContract } from "@composition/shared";

import { I18nProvider } from "@/i18n";
import type { DataTable } from "@/types/builder/data.types";
import {
  resetPanelFixture,
  seedPanelElements,
} from "../../__tests__/panelFixture";
import {
  getActiveCanonicalDocument,
  getCanonicalNode,
} from "../../stores/canonical/canonicalElementsBridge";
import { useDataStore } from "../../stores/data";
import { ChartAuthoringControls } from "./ChartAuthoringControls";
import { ChartDataMappingControls } from "./ChartDataMappingControls";
import { ChartNumberFormatControls } from "./ChartNumberFormatControls";
import { ChartSeriesControls } from "./ChartSeriesControls";
import { buildChartSemanticFields } from "./chartFieldOptions";
import {
  chartColumnCandidates,
  chartPresentationPatch,
} from "./chartPresentationPatch";
import { GenericFieldRenderer } from "./generic/GenericFieldRenderer";

const WIDE_TABLE: DataTable = {
  id: "table-wide",
  name: "wide",
  project_id: "panel-fixture-test-project",
  schema: [
    { key: "month", type: "string" },
    { key: "desktop", type: "number" },
    { key: "mobile", type: "number" },
    { key: "note", type: "string" },
  ],
  mockData: [
    { month: "Jan", desktop: 120, mobile: 80, note: "a" },
    { month: "Feb", desktop: 40, mobile: 10, note: "b" },
  ],
  useMockData: true,
};
const KO = { none: "없음", columnQualifier: "필드" };
const F = (key: string) => seriesIdentity("field", key);

function seedCollections(tables: DataTable[]): void {
  useDataStore.setState({
    collections: new Map(tables.map((table) => [table.name, table])),
  } as never);
}
function seedChart(
  overrides: Record<string, unknown> = {},
  binding: "props" | "extension" | "none" = "props",
): void {
  const dataBinding = { source: "dataTable", name: "wide" };
  seedPanelElements([
    {
      id: "chart",
      type: "Chart",
      props: {
        ...createChartInitialProps("bar"),
        dimension: "month",
        metric: "desktop",
        color: "",
        ...(binding === "props" ? { dataBinding } : {}),
        ...overrides,
      },
      ...(binding === "extension" ? { dataBinding: dataBinding as never } : {}),
      parent_id: null,
      page_id: "page-1",
    },
  ]);
}
function fields() {
  const node = getCanonicalNode("chart");
  if (!node) throw new Error("canonical node 미시드");
  const contract = resolveEditContract(node, getActiveCanonicalDocument());
  return buildChartSemanticFields(
    contract.fields.filter((field) => field.origin === "semantic"),
    Array.from(useDataStore.getState().collections.values()),
    KO,
  );
}
function values(): Record<string, unknown> {
  return Object.fromEntries(fields().map((f) => [f.key, f.currentValue]));
}
/** 패널의 `handleChartPatch` 와 같은 필터 — 변경분만 spy 에 도달한다. */
function patchSpy() {
  const spy = vi.fn();
  const onPatch = (
    patch: Record<string, unknown>,
    force?: readonly string[],
  ) => {
    const changed = chartPresentationPatch(values(), patch, force);
    if (Object.keys(changed).length > 0) spy(changed);
  };
  return { spy, onPatch };
}
const ui = (node: React.ReactElement) =>
  render(<I18nProvider initialLocale="ko-KR">{node}</I18nProvider>);
const pick = (group: HTMLElement, option: string) => {
  fireEvent.click(within(group).getByRole("button"));
  fireEvent.click(within(document.body).getByRole("option", { name: option }));
};

beforeEach(() => {
  resetPanelFixture();
  seedCollections([WIDE_TABLE]);
});
afterEach(() => {
  cleanup();
  resetPanelFixture();
  seedCollections([]);
  vi.restoreAllMocks();
});

describe("T06 — 실제 생산자: 후보·타입·None·키 보존", () => {
  it("props 의 binding / extension 의 binding 모두 schema 타입 후보에 도달한다", () => {
    for (const where of ["props", "extension"] as const) {
      resetPanelFixture();
      seedChart({}, where);
      const candidates = chartColumnCandidates(
        values(),
        Array.from(useDataStore.getState().collections.values()),
      );
      expect(candidates, where).toEqual([
        { key: "month", type: "text" },
        { key: "desktop", type: "number" },
        { key: "mobile", type: "number" },
        { key: "note", type: "text" },
      ]);
    }
  });

  it("schema 0 이면 첫 행 키를 unknown 으로 (수치형 확정 없음), 원천 없음은 null", () => {
    seedCollections([{ ...WIDE_TABLE, schema: [] }]);
    seedChart();
    const tables = Array.from(useDataStore.getState().collections.values());
    expect(chartColumnCandidates(values(), tables)).toEqual([
      { key: "month", type: "unknown" },
      { key: "desktop", type: "unknown" },
      { key: "mobile", type: "unknown" },
      { key: "note", type: "unknown" },
    ]);
    seedChart({ data: [{ x: 1 }] }, "none");
    expect(chartColumnCandidates(values(), tables)).toEqual([
      { key: "x", type: "unknown" },
    ]);
    seedChart({ data: undefined }, "none");
    expect(chartColumnCandidates(values(), tables)).toBeNull();
  });

  it("group 모드의 Category/Value/Series 옵션 계약 (None 첫 자리) 은 그대로다", () => {
    seedChart();
    const series = fields().find((f) => f.key === "color")!;
    expect(series.options?.[0]).toEqual({ value: "", label: "없음" });
    const metric = fields().find((f) => f.key === "metric")!;
    expect(metric.options?.map((o) => o.value)).toEqual([
      "desktop",
      "month",
      "mobile",
      "note",
    ]);
  });

  it("누락 필드는 '원본에 없음' 으로 표시되고 patch 에서 키가 보존된다", () => {
    seedChart({ dataMode: "columns", valueFields: ["gone", "desktop"] });
    const { spy, onPatch } = patchSpy();
    const view = ui(
      <ChartDataMappingControls
        fields={fields()}
        columns={chartColumnCandidates(
          values(),
          Array.from(useDataStore.getState().collections.values()),
        )}
        onPatch={onPatch}
      />,
    );
    const list = view.getByRole("group", { name: "값 필드" });
    expect(within(list).getByText("원본에 없음")).toBeTruthy();
    fireEvent.click(within(list).getByRole("button", { name: "아래로 gone" }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual({ valueFields: ["desktop", "gone"] });
  });
});

describe("모드 전환 — 단일 patch · 취소 write 0 · Pie/Radial 비활성 · 필드 숨김", () => {
  it("group→columns: 필드를 고르고 Apply 하면 dataMode+valueFields 가 한 patch, 취소는 0", () => {
    seedChart({ colorBy: "category" });
    const { spy, onPatch } = patchSpy();
    const columns = chartColumnCandidates(
      values(),
      Array.from(useDataStore.getState().collections.values()),
    );
    const view = ui(
      <ChartDataMappingControls
        fields={fields()}
        columns={columns}
        onPatch={onPatch}
      />,
    );
    pick(view.getByRole("group", { name: "시리즈 원천" }), "값 컬럼");
    const picker = view.getByRole("group", { name: "값 필드 선택" });
    // 선택 전 취소 — write 0.
    fireEvent.click(within(picker).getByRole("button", { name: "취소" }));
    expect(spy).not.toHaveBeenCalled();

    pick(view.getByRole("group", { name: "시리즈 원천" }), "값 컬럼");
    const picker2 = view.getByRole("group", { name: "값 필드 선택" });
    fireEvent.click(
      within(picker2).getByRole("checkbox", { name: "desktop · 수치형" }),
    );
    fireEvent.click(
      within(picker2).getByRole("checkbox", { name: "mobile · 수치형" }),
    );
    fireEvent.click(within(picker2).getByRole("button", { name: "적용" }));
    expect(spy).toHaveBeenCalledTimes(1);
    // 범주색 bar 는 같은 patch 에서 시리즈색으로 (Undo 한 번에 함께 돌아간다).
    expect(spy.mock.calls[0][0]).toEqual({
      dataMode: "columns",
      valueFields: ["desktop", "mobile"],
      colorBy: "series",
    });
  });

  it("선택 화면은 요소마다 새로 시작한다 — remount 없이 elementId 만 바뀌어도 (P4 owner 상태)", () => {
    seedChart();
    const { spy, onPatch } = patchSpy();
    const columns = chartColumnCandidates(
      values(),
      Array.from(useDataStore.getState().collections.values()),
    );
    const element = (elementId: string) => (
      <ChartDataMappingControls
        elementId={elementId}
        fields={fields()}
        columns={columns}
        onPatch={onPatch}
      />
    );
    const view = ui(element("chart-a"));
    pick(view.getByRole("group", { name: "시리즈 원천" }), "값 컬럼");
    const picker = view.getByRole("group", { name: "값 필드 선택" });
    fireEvent.click(
      within(picker).getByRole("checkbox", { name: "desktop · 수치형" }),
    );
    // 다른 요소로 전환 (같은 컴포넌트 인스턴스, key 없음) — A 의 선택 화면·체크가 B 에 남지 않는다.
    view.rerender(
      <I18nProvider initialLocale="ko-KR">{element("chart-b")}</I18nProvider>,
    );
    expect(view.queryByRole("group", { name: "값 필드 선택" })).toBeNull();
    // 다시 A 로 돌아와도 초기 상태다 (이전 선택은 버려진다).
    view.rerender(
      <I18nProvider initialLocale="ko-KR">{element("chart-a")}</I18nProvider>,
    );
    expect(view.queryByRole("group", { name: "값 필드 선택" })).toBeNull();
    pick(view.getByRole("group", { name: "시리즈 원천" }), "값 컬럼");
    expect(
      (
        within(view.getByRole("group", { name: "값 필드 선택" })).getByRole(
          "checkbox",
          { name: "desktop · 수치형" },
        ) as HTMLInputElement
      ).checked,
    ).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("columns→group 은 dataMode 만 쓴다 (valueFields 보존)", () => {
    seedChart({ dataMode: "columns", valueFields: ["desktop", "mobile"] });
    const { spy, onPatch } = patchSpy();
    const view = ui(
      <ChartDataMappingControls
        fields={fields()}
        columns={null}
        onPatch={onPatch}
      />,
    );
    pick(view.getByRole("group", { name: "시리즈 원천" }), "그룹 필드");
    expect(spy.mock.calls).toEqual([[{ dataMode: "group" }]]);
  });

  it("Pie 에서는 값 컬럼 항목이 비활성이고 사유가 보인다; columns 에서는 Pie/Radial 종류가 비활성", () => {
    seedChart({ chartType: "pie" });
    const { spy, onPatch } = patchSpy();
    const view = ui(
      <ChartDataMappingControls
        fields={fields()}
        columns={null}
        onPatch={onPatch}
      />,
    );
    expect(view.getByRole("note").textContent).toContain(
      "값 컬럼 모드를 지원하지 않습니다",
    );
    fireEvent.click(
      within(view.getByRole("group", { name: "시리즈 원천" })).getByRole(
        "button",
      ),
    );
    const option = within(document.body).getByRole("option", {
      name: "값 컬럼",
    });
    expect(option.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(option);
    expect(spy).not.toHaveBeenCalled();
    cleanup();

    seedChart({ dataMode: "columns", valueFields: ["desktop"] });
    const view2 = ui(
      <ChartAuthoringControls
        fields={fields()}
        onPatch={onPatch}
        sourceRowCount={0}
      />,
    );
    fireEvent.click(view2.getByRole("button", { name: "차트 종류 변경" }));
    fireEvent.click(
      within(view2.getByRole("group", { name: "변경할 차트" })).getByRole(
        "button",
      ),
    );
    expect(
      within(document.body)
        .getByRole("option", { name: "원형 차트" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    expect(
      within(document.body)
        .getByRole("option", { name: "선 차트" })
        .getAttribute("aria-disabled"),
    ).not.toBe("true");
  });

  it("columns 모드의 generic 필드: Value/Series/Color By 가 숨고 Category 는 남는다", () => {
    seedChart({ dataMode: "columns", valueFields: ["desktop"] });
    const view = ui(
      <GenericFieldRenderer
        fields={fields()}
        elementId="chart"
        literalOptionFields={["dimension", "metric", "color"]}
        onSemanticUpdate={vi.fn()}
        onStyleUpdate={vi.fn()}
      />,
    );
    expect(view.queryByRole("group", { name: "범주" })).toBeTruthy();
    expect(view.queryByRole("group", { name: "값" })).toBeNull();
    expect(view.queryByRole("group", { name: "시리즈" })).toBeNull();
    expect(view.queryByRole("group", { name: "색상 구분" })).toBeNull();
    cleanup();
    seedChart();
    const view2 = ui(
      <GenericFieldRenderer
        fields={fields()}
        elementId="chart"
        literalOptionFields={["dimension", "metric", "color"]}
        onSemanticUpdate={vi.fn()}
        onStyleUpdate={vi.fn()}
      />,
    );
    expect(view2.queryByRole("group", { name: "값" })).toBeTruthy();
    expect(view2.queryByRole("group", { name: "색상 구분" })).toBeTruthy();
  });
});

describe("시리즈 설정 — 순서/이름/색 patch · 같은 배열 재적용 write 0 · 휴면", () => {
  const rows = WIDE_TABLE.mockData!;
  it("아래로 이동은 seriesConfig 순서를 통째로 쓰고, 같은 순서 재적용은 write 0", () => {
    seedChart({ dataMode: "columns", valueFields: ["desktop", "mobile"] });
    const { spy, onPatch } = patchSpy();
    const view = ui(
      <ChartSeriesControls
        fields={fields()}
        rows={rows}
        paletteLength={8}
        onPatch={onPatch}
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "아래로 desktop" }));
    expect(spy.mock.calls).toEqual([
      [{ seriesConfig: [{ key: F("mobile") }, { key: F("desktop") }] }],
    ]);
    // 같은 뜻의 배열을 다시 보내면 필터가 막는다 (참조가 달라도).
    expect(
      chartPresentationPatch(
        { seriesConfig: [{ key: F("mobile") }, { key: F("desktop") }] },
        {
          seriesConfig: [{ key: F("mobile") }, { key: F("desktop") }].map(
            (e) => ({ ...e }),
          ),
        },
      ),
    ).toEqual({});
    // 속성 존재 여부는 의미 비교 대상 — label:"" 와 label 부재는 다르다.
    expect(
      chartPresentationPatch(
        { seriesConfig: [{ key: F("mobile") }] },
        { seriesConfig: [{ key: F("mobile"), label: "" }] },
      ),
    ).toEqual({ seriesConfig: [{ key: F("mobile"), label: "" }] });
  });

  it("이름 입력(blur) 과 팔레트 토큰 선택은 해당 항목만 바꾸고 나머지 항목·순서를 보존한다", () => {
    seedChart({
      dataMode: "columns",
      valueFields: ["desktop", "mobile"],
      seriesConfig: [
        { key: F("mobile"), colorToken: "--chart-series-5" },
        { key: F("desktop") },
      ],
    });
    const { spy, onPatch } = patchSpy();
    const view = ui(
      <ChartSeriesControls
        fields={fields()}
        rows={rows}
        paletteLength={8}
        onPatch={onPatch}
      />,
    );
    const items = view.getAllByRole("listitem");
    expect(items[0].textContent).toContain("mobile");
    const input = within(items[1]).getByRole("textbox");
    fireEvent.change(input, { target: { value: "Desktop" } });
    fireEvent.blur(input);
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({
      seriesConfig: [
        { key: F("mobile"), colorToken: "--chart-series-5" },
        { key: F("desktop"), label: "Desktop" },
      ],
    });
    pick(within(items[0]).getByRole("group", { name: "팔레트 색" }), "기본 색");
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({
      seriesConfig: [{ key: F("mobile") }, { key: F("desktop") }],
    });
  });

  it("두 번째 시리즈의 이름만 바꾸면 순서는 그대로다 (앞 항목이 key 만으로 저장된다)", () => {
    seedChart({ dataMode: "columns", valueFields: ["desktop", "mobile"] });
    const { spy, onPatch } = patchSpy();
    const view = ui(
      <ChartSeriesControls
        fields={fields()}
        rows={rows}
        paletteLength={8}
        onPatch={onPatch}
      />,
    );
    const items = view.getAllByRole("listitem");
    const input = within(items[1]).getByRole("textbox");
    fireEvent.change(input, { target: { value: "Mobile" } });
    fireEvent.blur(input);
    expect(spy.mock.calls).toEqual([
      [{ seriesConfig: [{ key: F("desktop") }, { key: F("mobile"), label: "Mobile" }] }],
    ]);
    // 그 저장본을 다시 읽어도 순서가 desktop, mobile 이다 (specs 정렬 규칙과 정합).
    seedChart({
      dataMode: "columns",
      valueFields: ["desktop", "mobile"],
      seriesConfig: [{ key: F("desktop") }, { key: F("mobile"), label: "Mobile" }],
    });
    cleanup();
    const view2 = ui(
      <ChartSeriesControls
        fields={fields()}
        rows={rows}
        paletteLength={8}
        onPatch={onPatch}
      />,
    );
    expect(
      view2.getAllByRole("listitem").map((li) => li.textContent?.slice(0, 7)),
    ).toEqual(["desktop", "Mobile표"]);
  });

  it("마지막 값 필드의 제거 버튼은 비활성이다 (빈 목록 = 설정 오류 상태 진입 금지)", () => {
    seedChart({ dataMode: "columns", valueFields: ["desktop"] });
    const { spy, onPatch } = patchSpy();
    const view = ui(
      <ChartDataMappingControls fields={fields()} columns={null} onPatch={onPatch} />,
    );
    const remove = view.getByRole("button", { name: "제거 desktop" });
    expect(remove.getAttribute("aria-disabled") ?? String(remove.hasAttribute("disabled"))).not.toBe("false");
    fireEvent.click(remove);
    expect(spy).not.toHaveBeenCalled();
  });

  it("휴면 설정은 별도 펼침에서 제거할 수 있고, 범주색 모드에서는 사유만 보인다", () => {
    seedChart({
      dataMode: "columns",
      valueFields: ["desktop"],
      seriesConfig: [{ key: F("mobile"), label: "Mobile" }],
    });
    const { spy, onPatch } = patchSpy();
    const view = ui(
      <ChartSeriesControls
        fields={fields()}
        rows={rows}
        paletteLength={8}
        onPatch={onPatch}
      />,
    );
    fireEvent.click(view.getByRole("button", { name: /숨은 시리즈 설정/ }));
    fireEvent.click(view.getByRole("button", { name: `제거 ${F("mobile")}` }));
    expect(spy.mock.calls).toEqual([[{ seriesConfig: [] }]]);
    cleanup();
    seedChart({ chartType: "pie", metric: "desktop" });
    const view2 = ui(
      <ChartSeriesControls
        fields={fields()}
        rows={rows}
        paletteLength={8}
        onPatch={onPatch}
      />,
    );
    expect(view2.getByRole("note").textContent).toContain(
      "시리즈 이름·색 설정이 적용되지 않습니다",
    );
  });
});

describe("숫자 형식 — 통화/단위 묶음 Apply · 취소 write 0 · Auto 휴면 보존", () => {
  it("Currency 는 코드까지 골라야 한 patch 로 저장되고, 취소는 0", () => {
    seedChart();
    const { spy, onPatch } = patchSpy();
    const view = ui(
      <ChartNumberFormatControls fields={fields()} onPatch={onPatch} />,
    );
    pick(view.getByRole("group", { name: "숫자 형식" }), "통화");
    expect(spy).not.toHaveBeenCalled();
    const apply = view.getByRole("button", { name: "적용" });
    expect(
      apply.getAttribute("aria-disabled") ??
        apply.hasAttribute("disabled").toString(),
    ).not.toBe("false");
    fireEvent.click(view.getByRole("button", { name: "취소" }));
    expect(spy).not.toHaveBeenCalled();

    pick(view.getByRole("group", { name: "숫자 형식" }), "통화");
    pick(view.getByRole("group", { name: "통화 코드" }), "USD");
    fireEvent.click(view.getByRole("button", { name: "적용" }));
    expect(spy.mock.calls).toEqual([
      [{ valueFormat: "currency", valueCurrency: "USD" }],
    ]);
  });

  it("Percent 는 입력 단위를 함께, Decimal 은 즉시, Auto 는 형식만 (휴면 값 보존)", () => {
    seedChart({
      valueFormat: "currency",
      valueCurrency: "KRW",
      valueFractionDigits: 0,
    });
    const { spy, onPatch } = patchSpy();
    const view = ui(
      <ChartNumberFormatControls fields={fields()} onPatch={onPatch} />,
    );
    pick(view.getByRole("group", { name: "숫자 형식" }), "퍼센트");
    pick(view.getByRole("group", { name: "입력 단위" }), "비율 (0.25 = 25%)");
    fireEvent.click(view.getByRole("button", { name: "적용" }));
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({
      valueFormat: "percent",
      valuePercentUnit: "ratio",
    });
    pick(view.getByRole("group", { name: "숫자 형식" }), "소수");
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({ valueFormat: "decimal" });
    pick(view.getByRole("group", { name: "숫자 형식" }), "자동 (기본)");
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({ valueFormat: "auto" });
    // 통화·자릿수는 patch 에 없다 — 휴면 보존.
    for (const call of spy.mock.calls) {
      expect(Object.keys(call[0])).not.toContain("valueCurrency");
      expect(Object.keys(call[0])).not.toContain("valueFractionDigits");
    }
  });
});
