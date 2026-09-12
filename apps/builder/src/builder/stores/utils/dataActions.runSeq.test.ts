/**
 * ADR-218 (R2/HC5) — 요청 경쟁 single-flight. 같은 collection 을 향한 두 실행이 역순으로
 * 완료돼도(늦은 A · 빠른 B) 최신 실행(B)의 응답만 store 에 남는다.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createExecuteApiEndpointAction } from "./dataActions";
import type { ApiEndpoint, DataTable } from "../../../types/builder/data.types";

vi.mock("../../panels/datatable/utils/secretVault", () => ({
  getProjectSecrets: async () => new Map(),
  getSecretRevisions: async () => new Map(),
  substituteSecrets: (t: string) => t,
}));
vi.mock("../../../lib/db", () => ({
  getDB: async () => ({ collection_runtime: { put: async () => {} } }),
}));
vi.mock("./dataChange", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, syncCollectionsToCanvas: vi.fn() };
});

const endpoint = (): ApiEndpoint => ({
  id: "ep1",
  name: "getUsers",
  project_id: "p",
  method: "GET",
  baseUrl: "https://api.x",
  path: "/users",
  headers: [],
  queryParams: [],
  bodyType: "none",
  responseMapping: { dataPath: "" },
  executionMode: "client",
  timeout: 5000,
  retryCount: 0,
  targetCollectionId: "c1",
});

const collection = (): DataTable => ({
  id: "c1",
  name: "Users",
  project_id: "p",
  schema: [{ id: "f1", key: "name", type: "string" }],
  mockData: [],
  useMockData: false,
});

function makeStore() {
  const state = {
    apiEndpoints: new Map([[endpoint().name, endpoint()]]),
    collections: new Map([["c1", collection()]]),
    loadingApis: new Set<string>(),
    apiRuns: new Map(),
    errors: new Map(),
  };
  const set = vi.fn((patch: unknown) => {
    Object.assign(state, typeof patch === "function" ? patch(state) : patch);
  });
  const get = () => state;
  return { state, set: set as never, get: get as never };
}

afterEach(() => vi.restoreAllMocks());

describe("execute single-flight (runSeq)", () => {
  it("늦은 A / 빠른 B 역순 완료 → 최신 B 응답만 남는다", async () => {
    const { state, set, get } = makeStore();
    const execute = createExecuteApiEndpointAction(set, get);

    // A 는 느리게, B 는 빠르게 resolve. 둘 다 같은 endpoint(같은 target c1).
    let resolveA: (value?: unknown) => void = () => {};
    const bodyFor = (rows: unknown) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Map(),
      text: async () => JSON.stringify(rows),
    });
    const fetchMock = vi
      .fn()
      // 1st call (A): 지연
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveA = () => res(bodyFor([{ name: "A" }]));
          }),
      )
      // 2nd call (B): 즉시
      .mockImplementationOnce(async () => bodyFor([{ name: "B" }]));
    vi.stubGlobal("fetch", fetchMock);

    const pA = execute("ep1"); // A 시작 (seq 1)
    const pB = execute("ep1"); // B 시작 (seq 2)
    await pB; // B 먼저 완료 → c1.runtimeData = [{name:B}]
    expect(state.collections.get("c1")!.runtimeData).toEqual([{ name: "B" }]);
    resolveA(); // A 뒤늦게 완료 → seq 불일치라 폐기
    await pA;
    expect(state.collections.get("c1")!.runtimeData).toEqual([{ name: "B" }]);
  });
});
