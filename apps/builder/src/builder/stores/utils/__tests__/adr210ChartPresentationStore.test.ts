/**
 * ADR-210 P2 / G2 — R1: 실제 inspector 경로의 canonical·history·ref·reload 계약 (T07 · T09).
 *
 * 패널이 실제로 부르는 `dispatchSemanticUpdateWithPropagation` → **실제 inspector store**
 * 액션을 통과한다. 단언은 `deriveProjectRenderModelFromDocument` 가 canonical 에서 다시
 * 해소한 props 다 (메모리 view 가 아니라 저장본).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { withComponentOriginMirror } from "@/adapters/canonical/componentSemanticsMirror";
import {
  deriveProjectRenderModelFromDocument,
  parseProjectData,
  serializeProjectData,
} from "@composition/shared";
import { seriesIdentity } from "@composition/specs";

import {
  PANEL_FIXTURE_PROJECT_ID,
  resetPanelFixture,
  seedPanelElements,
} from "../../../__tests__/panelFixture";
import { chartPresentationPatch } from "../../../panels/properties/chartPresentationPatch";
import { dispatchSemanticUpdateWithPropagation } from "../../../panels/properties/semanticUpdateDispatch";
import { useStore } from "../../index";
import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import { historyManager } from "../../history";

const PROJECT_UUID = "00000000-0000-0000-0000-000000000210";
const F = (key: string) => seriesIdentity("field", key);
const WIDE = [
  { month: "Jan", desktop: 120, mobile: 80 },
  { month: "Feb", desktop: 40, mobile: 10 },
];
const ORIGIN_PROPS = {
  chartType: "bar",
  dimension: "month",
  metric: "desktop",
  color: "",
  data: WIDE,
};

beforeEach(() => {
  resetPanelFixture();
  historyManager.setCurrentPage("page-1");
  useStore.setState({ currentPageId: "page-1" });
});
afterEach(resetPanelFixture);

function readDocument() {
  return useCanonicalDocumentStore
    .getState()
    .getDocument(PANEL_FIXTURE_PROJECT_ID)!;
}
function resolvedProps(id: string): Record<string, unknown> {
  return deriveProjectRenderModelFromDocument(
    readDocument(),
    PROJECT_UUID,
    "page-1",
  ).elements.find((element) => element.id === id)!.props;
}
/** 패널의 Chart patch 한 벌 — 의미 비교 필터 → 실제 semantic dispatch. */
function patchSelected(
  elementId: string,
  patch: Record<string, unknown>,
  force?: readonly string[],
): boolean {
  useStore.getState().setSelectedElement(elementId);
  const state = useStore.getState();
  const element = state.elementsMap.get(elementId)!;
  const baseline = resolvedProps(elementId);
  const changedProps = chartPresentationPatch(baseline, patch, force);
  if (Object.keys(changedProps).length === 0) return false;
  dispatchSemanticUpdateWithPropagation({
    changedProps,
    propagationElement: {
      id: element.id,
      type: element.type,
      props: element.props,
    },
    childrenMap: new Map(),
    elementsMap: new Map([
      [
        element.id,
        { id: element.id, type: element.type, props: element.props },
      ],
    ]),
    actions: state,
  });
  return true;
}
function seedChart(props: Record<string, unknown> = ORIGIN_PROPS): void {
  seedPanelElements([
    { id: "body", type: "body", props: {}, parent_id: null, page_id: "page-1" },
    {
      id: "chart",
      type: "Chart",
      props: { ...props },
      parent_id: "body",
      page_id: "page-1",
    },
  ]);
}

describe("T07 — 단일 patch = 단일 history · Undo/Redo · reload", () => {
  it("group→columns Apply 는 dataMode+valueFields+colorBy 를 한 history 항목으로 쓰고 Undo 한 번에 전부 돌아간다", async () => {
    seedChart({ ...ORIGIN_PROPS, colorBy: "category" });
    expect(
      patchSelected("chart", {
        dataMode: "columns",
        valueFields: ["desktop", "mobile"],
        colorBy: "series",
      }),
    ).toBe(true);
    await Promise.resolve();
    expect(resolvedProps("chart")).toMatchObject({
      dataMode: "columns",
      valueFields: ["desktop", "mobile"],
      colorBy: "series",
      // legacy metric 은 보존 (§2.3 2 — group 으로 되돌릴 근거).
      metric: "desktop",
    });
    await useStore.getState().undo();
    const after = resolvedProps("chart");
    expect(after.dataMode).toBeUndefined();
    expect(after.valueFields).toBeUndefined();
    expect(after.colorBy).toBe("category");
    await useStore.getState().redo();
    expect(resolvedProps("chart")).toMatchObject({
      dataMode: "columns",
      valueFields: ["desktop", "mobile"],
      colorBy: "series",
    });
  });

  it("같은 배열 재적용은 write 0 (documentVersion 불변), 실제 변경만 쓴다", async () => {
    seedChart({
      ...ORIGIN_PROPS,
      dataMode: "columns",
      valueFields: ["desktop", "mobile"],
      seriesConfig: [{ key: F("mobile"), label: "Mobile" }],
    });
    const before = useCanonicalDocumentStore.getState().documentVersion;
    expect(
      patchSelected("chart", {
        valueFields: ["desktop", "mobile"],
        seriesConfig: [{ key: F("mobile"), label: "Mobile" }],
      }),
    ).toBe(false);
    expect(useCanonicalDocumentStore.getState().documentVersion).toBe(before);
    expect(
      patchSelected("chart", {
        seriesConfig: [
          { key: F("mobile"), label: "Mobile", colorToken: "--chart-series-5" },
        ],
      }),
    ).toBe(true);
    await Promise.resolve();
    expect(resolvedProps("chart").seriesConfig).toEqual([
      { key: F("mobile"), label: "Mobile", colorToken: "--chart-series-5" },
    ]);
  });

  it("직렬화 → 파싱 → 재로드 후 배열·형식 props 가 그대로다 (canonical 저장 형태)", async () => {
    seedChart();
    patchSelected("chart", {
      dataMode: "columns",
      valueFields: ["desktop", "mobile"],
      seriesConfig: [
        { key: F("mobile"), label: "", colorToken: "--chart-series-3" },
      ],
      valueFormat: "currency",
      valueCurrency: "USD",
      valueFractionDigits: 0,
    });
    await Promise.resolve();
    const saved = parseProjectData(
      serializeProjectData(PROJECT_UUID, "Charts", readDocument(), "page-1"),
    );
    expect(saved.success).toBe(true);
    if (!saved.success) return;
    useCanonicalDocumentStore
      .getState()
      .setDocument(PANEL_FIXTURE_PROJECT_ID, saved.data.document);
    expect(resolvedProps("chart")).toMatchObject({
      dataMode: "columns",
      valueFields: ["desktop", "mobile"],
      seriesConfig: [
        { key: F("mobile"), label: "", colorToken: "--chart-series-3" },
      ],
      valueFormat: "currency",
      valueCurrency: "USD",
      valueFractionDigits: 0,
      data: WIDE,
    });
    // 빈 문자열 label 이 속성 부재로 바뀌지 않았다.
    const entry = (
      resolvedProps("chart").seriesConfig as Array<Record<string, unknown>>
    )[0];
    expect(Object.hasOwn(entry, "label")).toBe(true);
  });
});

describe("T07 — 소수 자릿수 비우기 (undefined patch) 는 키를 남기지 않는다", () => {
  it("valueFractionDigits: undefined 이후 저장본에 키가 없거나 undefined 다 (auto 기본 자릿수로 읽힌다)", async () => {
    seedChart({ ...ORIGIN_PROPS, valueFormat: "decimal", valueFractionDigits: 2 });
    expect(patchSelected("chart", { valueFractionDigits: undefined })).toBe(true);
    await Promise.resolve();
    expect(resolvedProps("chart").valueFractionDigits).toBeUndefined();
    const saved = parseProjectData(
      serializeProjectData(PROJECT_UUID, "Charts", readDocument(), "page-1"),
    );
    expect(saved.success).toBe(true);
    if (!saved.success) return;
    useCanonicalDocumentStore.getState().setDocument(PANEL_FIXTURE_PROJECT_ID, saved.data.document);
    expect(Object.hasOwn(resolvedProps("chart"), "valueFractionDigits")).toBe(false);
  });
});

describe("T07 — ref 인스턴스: 배열 override 는 인스턴스에만, origin write 0", () => {
  function seedOriginAndInstances() {
    seedPanelElements([
      {
        id: "body",
        type: "body",
        props: {},
        parent_id: null,
        page_id: "page-1",
      },
      withComponentOriginMirror({
        id: "chart-origin",
        type: "Chart",
        props: {
          ...ORIGIN_PROPS,
          dataMode: "columns",
          valueFields: ["desktop", "mobile"],
          seriesConfig: [{ key: F("desktop"), label: "Desktop" }],
        },
        parent_id: "body",
        page_id: "page-1",
      }),
    ]);
    const first = useStore
      .getState()
      .createInstance("chart-origin", "body", "page-1")!;
    const second = useStore
      .getState()
      .createInstance("chart-origin", "body", "page-1")!;
    return { first, second };
  }

  it("인스턴스의 seriesConfig 편집은 전체 배열 override 이고 origin·형제는 그대로다", async () => {
    const { first, second } = seedOriginAndInstances();
    const originVersionBefore = JSON.stringify(resolvedProps("chart-origin"));
    expect(
      patchSelected(first.id, {
        seriesConfig: [
          { key: F("mobile"), label: "Mobile" },
          { key: F("desktop"), label: "Desktop" },
        ],
      }),
    ).toBe(true);
    await Promise.resolve();
    expect(resolvedProps(first.id).seriesConfig).toEqual([
      { key: F("mobile"), label: "Mobile" },
      { key: F("desktop"), label: "Desktop" },
    ]);
    expect(resolvedProps(second.id).seriesConfig).toEqual([
      { key: F("desktop"), label: "Desktop" },
    ]);
    expect(JSON.stringify(resolvedProps("chart-origin"))).toBe(
      originVersionBefore,
    );
    // 다른 prop 은 계속 origin 을 따른다.
    expect(resolvedProps(first.id)).toMatchObject({
      dataMode: "columns",
      valueFields: ["desktop", "mobile"],
    });

    // origin 이 이후 항목을 추가해도 override 인스턴스에는 자동 병합되지 않는다 (§2.1).
    expect(
      patchSelected("chart-origin", {
        seriesConfig: [
          { key: F("desktop"), label: "Desktop" },
          { key: F("mobile"), colorToken: "--chart-series-8" },
        ],
      }),
    ).toBe(true);
    await Promise.resolve();
    expect(resolvedProps(second.id).seriesConfig).toEqual([
      { key: F("desktop"), label: "Desktop" },
      { key: F("mobile"), colorToken: "--chart-series-8" },
    ]);
    expect(resolvedProps(first.id).seriesConfig).toEqual([
      { key: F("mobile"), label: "Mobile" },
      { key: F("desktop"), label: "Desktop" },
    ]);
  });

  it("상속 배열과 같은 값의 '명시 고정' 은 force 로 1회 저장되고 이후 origin 변경을 따르지 않는다", async () => {
    const { first, second } = seedOriginAndInstances();
    // 일반 Apply 는 같은 값이라 write 0.
    expect(
      patchSelected(first.id, {
        seriesConfig: [{ key: F("desktop"), label: "Desktop" }],
      }),
    ).toBe(false);
    // 명시 고정 — 같은 값을 1회 저장.
    expect(
      patchSelected(
        first.id,
        { seriesConfig: [{ key: F("desktop"), label: "Desktop" }] },
        ["seriesConfig"],
      ),
    ).toBe(true);
    await Promise.resolve();
    patchSelected("chart-origin", { seriesConfig: [] });
    await Promise.resolve();
    expect(resolvedProps(first.id).seriesConfig).toEqual([
      { key: F("desktop"), label: "Desktop" },
    ]);
    expect(resolvedProps(second.id).seriesConfig).toEqual([]);
  });

  it('명시 dataMode:"group" 은 삭제가 아니라 override — origin 의 columns 를 인스턴스에서만 덮는다', async () => {
    const { first, second } = seedOriginAndInstances();
    expect(patchSelected(first.id, { dataMode: "group" })).toBe(true);
    await Promise.resolve();
    expect(resolvedProps(first.id).dataMode).toBe("group");
    expect(resolvedProps(first.id).valueFields).toEqual(["desktop", "mobile"]);
    expect(resolvedProps(second.id).dataMode).toBe("columns");
    expect(resolvedProps("chart-origin").dataMode).toBe("columns");
    await useStore.getState().undo();
    expect(resolvedProps(first.id).dataMode).toBe("columns");
  });
});

describe("T07 l4 — descendant ref (가설: 인스턴스 안의 자식 편집은 origin 을 안 바꾼다)", () => {
  it("컨테이너 컴포넌트 안의 Chart 를 인스턴스 경로로 편집해도 origin 자식·형제 인스턴스는 그대로다", async () => {
    seedPanelElements([
      {
        id: "body",
        type: "body",
        props: {},
        parent_id: null,
        page_id: "page-1",
      },
      withComponentOriginMirror({
        id: "card-origin",
        type: "Card",
        props: {},
        parent_id: "body",
        page_id: "page-1",
      }),
      {
        id: "card-chart",
        type: "Chart",
        props: {
          ...ORIGIN_PROPS,
          dataMode: "columns",
          valueFields: ["desktop", "mobile"],
        },
        parent_id: "card-origin",
        page_id: "page-1",
      },
    ]);
    const first = useStore
      .getState()
      .createInstance("card-origin", "body", "page-1")!;
    const second = useStore
      .getState()
      .createInstance("card-origin", "body", "page-1")!;
    const originChartBefore = JSON.stringify(resolvedProps("card-chart"));

    // 인스턴스 루트 선택 + 자식(descendant) patch — 패널의 children batch 경로.
    useStore.getState().setSelectedElement(first.id);
    useStore.getState().updateSelectedPropertiesWithChildren({}, [
      {
        elementId: `${first.id}/card-chart`,
        props: {
          seriesConfig: [{ key: F("mobile"), label: "Mobile" }],
        } as never,
      },
    ]);
    await Promise.resolve();

    // 반증 시도: origin 자식과 형제 인스턴스가 바뀌었는가 — 바뀌면 가설이 깨진 것이다.
    expect(JSON.stringify(resolvedProps("card-chart"))).toBe(originChartBefore);
    const firstInstance = useStore.getState().elementsMap.get(first.id)!;
    const secondInstance = useStore.getState().elementsMap.get(second.id)!;
    const overrides = (
      firstInstance as unknown as { descendants?: Record<string, unknown> }
    ).descendants;
    expect(overrides?.["card-chart"]).toMatchObject({
      seriesConfig: [{ key: F("mobile"), label: "Mobile" }],
    });
    expect(
      (secondInstance as unknown as { descendants?: Record<string, unknown> })
        .descendants?.["card-chart"],
    ).toBeUndefined();

    await useStore.getState().undo();
    expect(
      (
        useStore.getState().elementsMap.get(first.id) as unknown as {
          descendants?: Record<string, unknown>;
        }
      ).descendants?.["card-chart"],
    ).toBeUndefined();
    expect(JSON.stringify(resolvedProps("card-chart"))).toBe(originChartBefore);
  });
});

describe("T09 — 같은 source 의 Chart 와 ListBox", () => {
  it("Chart 의 모드/형식 변경 뒤 ListBox props·collection 원본은 불변이다", async () => {
    seedPanelElements([
      {
        id: "body",
        type: "body",
        props: {},
        parent_id: null,
        page_id: "page-1",
      },
      {
        id: "chart",
        type: "Chart",
        props: {
          ...ORIGIN_PROPS,
          dataBinding: { source: "dataTable", name: "wide" },
        },
        parent_id: "body",
        page_id: "page-1",
      },
      {
        id: "list",
        type: "ListBox",
        props: {
          dataBinding: { source: "dataTable", name: "wide" },
          items: [],
        },
        parent_id: "body",
        page_id: "page-1",
      },
    ]);
    const listBefore = JSON.stringify(resolvedProps("list"));
    patchSelected("chart", {
      dataMode: "columns",
      valueFields: ["desktop", "mobile"],
      valueFormat: "percent",
      valuePercentUnit: "ratio",
    });
    await Promise.resolve();
    expect(resolvedProps("chart")).toMatchObject({
      dataMode: "columns",
      valueFormat: "percent",
    });
    expect(JSON.stringify(resolvedProps("list"))).toBe(listBefore);
    expect(resolvedProps("chart").data).toEqual(WIDE);
  });
});
