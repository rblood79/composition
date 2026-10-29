/**
 * ADR-152 Phase 1 — collections store 액션의 id 키 · 정규화 · write-back (R8 / R11).
 *
 * - fetch: id 없는 collection 만 hydrate 직후 1회 write-back · 두 번째 로드는 write 0
 * - write-back 실패 주입 → 로드는 유효 (throw 0, 메모리 id 로 동작)
 * - create / update / delete: Map 은 id 키, rename 시 re-key 없음, 새 필드에 id 부여
 * - setRuntimeData / getDataTableData: 공개 시그니처 (name) 유지 — id 로도 찾힌다
 * - executeApi sink: targetCollectionId 우선 · targetCollection (이름) fallback
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiEndpoint, DataTable } from "../../../types/builder/data.types";

// ADR-286: definitions are document writes (the test sink); the DB holds the API rows cache only.
const dbMock = {
  collection_runtime: { put: vi.fn(async () => undefined) },
};
vi.mock("../../../lib/db", () => ({ getDB: async () => dbMock }));

import {
  attachTestDataStore,
  installTestDataChangeRecorder,
  testDataCommits,
} from "./__tests__/support/dataChangeRecorder";
import {
  createCreateDataTableAction,
  createDeleteDataTableAction,
  createExecuteApiEndpointAction,
  createGetDataTableDataAction,
  createSetRuntimeDataAction,
  createUpdateDataTableAction,
} from "./dataActions";

const table = (
  id: string,
  name: string,
  schema: DataTable["schema"],
): DataTable => ({
  id,
  name,
  project_id: "p",
  schema,
  mockData: [{ name: "a" }],
  useMockData: true,
});

function makeStore(init: Partial<Record<string, unknown>> = {}) {
  const state: Record<string, unknown> = {
    collections: new Map<string, DataTable>(),
    apiEndpoints: new Map<string, ApiEndpoint>(),
    variables: new Map(),
    runtimeRows: new Map(),
    loadingApis: new Set<string>(),
    apiRuns: new Map(),
    errors: new Map(),
    isLoading: false,
    ...init,
  };
  const set = (patch: unknown) => {
    Object.assign(state, typeof patch === "function" ? patch(state) : patch);
  };
  const get = () => state;
  attachTestDataStore(set as never, get as never);
  const collections = () => state.collections as Map<string, DataTable>;
  return { state, set: set as never, get: get as never, collections };
}

beforeEach(() => {
  vi.clearAllMocks();
  testDataCommits.length = 0;
  installTestDataChangeRecorder(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("create / update / delete — id 키 (HC8)", () => {
  it("create 는 id 키로 넣고 새 필드에 id 를 부여한다", async () => {
    const { set, get, collections } = makeStore();
    const created = await createCreateDataTableAction(
      set,
      get,
    )({
      name: "Users",
      project_id: "p",
      schema: [{ key: "name", type: "string" }],
    });
    expect(collections().get(created.id)).toBe(created);
    expect(collections().get("Users")).toBeUndefined();
    expect(created.schema[0].id).toMatch(/\S+/);
  });

  it("rename 은 키를 옮기지 않고 (id 고정) 문서에 정규화된 schema 를 쓴다", async () => {
    const existing = table("c1", "Users", [
      { id: "f1", key: "name", type: "string" },
    ]);
    const { set, get, collections } = makeStore({
      collections: new Map([["c1", existing]]),
    });
    await createUpdateDataTableAction(set, get)("c1", {
      name: "People",
      schema: [...existing.schema, { key: "email", type: "string", format: "email" }],
    });
    const updated = collections().get("c1")!;
    expect(updated.name).toBe("People");
    expect(collections().size).toBe(1);
    expect(updated.schema[0].id).toBe("f1");
    expect(updated.schema[1].id).toMatch(/\S+/);
    const written = testDataCommits.at(-1)!.collections![0]!;
    expect(written.schema[1].id).toBe(updated.schema[1].id);
  });

  it("delete 는 id 로 지운다", async () => {
    const { set, get, collections } = makeStore({
      collections: new Map([["c1", table("c1", "Users", [])]]),
    });
    await createDeleteDataTableAction(set, get)("c1");
    expect(collections().size).toBe(0);
    expect(testDataCommits.at(-1)!.collectionsDeleted).toEqual(["c1"]);
  });
});

describe("name 시그니처 액션 — 헬퍼 경유 (R11)", () => {
  const seed = () =>
    makeStore({
      collections: new Map([["c1", table("c1", "Users", [])]]),
    });

  it("getDataTableData(name) · getDataTableData(id) 둘 다 찾는다", () => {
    const { get } = seed();
    const read = createGetDataTableDataAction(get);
    expect(read("Users")).toEqual([{ name: "a" }]);
    expect(read("c1")).toEqual([{ name: "a" }]);
    expect(read("nope")).toEqual([]);
  });

  it("setRuntimeData(name) 은 id 키 항목을 갱신한다", () => {
    const { set, get, collections } = seed();
    createSetRuntimeDataAction(set, get)("Users", [{ name: "rt" }]);
    expect(collections().get("c1")?.runtimeData).toEqual([{ name: "rt" }]);
    expect(collections().has("Users")).toBe(false);
    // ADR-286: API rows are not the document — no write.
    expect(testDataCommits).toHaveLength(0);
  });
});

describe("executeApiEndpoint sink — targetCollectionId 우선", () => {
  const endpoint = (overrides: Partial<ApiEndpoint>): ApiEndpoint => ({
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
    ...overrides,
  });
  const rows = [{ id: 1 }];

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        text: async () => JSON.stringify(rows),
        json: async () => rows,
      })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("targetCollectionId 로 찾고 (이름이 stale 이어도) id 키에 runtimeData 를 넣는다", async () => {
    const ep = endpoint({
      targetCollectionId: "c1",
      targetCollection: "OldName",
    });
    const { set, get, collections } = makeStore({
      apiEndpoints: new Map([["api_1", ep]]),
      collections: new Map([["c1", table("c1", "Users", [])]]),
    });
    await createExecuteApiEndpointAction(set, get)("api_1");
    expect(collections().get("c1")?.runtimeData).toEqual(rows);
  });

  it("targetCollectionId 가 없으면 이름 fallback", async () => {
    const ep = endpoint({ targetCollection: "Users" });
    const { set, get, collections } = makeStore({
      apiEndpoints: new Map([["api_1", ep]]),
      collections: new Map([["c1", table("c1", "Users", [])]]),
    });
    await createExecuteApiEndpointAction(set, get)("api_1");
    expect(collections().get("c1")?.runtimeData).toEqual(rows);
  });
});
