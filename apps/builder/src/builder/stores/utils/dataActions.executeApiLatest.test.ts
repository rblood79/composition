/**
 * 2026-10-05 감사 L9 — API 실행 결과 (runtimeData) 는 지금의 collections 에 붙인다. 실행 중
 * await 사이에 끝난 사용자 편집 (다른 collection 추가 · 행 편집) 을 옛 Map 으로 되돌리지 않는다.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ApiEndpoint,
  ApiRunRecord,
  DataTable,
} from "../../../types/builder/data.types";

const hooks = vi.hoisted(() => ({ duringSecrets: [] as (() => void)[] }));
vi.mock("../../panels/datatable/utils/secretVault", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getSecretRevisions: async () => {
    hooks.duringSecrets.shift()?.();
    return {};
  },
}));

vi.mock("../../../lib/db", () => ({
  getDB: async () => ({ collection_runtime: { put: async () => {} } }),
}));

const { createExecuteApiEndpointAction } = await import("./dataActions");

const table = (id: string): DataTable => ({
  id,
  name: id,
  project_id: "p",
  schema: [{ id: "f_name", key: "name", type: "string" }],
  mockData: [],
  useMockData: false,
});

describe("executeApiEndpoint — 최신 collections 에 반영", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("실행 중 추가된 collection 이 결과 반영 뒤에도 남는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        text: async () => JSON.stringify([{ name: "x" }]),
      })),
    );
    const ep: ApiEndpoint = {
      id: "api_1",
      name: "users",
      project_id: "p",
      method: "GET",
      baseUrl: "https://example.test",
      path: "/users",
      headers: [],
      queryParams: [],
      bodyType: "none",
      responseMapping: { dataPath: "" },
      executionMode: "client",
      timeout: 1000,
      retryCount: 0,
      targetCollectionId: "c1",
    };
    const state = {
      apiEndpoints: new Map([[ep.name, ep]]),
      collections: new Map([["c1", table("c1")]]),
      loadingApis: new Set<string>(),
      apiRuns: new Map<string, ApiRunRecord>(),
      errors: new Map(),
    };
    const set = (patch: unknown) =>
      Object.assign(state, typeof patch === "function" ? patch(state) : patch);
    // 시작 지문 조회는 그대로, 완료 지문 조회 (결과 반영 직전 await) 중에 사용자가 c2 를 만든다.
    hooks.duringSecrets.push(
      () => {},
      () => {
        state.collections = new Map(state.collections).set("c2", table("c2"));
      },
    );
    await createExecuteApiEndpointAction(set as never, (() => state) as never)(
      "api_1",
    );
    expect([...state.collections.keys()].sort()).toEqual(["c1", "c2"]);
    expect(state.collections.get("c1")!.runtimeData).toEqual([{ name: "x" }]);
  });
});
