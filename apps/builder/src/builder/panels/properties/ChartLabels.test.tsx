import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createChartInitialProps, CHART_DESCRIPTORS } from "@composition/specs";
import { getPrimitiveBinding, resolveEditContract } from "@composition/shared";
import {
  I18nProvider,
  useI18n,
  semanticLabelKeys,
  localizedStrings,
} from "@/i18n";
import {
  resetPanelFixture,
  seedPanelElements,
} from "../../__tests__/panelFixture";
import { useStore } from "../../stores";
import { GenericFieldRenderer } from "./generic/GenericFieldRenderer";
import { ChartAuthoringControls } from "./ChartAuthoringControls";
import ComponentList from "../components/ComponentList";

beforeEach(resetPanelFixture);
afterEach(() => {
  cleanup();
  resetPanelFixture();
  localStorage.removeItem("composition-locale");
  vi.restoreAllMocks();
});

function LanguageControl() {
  const { locale, setLocale } = useI18n();
  return (
    <button onClick={() => setLocale(locale === "ko-KR" ? "en-US" : "ko-KR")}>
      Switch language
    </button>
  );
}

it("차트 팔레트는 언어를 바꿔 표시하고 생성 타입·초기 props는 유지한다", () => {
  const add = vi.fn();
  const ui = render(
    <I18nProvider initialLocale="ko-KR">
      <LanguageControl />
      <ComponentList handleAddElement={add} selectedElementId="body" />
    </I18nProvider>,
  );
  fireEvent.click(ui.getByRole("button", { name: "영역 차트" }));
  expect(add).toHaveBeenCalledWith(
    "Chart",
    "body",
    createChartInitialProps("area"),
  );
  expect(ui.getByText("차트", { selector: ".section-title" })).toBeTruthy();
  fireEvent.click(ui.getByRole("button", { name: "Switch language" }));
  expect(ui.getByRole("button", { name: "Area Chart" })).toBeTruthy();
  expect(ui.getByText("Charts", { selector: ".section-title" })).toBeTruthy();
  expect(add).toHaveBeenCalledTimes(1);
});

it("차트의 필드 역할과 기본 행 편집이 같은 명칭을 사용한다", () => {
  const accepts = getPrimitiveBinding("Chart")!.props.accepts;
  const schema = accepts.data.itemsManager!.itemSchema;
  for (const [prop, key, label] of [
    ["dimension", "category", "Category"],
    ["metric", "value", "Value"],
    ["color", "series", "Series"],
  ]) {
    expect(accepts[prop].label).toBe(label);
    expect(schema.find((field) => field.key === key)?.label).toBe(label);
  }
});

it("모든 차트 라벨·옵션·프리셋은 ko/en 번역 경로가 있다", () => {
  const contracts = Object.values(getPrimitiveBinding("Chart")!.props.accepts);
  const labels = contracts
    .flatMap((contract) => [
      contract.label,
      ...(contract.options ?? []).map((option) => option.label),
      ...(contract.itemsManager?.itemSchema ?? []).map((field) => field.label),
    ])
    .filter((label): label is string => typeof label === "string");
  labels.push(
    "Interaction",
    "Preset",
    "Custom",
    ...CHART_DESCRIPTORS.flatMap((d) => [
      d.label,
      ...d.presets.map((p) => p.label),
    ]),
  );
  for (const label of labels) {
    const key = semanticLabelKeys[label] ?? label;
    expect(localizedStrings["ko-KR"][key], label).toBeDefined();
    expect(localizedStrings["en-US"][key], label).toBeDefined();
  }
});

it("언어 전환은 기본 행/속성/프리셋/안내를 갱신하고 데이터·저장 키는 보존한다", () => {
  const props = createChartInitialProps("area");
  const element = {
    id: "chart",
    type: "Chart" as const,
    props: { ...props },
    parent_id: null,
    page_id: "page-1",
  };
  seedPanelElements([element]);
  const before = JSON.stringify(
    useStore.getState().elementsMap.get("chart")?.props,
  );
  const patch = vi.fn();
  const fields = resolveEditContract(element).fields.filter(
    (f) => f.origin === "semantic",
  );
  const ui = render(
    <I18nProvider initialLocale="ko-KR">
      <LanguageControl />
      <GenericFieldRenderer
        fields={fields}
        elementId="chart"
        onSemanticUpdate={patch}
        onStyleUpdate={patch}
        contentExtras={
          <ChartAuthoringControls
            fields={fields}
            sourceRowCount={20001}
            onPatch={patch}
          />
        }
      />
    </I18nProvider>,
  );
  fireEvent.click(ui.getAllByRole("button", { name: "펼치기" })[0]);
  expect(ui.getAllByText("범주", { selector: "legend" })).toHaveLength(2);
  expect(ui.getAllByText("값", { selector: "legend" })).toHaveLength(2);
  expect(ui.getAllByText("시리즈", { selector: "legend" })).toHaveLength(2);
  expect(ui.getByRole("button", { name: "차트 종류 변경" })).toBeTruthy();
  expect(ui.getByRole("button", { name: "데이터 행 추가" })).toBeTruthy();
  expect(ui.getByRole("status").textContent).toContain("20001행");
  fireEvent.click(ui.getByRole("button", { name: "Switch language" }));
  expect(ui.getAllByText("Category", { selector: "legend" })).toHaveLength(2);
  expect(ui.getAllByText("Value", { selector: "legend" })).toHaveLength(2);
  expect(ui.getAllByText("Series", { selector: "legend" })).toHaveLength(2);
  expect(ui.getByRole("button", { name: "Change chart type" })).toBeTruthy();
  expect(ui.getByRole("button", { name: "Add row" })).toBeTruthy();
  expect(ui.getByRole("status").textContent).toContain("20001 rows");
  fireEvent.click(ui.getByRole("button", { name: "Switch language" }));
  expect(ui.getAllByText("범주", { selector: "legend" })).toHaveLength(2);
  expect(patch).not.toHaveBeenCalled();
  expect(
    JSON.stringify(useStore.getState().elementsMap.get("chart")?.props),
  ).toBe(before);
});

it("collection 선택 값 Value/Series는 한국어 라벨과 별개로 원문 키를 표시한다", () => {
  const element = {
    id: "bound-chart",
    type: "Chart" as const,
    props: {
      ...createChartInitialProps("area"),
      metric: "Value",
      color: "Series",
    },
    parent_id: null,
    page_id: "page-1",
  };
  seedPanelElements([element]);
  // `dataMode` 는 조건 키 (ADR-210 `metric/color.visibleWhen`) — 계약 밖이면 `undefined` 로
  //   판정돼 두 필드가 숨는다. 패널은 semantic 필드 전부를 넘기므로 여기서도 같이 넘긴다.
  const fields = resolveEditContract(element)
    .fields.filter((f) => ["metric", "color", "dataMode"].includes(f.key))
    .map((field) => ({
      ...field,
      kind: "enum" as const,
      options: [
        {
          value: String(field.currentValue),
          label: String(field.currentValue),
        },
      ],
    }));
  const ui = render(
    <I18nProvider initialLocale="ko-KR">
      <LanguageControl />
      <GenericFieldRenderer
        fields={fields}
        elementId="bound-chart"
        literalOptionFields={["metric", "color"]}
        onSemanticUpdate={vi.fn()}
        onStyleUpdate={vi.fn()}
      />
    </I18nProvider>,
  );
  expect(
    within(ui.getByRole("group", { name: "값" })).getByRole("button")
      .textContent,
  ).toContain("Value");
  expect(
    within(ui.getByRole("group", { name: "시리즈" })).getByRole("button")
      .textContent,
  ).toContain("Series");
  fireEvent.click(ui.getByRole("button", { name: "Switch language" }));
  expect(
    within(ui.getByRole("group", { name: "Value" })).getByRole("button")
      .textContent,
  ).toContain("Value");
});
