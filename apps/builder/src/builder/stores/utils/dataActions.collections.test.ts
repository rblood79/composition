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

const dbMock = {
  collections: {
    getByProject: vi.fn(async () => [] as DataTable[]),
    insert: vi.fn(async (dt: DataTable) => dt),
    update: vi.fn(
      async (_id: string, _updates: Partial<DataTable>) => ({}) as DataTable,
    ),
    delete: vi.fn(async () => undefined),
  },
};
vi.mock("../../../lib/db", () => ({ getDB: async () => dbMock }));

import {
  createCreateDataTableAction,
  createDeleteDataTableAction,
  createExecuteApiEndpointAction,
  createFetchDataTablesAction,
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
    loadingApis: new Set<string>(),
    errors: new Map(),
    isLoading: false,
    ...init,
  };
  const set = (patch: unknown) => {
    Object.assign(state, typeof patch === "function" ? patch(state) : patch);
  };
  const get = () => state;
  const collections = () => state.collections as Map<string, DataTable>;
  return { state, set: set as never, get: get as never, collections };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("fetchCollections — 정규화 + id 키 + 1회 write-back (R8)", () => {
  it("id 없는 collection 만 write-back 하고 Map 은 id 키다", async () => {
    dbMock.collections.getByProject.mockResolvedValueOnce([
      table("c1", "Users", [{ key: "name", type: "string" }]),
      table("c2", "Roles", [{ id: "r1", key: "role", type: "string" }]),
    ]);
    const { set, get, collections } = makeStore();
    await createFetchDataTablesAction(set)("p");

    expect([...collections().keys()]).toEqual(["c1", "c2"]);
    expect(collections().get("c1")?.schema[0].id).toMatch(/\S+/);
    expect(dbMock.collections.update).toHaveBeenCalledTimes(1);
    expect(dbMock.collections.update.mock.calls[0][0]).toBe("c1");
    expect(get).toBeTypeOf("function");
  });

  it("두 번째 로드 (id 가 이미 있음) 는 write 0", async () => {
    dbMock.collections.getByProject.mockResolvedValueOnce([
      table("c1", "Users", [{ id: "f1", key: "name", type: "string" }]),
    ]);
    const { set } = makeStore();
    await createFetchDataTablesAction(set)("p");
    expect(dbMock.collections.update).not.toHaveBeenCalled();
  });

  it("write-back 실패를 주입해도 로드는 유효하다 (throw 0 · 메모리 id 유지)", async () => {
    dbMock.collections.getByProject.mockResolvedValueOnce([
      table("c1", "Users", [{ key: "name", type: "string" }]),
    ]);
    dbMock.collections.update.mockRejectedValueOnce(new Error("quota"));
    const { set, collections, state } = makeStore();
    await expect(
      createFetchDataTablesAction(set)("p"),
    ).resolves.toBeUndefined();
    expect(collections().get("c1")?.schema[0].id).toMatch(/\S+/);
    expect((state.errors as Map<string, Error>).size).toBe(0);
    expect(state.isLoading).toBe(false);
  });
});

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

  it("rename 은 키를 옮기지 않고 (id 고정) DB 에 정규화된 schema 를 쓴다", async () => {
    const existing = table("c1", "Users", [
      { id: "f1", key: "name", type: "string" },
    ]);
    const { set, get, collections } = makeStore({
      collections: new Map([["c1", existing]]),
    });
    await createUpdateDataTableAction(set, get)("c1", {
      name: "People",
      schema: [...existing.schema, { key: "email", type: "email" }],
    });
    const updated = collections().get("c1")!;
    expect(updated.name).toBe("People");
    expect(collections().size).toBe(1);
    expect(updated.schema[0].id).toBe("f1");
    expect(updated.schema[1].id).toMatch(/\S+/);
    const written = dbMock.collections.update.mock.calls[0][1] as {
      schema: DataTable["schema"];
    };
    expect(written.schema[1].id).toBe(updated.schema[1].id);
  });

  it("delete 는 id 로 지운다", async () => {
    const { set, get, collections } = makeStore({
      collections: new Map([["c1", table("c1", "Users", [])]]),
    });
    await createDeleteDataTableAction(set, get)("c1");
    expect(collections().size).toBe(0);
    expect(dbMock.collections.delete).toHaveBeenCalledWith("c1");
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
      vi.fn(async () => ({ ok: true, json: async () => rows })),
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
