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
import { ChartBudgetControls } from "./ChartBudgetControls";
import { ChartTimeAxisControls } from "./ChartTimeAxisControls";
import { ChartReferenceLineControls } from "./ChartReferenceLineControls";
import { ChartDataMappingControls } from "./ChartDataMappingControls";
import { ChartNumberFormatControls } from "./ChartNumberFormatControls";
import {
  ChartSeriesControls,
  chartSeriesConfigApplies,
} from "./ChartSeriesControls";
import { buildChartSemanticFields } from "./chartFieldOptions";
import {
  chartColumnCandidates,
  chartPresentationPatch,
} from "./chartPresentationPatch";
import { GenericFieldRenderer } from "./generic/GenericFieldRenderer";
import * as layoutEngine from "../../workspace/canvas/layout/engines/fullTreeLayout";
import {
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
  resolveChartModel,
} from "@composition/specs";

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
/** 행 메뉴 (`PropertyRowMenu`) — 트리거 `"{행} 작업"` 을 열고 항목을 고른다. 항목 element 를 돌려준다. */
const rowMenu = (view: ReturnType<typeof render>, row: string) => {
  fireEvent.click(view.getByRole("button", { name: `${row} 작업` }));
  return within(document.body).getByRole("menu", { name: `${row} 작업` });
};
const rowAction = (
  view: ReturnType<typeof render>,
  row: string,
  action: string,
) => {
  const item = within(rowMenu(view, row)).getByRole("menuitem", {
    name: action,
  });
  fireEvent.click(item);
  return item;
};
/** 시리즈 행 (`.fieldset-row.chart-series-row`) — 이름 입력 + 색 Select + 행 메뉴. */
const seriesRows = (view: ReturnType<typeof render>) =>
  Array.from(view.container.querySelectorAll<HTMLElement>(".chart-series-row"));

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
    const gone = view.getByRole("group", { name: "gone" });
    expect(within(gone).getByText("원본에 없음")).toBeTruthy();
    rowAction(view, "gone", "아래로");
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
    pick(view.getByRole("group", { name: "계열 원천" }), "값 컬럼");
    const picker = view.getByRole("group", { name: "값 필드 선택" });
    // 선택 전 취소 — write 0.
    fireEvent.click(within(picker).getByRole("button", { name: "취소" }));
    expect(spy).not.toHaveBeenCalled();

    pick(view.getByRole("group", { name: "계열 원천" }), "값 컬럼");
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
    pick(view.getByRole("group", { name: "계열 원천" }), "값 컬럼");
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
    pick(view.getByRole("group", { name: "계열 원천" }), "값 컬럼");
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
    pick(view.getByRole("group", { name: "계열 원천" }), "그룹 필드");
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
    const mode = view.getByRole("group", { name: "계열 원천" });
    expect(
      within(mode)
        .getByText(/값 컬럼 모드를 지원하지 않습니다/)
        .getAttribute("slot"),
    ).toBe("description");
    fireEvent.click(within(mode).getByRole("button"));
    const option = within(document.body).getByRole("option", {
      name: "값 컬럼",
    });
    expect(option.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(option);
    expect(spy).not.toHaveBeenCalled();
    cleanup();

    seedChart({ dataMode: "columns", valueFields: ["desktop"] });
    const view2 = ui(
      <ChartAuthoringControls fields={fields()} onPatch={onPatch} />,
    );
    fireEvent.click(
      within(view2.getByRole("group", { name: "차트 종류" })).getByRole(
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
    expect(view.queryByRole("group", { name: "계열" })).toBeNull();
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
    rowAction(view, "desktop", "아래로");
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
    const items = seriesRows(view);
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
    pick(within(items[0]).getByRole("group", { name: "색상" }), "기본");
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
    const items = seriesRows(view);
    const input = within(items[1]).getByRole("textbox");
    fireEvent.change(input, { target: { value: "Mobile" } });
    fireEvent.blur(input);
    expect(spy.mock.calls).toEqual([
      [
        {
          seriesConfig: [
            { key: F("desktop") },
            { key: F("mobile"), label: "Mobile" },
          ],
        },
      ],
    ]);
    // 그 저장본을 다시 읽어도 순서가 desktop, mobile 이다 (specs 정렬 규칙과 정합).
    seedChart({
      dataMode: "columns",
      valueFields: ["desktop", "mobile"],
      seriesConfig: [
        { key: F("desktop") },
        { key: F("mobile"), label: "Mobile" },
      ],
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
    // 행의 legend (시리즈 표시 이름) 순서 — 저장된 label 이 legend 가 된다.
    expect(
      seriesRows(view2).map((row) => row.querySelector("legend")?.textContent),
    ).toEqual(["desktop", "Mobile"]);
  });

  it("마지막 값 필드의 제거 버튼은 비활성이다 (빈 목록 = 설정 오류 상태 진입 금지)", () => {
    seedChart({ dataMode: "columns", valueFields: ["desktop"] });
    const { spy, onPatch } = patchSpy();
    const view = ui(
      <ChartDataMappingControls
        fields={fields()}
        columns={null}
        onPatch={onPatch}
      />,
    );
    const remove = within(rowMenu(view, "desktop")).getByRole("menuitem", {
      name: "제거",
    });
    expect(remove.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(remove);
    expect(spy).not.toHaveBeenCalled();
  });

  it("휴면 설정은 별도 펼침에서 제거할 수 있고, 범주색 모드에서는 Series 섹션이 열리지 않는다", () => {
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
    fireEvent.click(view.getByRole("button", { name: /숨은 계열 설정/ }));
    rowAction(view, F("mobile"), "제거");
    expect(spy.mock.calls).toEqual([[{ seriesConfig: [] }]]);
    cleanup();
    // 범주색 모드 — Series 섹션 자체가 열리지 않는다 (패널이 이 술어로 `sectionExtras.series` 를 뺀다).
    seedChart({ chartType: "pie", metric: "desktop" });
    expect(chartSeriesConfigApplies(fields(), rows, 8)).toBe(false);
    seedChart({ chartType: "bar", colorBy: "category" });
    expect(chartSeriesConfigApplies(fields(), rows, 8)).toBe(false);
    seedChart({ dataMode: "columns", valueFields: ["desktop", "mobile"] });
    expect(chartSeriesConfigApplies(fields(), rows, 8)).toBe(true);
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

describe("ADR-211 P3 — 표시 예산 컨트롤: 스칼라 patch · 지원표 비활성 · 라벨 비우기 = 키 삭제", () => {
  it("overflow/aggregate/axis 는 키마다 스칼라 1개 patch, 같은 값 재적용은 write 0", () => {
    seedChart();
    const { spy, onPatch } = patchSpy();
    const view = ui(
      <ChartBudgetControls fields={fields()} onPatch={onPatch} />,
    );
    pick(view.getByRole("group", { name: "범주 초과 시" }), "구간 집계");
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({ budgetOverflow: "aggregate" });
    pick(view.getByRole("group", { name: "집계 통계" }), "평균");
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({ budgetAggregate: "mean" });
    pick(view.getByRole("group", { name: "범주 축" }), "순서 (기간·순번)");
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({ budgetAxis: "ordinal" });
    expect(spy).toHaveBeenCalledTimes(3);
    // 저장값 (auto/sum/auto) 과 같은 값은 컨트롤·패널 필터 양쪽에서 write 0.
    pick(
      view.getByRole("group", { name: "범주 초과 시" }),
      "자동 (종류·축 기준)",
    );
    pick(view.getByRole("group", { name: "집계 통계" }), "합계");
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("bar 는 극값이, pie 는 창·집계·극값이 비활성이고 pie 에는 묶음 라벨만 남는다", () => {
    seedChart();
    const { spy, onPatch } = patchSpy();
    const view = ui(
      <ChartBudgetControls fields={fields()} onPatch={onPatch} />,
    );
    fireEvent.click(
      within(view.getByRole("group", { name: "범주 초과 시" })).getByRole(
        "button",
      ),
    );
    const extrema = within(document.body).getByRole("option", {
      name: "구간 극값 유지",
    });
    expect(extrema.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(extrema);
    expect(spy).not.toHaveBeenCalled();
    cleanup();

    seedChart({ chartType: "pie" });
    const view2 = ui(
      <ChartBudgetControls fields={fields()} onPatch={onPatch} />,
    );
    expect(view2.queryByRole("group", { name: "집계 통계" })).toBeNull();
    expect(view2.queryByRole("group", { name: "범주 축" })).toBeNull();
    expect(view2.getByRole("group", { name: "묶음 라벨" })).toBeDefined();
    fireEvent.click(
      within(view2.getByRole("group", { name: "범주 초과 시" })).getByRole(
        "button",
      ),
    );
    for (const name of ["창", "구간 집계", "구간 극값 유지"]) {
      expect(
        within(document.body)
          .getByRole("option", { name })
          .getAttribute("aria-disabled"),
        name,
      ).toBe("true");
    }
    expect(
      within(document.body)
        .getByRole("option", { name: "나머지 묶음" })
        .getAttribute("aria-disabled"),
    ).not.toBe("true");
  });

  it("묶음 라벨은 저장값을 보이고, 비우면 undefined patch (키 삭제 → 영문 상수 Other)", () => {
    seedChart({ chartType: "pie", budgetOthersLabel: "기타" });
    const { spy, onPatch } = patchSpy();
    const view = ui(
      <ChartBudgetControls fields={fields()} onPatch={onPatch} />,
    );
    const input = within(
      view.getByRole("group", { name: "묶음 라벨" }),
    ).getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("기타");
    expect(input.placeholder).toBe("Other");
    fireEvent.change(input, { target: { value: "나머지" } });
    fireEvent.blur(input);
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({ budgetOthersLabel: "나머지" });
    fireEvent.change(input, { target: { value: "  " } });
    fireEvent.blur(input);
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({
      budgetOthersLabel: undefined,
    });
  });
});

describe("ADR-211 P3 — 예산 안내는 Canvas 크기의 같은 모델을 읽는다", () => {
  it("1,000 범주 bar: '표시 fitEff / 1000 — 창', 크기가 없으면 안내 없음, 넘치지 않으면 '전부 표시'", () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      category: `c${i}`,
      value: i % 7,
    }));
    seedChart({ dimension: "category", metric: "value" }, "none");
    // 안내는 `size` 필드로 metrics 를 고른다 — semantic 필드에 size 가 있어야 sm/lg 에서도 Canvas 와 같다.
    expect(fields().some((f) => f.key === "size")).toBe(true);
    const size = { width: 400, height: 300 };
    const expected = resolveChartModel(
      rows,
      { ...CHART_DEFAULT_PROPS, dimension: "category", metric: "value" },
      { size, metrics: CHART_DEFAULT_METRICS, windowStart: 0 },
    ).budget;
    expect(expected.n).toBe(1000);
    expect(expected.applied).toBe("window");
    const map = new Map([["chart", { ...size, x: 0, y: 0 }]]);
    vi.spyOn(layoutEngine, "getSharedLayoutMap").mockImplementation(
      () => map as ReturnType<typeof layoutEngine.getSharedLayoutMap>,
    );
    vi.spyOn(layoutEngine, "onLayoutPublished").mockImplementation(
      () => () => {},
    );
    const view = ui(
      <ChartBudgetControls
        elementId="chart"
        fields={fields()}
        rows={rows}
        onPatch={() => {}}
        sourceRowCount={rows.length}
      />,
    );
    const hint = view.container.querySelector("[data-chart-budget-hint]");
    expect(hint?.getAttribute("data-chart-budget-hint")).toBe("window");
    expect(hint?.textContent).toBe(
      `표시 ${expected.fitEff} / 1000 — 창 (미리보기에서 슬라이더로 이동)`,
    );
    cleanup();

    const few = rows.slice(0, 5);
    const view2 = ui(
      <ChartBudgetControls
        elementId="chart"
        fields={fields()}
        rows={few}
        onPatch={() => {}}
        sourceRowCount={few.length}
      />,
    );
    expect(
      view2.container.querySelector("[data-chart-budget-hint]")?.textContent,
    ).toBe("전부 표시 (5)");
    cleanup();

    const view3 = ui(
      <ChartBudgetControls
        elementId="missing"
        fields={fields()}
        rows={rows}
        onPatch={() => {}}
        sourceRowCount={rows.length}
      />,
    );
    expect(
      view3.container.querySelector("[data-chart-budget-hint]"),
    ).toBeNull();
  });
});

describe("ADR-216 P4 — 시간축 컨트롤: line/area 만 · 스칼라 patch · 지시자 비우기 = 키 삭제 · 힌트", () => {
  const DATE_TABLE: DataTable = {
    id: "table-dates",
    name: "dates",
    project_id: "panel-fixture-test-project",
    schema: [
      { key: "date", type: "string" },
      { key: "value", type: "number" },
    ],
    mockData: [
      { date: "2026-01-01", value: 1 },
      { date: "2026-01-02", value: 5 },
      { date: "2026-01-04", value: 2 },
    ],
    useMockData: true,
  };
  const dateRows = DATE_TABLE.mockData as Record<string, unknown>[];

  it("line: category → time 은 dimensionScale 1 키 patch, 되돌리면 undefined (키 삭제); 지시자 두 입력이 열린다", () => {
    seedChart({
      ...createChartInitialProps("line"),
      dimension: "date",
      metric: "value",
    });
    const { spy, onPatch } = patchSpy();
    const view = ui(
      <ChartTimeAxisControls
        fields={fields()}
        rows={dateRows}
        onPatch={onPatch}
      />,
    );
    expect(view.queryByRole("group", { name: "날짜 입력 형식" })).toBeNull();
    // 전부 ISO 날짜 → 힌트 (scene 무변경 — 문자열만).
    expect(view.getByRole("status").textContent).toContain(
      "시간축으로 볼 수 있습니다",
    );
    pick(view.getByRole("group", { name: "범주 간격" }), "시간 (날짜 간격)");
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({ dimensionScale: "time" });
    cleanup();

    seedChart({
      ...createChartInitialProps("line"),
      dimension: "date",
      metric: "value",
      dimensionScale: "time",
    });
    const view2 = ui(
      <ChartTimeAxisControls
        fields={fields()}
        rows={dateRows}
        onPatch={onPatch}
      />,
    );
    const format = within(
      view2.getByRole("group", { name: "날짜 입력 형식" }),
    ).getByRole("textbox") as HTMLInputElement;
    expect(format.placeholder).toContain("ISO");
    fireEvent.change(format, { target: { value: "%Y/%m/%d" } });
    fireEvent.blur(format);
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({ dimensionFormat: "%Y/%m/%d" });
    const label = within(
      view2.getByRole("group", { name: "축 라벨 형식" }),
    ).getByRole("textbox") as HTMLInputElement;
    fireEvent.change(label, { target: { value: "%m/%d" } });
    fireEvent.blur(label);
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({
      dimensionLabelFormat: "%m/%d",
    });
    pick(view2.getByRole("group", { name: "범주 간격" }), "등간격");
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({ dimensionScale: undefined });
  });

  it("bar 는 time 항목 비활성 (write 0) · 저장된 time 은 사유 문구 · 지시자를 비우면 undefined patch · 파싱 실패 count", () => {
    seedChart({ dimension: "date", metric: "value" });
    const { spy, onPatch } = patchSpy();
    const view = ui(
      <ChartTimeAxisControls
        fields={fields()}
        rows={dateRows}
        onPatch={onPatch}
      />,
    );
    expect(view.queryByRole("status")).toBeNull();
    fireEvent.click(
      within(view.getByRole("group", { name: "범주 간격" })).getByRole(
        "button",
      ),
    );
    const time = within(document.body).getByRole("option", {
      name: "시간 (날짜 간격)",
    });
    expect(time.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(time);
    expect(spy).not.toHaveBeenCalled();
    cleanup();

    seedChart({
      ...createChartInitialProps("line"),
      dimension: "date",
      metric: "value",
      dimensionScale: "time",
      dimensionFormat: "%Y/%m/%d",
    });
    const view2 = ui(
      <ChartTimeAxisControls
        fields={fields()}
        rows={[...dateRows, { date: "not a date", value: 3 }]}
        onPatch={onPatch}
      />,
    );
    // ISO 행 3 + 잘못된 행 1 이 %Y/%m/%d 로는 전부 실패 → 4.
    const status = view2.getByRole("status");
    expect(status.getAttribute("data-chart-parse-failed")).toBe("4");
    expect(status.textContent).toContain("4행");
    const format = within(
      view2.getByRole("group", { name: "날짜 입력 형식" }),
    ).getByRole("textbox") as HTMLInputElement;
    expect(format.value).toBe("%Y/%m/%d");
    fireEvent.change(format, { target: { value: "  " } });
    fireEvent.blur(format);
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({ dimensionFormat: undefined });
  });
});

describe("ADR-217 P3 — 기준선 컨트롤: 추가/삭제는 배열 전체 교체 · 빈 배열 = 키 삭제 · pie 는 추가 비활성", () => {
  it("bar: 추가 → [{value:0}] · 값/라벨/선 모양 편집 → 배열 교체 (기본값 키 없음) · 삭제 → undefined", () => {
    seedChart();
    const { spy, onPatch } = patchSpy();
    const view = ui(
      <ChartReferenceLineControls fields={fields()} onPatch={onPatch} />,
    );
    expect(
      view.container.querySelectorAll(".chart-reference-row"),
    ).toHaveLength(0);
    fireEvent.click(view.getByRole("button", { name: "기준선 추가" }));
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({
      referenceLines: [{ value: 0 }],
    });
    cleanup();

    seedChart({ referenceLines: [{ value: 0 }] });
    const view2 = ui(
      <ChartReferenceLineControls fields={fields()} onPatch={onPatch} />,
    );
    expect(
      view2.container.querySelectorAll(".chart-reference-row"),
    ).toHaveLength(1);
    const label = within(
      view2.getByRole("group", { name: "레이블" }),
    ).getByRole("textbox");
    fireEvent.change(label, { target: { value: "목표" } });
    fireEvent.blur(label);
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({
      referenceLines: [{ value: 0, label: "목표" }],
    });
    pick(view2.getByRole("group", { name: "선 모양" }), "파선");
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({
      referenceLines: [{ value: 0, lineType: "dashed" }],
    });
    pick(view2.getByRole("group", { name: "층" }), "뒤 (데이터 아래)");
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({
      referenceLines: [{ value: 0, layer: "back" }],
    });
    rowAction(view2, "기준선 1", "기준선 삭제");
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({ referenceLines: undefined });
  });

  it("pie: 추가 버튼 비활성 + 안내 · 4개면 상한 안내", () => {
    seedChart({ chartType: "pie" });
    const { onPatch } = patchSpy();
    const view = ui(
      <ChartReferenceLineControls fields={fields()} onPatch={onPatch} />,
    );
    expect(
      view
        .getByRole("button", { name: "기준선 추가" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(view.getByRole("status").textContent).toContain("막대·선·영역");
    cleanup();
    seedChart({ referenceLines: [1, 2, 3, 4].map((value) => ({ value })) });
    const view2 = ui(
      <ChartReferenceLineControls fields={fields()} onPatch={onPatch} />,
    );
    expect(
      view2
        .getByRole("button", { name: "기준선 추가" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(view2.getByRole("status").textContent).toContain("최대 4개");
  });
});
