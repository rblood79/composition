import { Chart } from "../Chart";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CollectionDataProvider } from "../../hooks/CollectionDataProvider";
import { useCollectionData } from "../../hooks/useCollectionData";
import { useResolvedCollectionItems } from "../../hooks/useResolvedCollectionItems";
import { createCollectionSnapshotServices } from "../../collections/collectionSnapshot";
import {
  parseProjectData,
  serializeProjectData,
} from "../../utils/export.utils";
import type { DataBinding, DataTableDefinition } from "../../types";

let root: Root;
let host: HTMLDivElement;
afterEach(() => {
  root?.unmount();
  host?.remove();
  host = undefined!;
});
const binding = {
  source: "dataTable",
  name: "sales",
} as unknown as DataBinding;
function Probe() {
  const chart = useCollectionData({
    dataBinding: binding,
    componentName: "Chart",
  });
  const list = useResolvedCollectionItems({
    dataBinding: binding,
    componentName: "ListBox",
    items: [{ id: "fake" }],
    windowLimit: 10000,
  });
  return (
    <>
      <Chart
        dataBinding={binding}
        isAnimationActive={false}
        dimension="id"
        metric="value"
        chartType="line"
        style={{ width: 320, height: 240 }}
      />
      <output data-probe="chart">
        {JSON.stringify({
          count: chart.data.length,
          first: chart.data[0],
          loading: chart.loading,
          error: chart.error,
        })}
      </output>
      <output data-probe="list">
        {JSON.stringify({
          count: list.totalRows,
          first: list.rows[0]?.item,
          loading: list.loading,
          error: list.error,
        })}
      </output>
    </>
  );
}
function renderTable(table: DataTableDefinition) {
  if (!host) {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  }
  root.render(
    <CollectionDataProvider
      services={createCollectionSnapshotServices([table])}
    >
      <Probe />
    </CollectionDataProvider>,
  );
}
const result = (key: string) =>
  JSON.parse(host.querySelector(`[data-probe="${key}"]`)?.textContent || "{}");
describe("ADR-209 공통 collection runtime 공급", () => {
  for (const count of [201, 5000])
    it(`${count}행은 chart와 list가 같은 전체 rows를 읽는다`, async () => {
      const rows = Array.from({ length: count }, (_, i) => ({
        id: String(i),
        category: `C${i}`,
        value: i,
      }));
      const table = {
        id: "table",
        name: "sales",
        mockData: [{ id: "fake" }],
        runtimeData: rows,
        useMockData: false,
      };
      // Builder 메모리 없이 publish JSON만으로 공급할 수 있는지 같은 envelope를 왕복한다.
      const decoded = parseProjectData(
        serializeProjectData(
          "00000000-0000-0000-0000-000000000209",
          "Chart",
          { version: "composition-1.0", children: [] },
          undefined,
          undefined,
          undefined,
          [table],
        ),
      );
      expect(decoded.success).toBe(true);
      if (!decoded.success) return;
      renderTable(decoded.data.collections![0]);
      await vi.waitFor(() => expect(result("chart").count).toBe(count));
      expect(result("list").count).toBe(count);
      expect(result("list").first).toEqual(result("chart").first);
      await vi.waitFor(() =>
        expect(
          host
            .querySelector(".react-aria-Chart")
            ?.getAttribute("data-chart-row-count"),
        ).toBe(String(count)),
      );
      await vi.waitFor(() =>
        expect(
          (
            host
              .querySelector(".recharts-line-curve")
              ?.getAttribute("d")
              ?.match(/L/g) ?? []
          ).length,
        ).toBe(count - 1),
      );
      renderTable({ ...table, runtimeData: [] });
      await vi.waitFor(() => expect(result("chart").count).toBe(0));
      expect(result("list").count).toBe(0);
      expect(result("chart").loading).toBe(false);
    });
  it("loading/error를 mock 성공으로 바꾸지 않고 명시 mock은 공통 정책을 따른다", async () => {
    const table: DataTableDefinition = {
      id: "table",
      name: "sales",
      mockData: [{ id: "mock" }],
      runtimeData: [{ id: "old" }],
      useMockData: false,
      status: "loading",
    };
    renderTable(table);
    await vi.waitFor(() => expect(result("chart").loading).toBe(true));
    expect(result("chart").count).toBe(0);
    expect(result("list").count).toBe(0);
    renderTable({ ...table, status: "error", error: "offline" });
    await vi.waitFor(() => expect(result("chart").error).toBe("offline"));
    expect(result("list").error).toBe("offline");
    // DataTable snapshot은 공급자의 갱신을 기다린다. 동작하지 않는 재시도 버튼을 노출하지 않는다.
    expect(host.querySelector(".react-aria-Chart button")).toBeNull();
    renderTable({ ...table, useMockData: true });
    await vi.waitFor(() =>
      expect(result("chart").first).toEqual({ id: "mock" }),
    );
    expect(result("list").first).toEqual({ id: "mock" });
  });
});
