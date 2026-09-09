import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { Chart } from "../Chart";
import { CollectionDataProvider } from "../../hooks/CollectionDataProvider";
import {
  useCollectionData,
  collectionDataCache,
} from "../../hooks/useCollectionData";
import { useResolvedCollectionItems } from "../../hooks/useResolvedCollectionItems";
import { createCollectionSnapshotServices } from "../../collections/collectionSnapshot";
import type { ApiEndpointDefinition, DataBinding } from "../../types";
let root: Root;
let host: HTMLDivElement;
afterEach(() => {
  root?.unmount();
  host?.remove();
  host = undefined!;
  vi.unstubAllGlobals();
  collectionDataCache.clear();
});
const binding = { source: "api", name: "sales" } as unknown as DataBinding;
function Consumer() {
  const chart = useCollectionData({
    dataBinding: binding,
    componentName: "Chart",
  });
  const list = useResolvedCollectionItems({
    dataBinding: binding,
    componentName: "ListBox",
    items: [{ id: "fake" }],
  });
  return (
    <>
      <Chart
        chartType="bar"
        dataBinding={binding}
        data={[{ category: "fake", value: 99 }]}
        isAnimationActive={false}
        style={{ width: 320, height: 240 }}
      />
      <output>
        {JSON.stringify({
          chart: chart.data,
          list: list.rows.map((row) => row.item),
          loading: chart.loading,
          error: chart.error,
        })}
      </output>
    </>
  );
}
function render(endpoint?: ApiEndpointDefinition) {
  if (!host) {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  }
  root.render(
    <CollectionDataProvider
      services={createCollectionSnapshotServices(
        [],
        endpoint ? [endpoint] : [],
      )}
    >
      <Consumer />
    </CollectionDataProvider>,
  );
}
const state = () =>
  JSON.parse(host.querySelector("output")?.textContent || "{}");
const endpoint: ApiEndpointDefinition = {
  id: "api-a",
  name: "sales",
  baseUrl: "https://fixture.invalid",
  path: "/sales",
  method: "GET",
  responseMapping: { dataPath: "payload.rows" },
  queryParams: [{ key: "page", value: "1" }],
};
it("API 지연·빈 성공·오류·source 변경 취소: Chart/List는 한 공통 요청을 공유한다", async () => {
  const calls: Array<{
    url: string;
    signal: AbortSignal;
    resolve: (value: Response) => void;
  }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (url: URL, init: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          const signal = init.signal as AbortSignal;
          calls.push({ url: String(url), signal, resolve });
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    ),
  );
  render(endpoint);
  await vi.waitFor(() => expect(calls.length).toBe(1));
  expect(calls[0].url).toBe("https://fixture.invalid/sales?page=1");
  expect(state().loading).toBe(true);
  expect(
    host.querySelector(".react-aria-Chart")?.getAttribute("data-chart-status"),
  ).toBe("loading");
  const rows = [{ id: "one", category: "A", value: 209 }];
  calls[0].resolve(new Response(JSON.stringify({ payload: { rows } })));
  await vi.waitFor(() => expect(state().chart).toEqual(rows));
  expect(state().list).toEqual(rows);
  await vi.waitFor(() =>
    expect(host.querySelectorAll(".recharts-bar-rectangle path").length).toBe(
      1,
    ),
  );
  render({ ...endpoint, id: "api-b", path: "/empty" });
  await vi.waitFor(() => expect(calls.length).toBe(2));
  render({ ...endpoint, id: "api-c", path: "/latest" });
  await vi.waitFor(() => expect(calls.length).toBe(3));
  expect(calls[1].signal.aborted).toBe(true);
  calls[2].resolve(new Response(JSON.stringify({ payload: { rows: [] } })));
  await vi.waitFor(() => expect(state().loading).toBe(false));
  expect(state().chart).toEqual([]);
  expect(state().list).toEqual([]);
  expect(
    host.querySelector(".react-aria-Chart")?.getAttribute("data-chart-status"),
  ).toBe("empty");
  render({ ...endpoint, id: "api-d", path: "/error" });
  await vi.waitFor(() => expect(calls.length).toBe(4));
  calls[3].resolve(
    new Response("offline", { status: 503, statusText: "Unavailable" }),
  );
  await vi.waitFor(() => expect(state().error).toContain("503"));
  expect(
    host.querySelector(".react-aria-Chart")?.getAttribute("data-chart-status"),
  ).toBe("error");
});
it("server 실행 endpoint를 browser fetch로 우회하지 않는다", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render({ ...endpoint, executionMode: "server" });
  await vi.waitFor(() => expect(state().error).toContain("서버 API"));
  expect(fetch).not.toHaveBeenCalled();
});
it("Preview의 늦은 endpoint hydration과 오류 후 재시도는 이전 오류를 표시하지 않는다", async () => {
  const rows = [{ id: "one", category: "A", value: 209 }];
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ payload: { rows } })))
    .mockResolvedValueOnce(new Response("offline", { status: 503 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ payload: { rows } })));
  vi.stubGlobal("fetch", fetchMock);
  render();
  await vi.waitFor(() => expect(state().error).toContain("찾을 수 없습니다"));
  render(endpoint);
  await vi.waitFor(() => expect(state().chart).toEqual(rows));
  expect(state().error).toBeNull();
  expect(
    host.querySelector(".react-aria-Chart")?.getAttribute("data-chart-status"),
  ).toBe("ready");
  render({ ...endpoint, path: "/retry" });
  await vi.waitFor(() => expect(state().error).toContain("503"));
  expect(state().chart).toEqual([]);
  host.querySelector<HTMLButtonElement>(".react-aria-Chart button")!.click();
  await vi.waitFor(() =>
    expect(
      host
        .querySelector(".react-aria-Chart")
        ?.getAttribute("data-chart-status"),
    ).toBe("ready"),
  );
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
