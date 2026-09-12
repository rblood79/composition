/**
 * ADR-218 — runtimeData 캐시 hydration (createHydrateRuntimeCacheAction).
 *
 * 지문(sourceRev) 유효한 캐시만 복원, 무효/고아는 폐기, rename 은 값 보존 remap.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiEndpoint, DataTable } from "../../../types/builder/data.types";
import type { CollectionRuntimeRow } from "@composition/shared";
import { computeSourceRev } from "../../panels/datatable/utils/sourceRev";

// getSecretRevisions → 빈 맵 (secret 없음)
vi.mock("../../panels/datatable/utils/secretVault", () => ({
  getProjectSecrets: async () => new Map(),
  getSecretRevisions: async () => new Map(),
  substituteSecrets: (t: string) => t,
}));

const runtimeStore: {
  rows: Map<string, CollectionRuntimeRow>;
  deleted: string[];
} = { rows: new Map(), deleted: [] };

const dbMock = {
  collection_runtime: {
    getByProject: async (pid: string) =>
      [...runtimeStore.rows.values()].filter((r) => r.project_id === pid),
    get: async (id: string) => runtimeStore.rows.get(id) ?? null,
    put: async (row: CollectionRuntimeRow) => {
      runtimeStore.rows.set(row.collectionId, row);
    },
    delete: async (id: string) => {
      runtimeStore.deleted.push(id);
      runtimeStore.rows.delete(id);
    },
  },
};
vi.mock("../../../lib/db", () => ({ getDB: async () => dbMock }));
vi.mock("./dataChange", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, syncCollectionsToCanvas: vi.fn() };
});

import { createHydrateRuntimeCacheAction } from "./dataActions";

const table = (overrides: Partial<DataTable> = {}): DataTable => ({
  id: "c1",
  name: "Users",
  project_id: "p",
  schema: [
    { id: "f1", key: "name", type: "string" },
    { id: "f2", key: "age", type: "number" },
  ],
  mockData: [],
  useMockData: false,
  ...overrides,
});

const endpoint = (overrides: Partial<ApiEndpoint> = {}): ApiEndpoint => ({
  id: "api_1",
  name: "getUsers",
  project_id: "p",
  method: "GET",
  baseUrl: "https://api.x",
  path: "/users",
  headers: [],
  queryParams: [],
  bodyType: "none",
  responseMapping: { dataPath: "data" },
  executionMode: "client",
  timeout: 1000,
  retryCount: 0,
  targetCollectionId: "c1",
  ...overrides,
});

function makeStore(tables: DataTable[], endpoints: ApiEndpoint[]) {
  const state = {
    collections: new Map(tables.map((t) => [t.id, t])),
    apiEndpoints: new Map(endpoints.map((e) => [e.name, e])),
  };
  const set = vi.fn((patch: unknown) => {
    Object.assign(state, typeof patch === "function" ? patch(state) : patch);
  });
  const get = () => state;
  return { state, set: set as never, get: get as never };
}

/** 현재 정의로 유효한 지문 계산 (테스트가 저장 지문을 이 값으로 세팅). */
function validRev(t: DataTable, ep: ApiEndpoint) {
  return computeSourceRev({
    endpoint: ep,
    schema: t.schema,
    secretRevisions: new Map(),
  });
}

beforeEach(() => {
  runtimeStore.rows = new Map();
  runtimeStore.deleted = [];
});
afterEach(() => vi.clearAllMocks());

describe("createHydrateRuntimeCacheAction", () => {
  it("지문 일치 → runtimeData 복원", async () => {
    const t = table();
    const ep = endpoint();
    runtimeStore.rows.set("c1", {
      collectionId: "c1",
      project_id: "p",
      runtimeData: [{ name: "a", age: 1 }],
      sourceRev: validRev(t, ep),
      fieldKeys: { f1: "name", f2: "age" },
      updated_at: "t",
    });
    const { state, set, get } = makeStore([t], [ep]);
    await createHydrateRuntimeCacheAction(set, get)("p");
    expect(state.collections.get("c1")!.runtimeData).toEqual([
      { name: "a", age: 1 },
    ]);
    expect(runtimeStore.deleted).toEqual([]);
  });

  it("지문 불일치(엔드포인트 path 변경) → 캐시 폐기, runtimeData 미복원", async () => {
    const t = table();
    const staleRev = validRev(t, endpoint({ path: "/old" }));
    runtimeStore.rows.set("c1", {
      collectionId: "c1",
      project_id: "p",
      runtimeData: [{ name: "a", age: 1 }],
      sourceRev: staleRev,
      updated_at: "t",
    });
    const { state, set, get } = makeStore([t], [endpoint({ path: "/new" })]);
    await createHydrateRuntimeCacheAction(set, get)("p");
    expect(state.collections.get("c1")!.runtimeData).toBeUndefined();
    expect(runtimeStore.deleted).toContain("c1");
  });

  it("field rename(같은 id) → 현재 key 로 remap 복원 (옛 key 섞임 0)", async () => {
    // 저장 시 key=name, 이후 name→fullName rename. 지문은 id 기반이라 유효.
    const renamed = table({
      schema: [
        { id: "f1", key: "fullName", type: "string" },
        { id: "f2", key: "age", type: "number" },
      ],
    });
    const ep = endpoint();
    runtimeStore.rows.set("c1", {
      collectionId: "c1",
      project_id: "p",
      runtimeData: [{ name: "a", age: 1 }],
      sourceRev: validRev(renamed, ep), // id 기반이라 rename 후에도 동일
      fieldKeys: { f1: "name", f2: "age" }, // 저장 시점 key
      updated_at: "t",
    });
    const { state, set, get } = makeStore([renamed], [ep]);
    await createHydrateRuntimeCacheAction(set, get)("p");
    const rd = state.collections.get("c1")!.runtimeData!;
    expect(rd[0]).toEqual({ fullName: "a", age: 1 });
    expect(rd[0]).not.toHaveProperty("name");
    expect(runtimeStore.deleted).toEqual([]);
  });

  it("정의 없는 고아 캐시 → 삭제", async () => {
    runtimeStore.rows.set("ghost", {
      collectionId: "ghost",
      project_id: "p",
      runtimeData: [{ x: 1 }],
      sourceRev: "any",
      updated_at: "t",
    });
    const { set, get } = makeStore([table()], [endpoint()]);
    await createHydrateRuntimeCacheAction(set, get)("p");
    expect(runtimeStore.deleted).toContain("ghost");
  });

  it("연결된 endpoint 없음 → 캐시 폐기 (지문 계산 불가)", async () => {
    const t = table();
    runtimeStore.rows.set("c1", {
      collectionId: "c1",
      project_id: "p",
      runtimeData: [{ name: "a" }],
      sourceRev: "x",
      updated_at: "t",
    });
    const { state, set, get } = makeStore([t], []); // endpoint 없음
    await createHydrateRuntimeCacheAction(set, get)("p");
    expect(state.collections.get("c1")!.runtimeData).toBeUndefined();
    expect(runtimeStore.deleted).toContain("c1");
  });
});
