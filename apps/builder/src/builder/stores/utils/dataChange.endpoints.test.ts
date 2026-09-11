/**
 * ADR-213 Phase 4 — `define_endpoint` · `delete_endpoint` (API endpoint 축을 ADR-152 적용기에 통합).
 *
 * - reduce: create (id 발급 · 기본값 채움 · applied 에 id) / update (draft 필드만 덮고 나머지 보존 ·
 *   rename 은 name 키 재발급) / delete · 역연산 왕복 · 없는 id 거부 · 이름 고유
 * - apply: IndexedDB `api_endpoints` insert/update/delete · 메모리 Map (name 키) · History 1 ·
 *   collections/variables 무변경 · 바인딩 실패 시 endpoint 까지 rollback (cross-store)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataOp } from "@composition/shared";
import type {
  ApiEndpoint,
  DataTable,
  Variable,
} from "../../../types/builder/data.types";

const dbMock = {
  collections: {
    insert: vi.fn(async (dt: DataTable) => dt),
    update: vi.fn(async () => ({}) as DataTable),
    delete: vi.fn(async () => undefined),
  },
  variables: {
    insert: vi.fn(async (v: Variable) => v),
    update: vi.fn(async () => ({}) as Variable),
    delete: vi.fn(async () => undefined),
  },
  api_endpoints: {
    insert: vi.fn(async (ep: ApiEndpoint) => ep),
    update: vi.fn(
      async (_id: string, _u: Partial<ApiEndpoint>) => ({}) as ApiEndpoint,
    ),
    delete: vi.fn(async () => undefined),
  },
};
vi.mock("../../../lib/db", () => ({ getDB: async () => dbMock }));

const addEntry = vi.fn();
vi.mock("../history", () => ({
  historyManager: { addEntry: (...args: unknown[]) => addEntry(...args) },
}));
vi.mock("../canonical/canonicalElementsBridge", () => ({
  getActiveCanonicalDocument: () => null,
}));

import {
  DataChangeError,
  createApplyDataChangeAction,
  reduceDataOps,
  registerDataBindingConsumer,
} from "./dataChange";

const endpoint = (patch: Partial<ApiEndpoint>): ApiEndpoint => ({
  id: "ep_users",
  name: "getUsers",
  project_id: "p",
  method: "GET",
  baseUrl: "https://api.example.com",
  path: "/users",
  headers: [{ key: "X-API-Key", value: "{{secret.X_API_KEY}}", enabled: true }],
  queryParams: [],
  bodyType: "none",
  responseMapping: { dataPath: "data" },
  executionMode: "client",
  timeout: 30000,
  retryCount: 0,
  targetCollectionId: "users",
  ...patch,
});

const seedEndpoints = () =>
  new Map<string, ApiEndpoint>([["getUsers", endpoint({})]]);

const ctx = () => ({ projectId: "p", apiEndpoints: seedEndpoints() });

describe("reduceDataOps — define_endpoint / delete_endpoint", () => {
  it("create: id 발급 · 기본값 (headers [] · bodyType none · client · dataPath) · applied 에 id · inverse 는 delete_endpoint", () => {
    const ops: DataOp[] = [
      {
        op: "define_endpoint",
        endpoint: {
          name: "bearerCheck",
          method: "GET",
          baseUrl: "https://httpbin.org",
          path: "/bearer",
          dataPath: "",
        },
      },
    ];
    const out = reduceDataOps(new Map(), ops, ctx());
    expect(out.collections.size).toBe(0);
    expect(out.apiEndpoints.size).toBe(2);
    const created = out.apiEndpoints.get("bearerCheck")!;
    expect(created).toMatchObject({
      name: "bearerCheck",
      project_id: "p",
      method: "GET",
      baseUrl: "https://httpbin.org",
      path: "/bearer",
      headers: [],
      queryParams: [],
      bodyType: "none",
      responseMapping: { dataPath: "" },
      executionMode: "client",
    });
    expect(created.id).toMatch(/\S/);
    expect(out.endpointsUpserted).toEqual(new Set([created.id]));
    expect(out.applied[0]).toMatchObject({
      op: "define_endpoint",
      endpoint: { id: created.id, name: "bearerCheck" },
    });
    expect(out.inverse).toEqual([
      { op: "delete_endpoint", endpointId: created.id },
    ]);
  });

  it("update: draft 가 준 필드만 덮고 (headers 교체) 나머지 보존 · rename 은 name 키 재발급 · inverse 는 이전 정의 전체", () => {
    const ops: DataOp[] = [
      {
        op: "define_endpoint",
        endpoint: {
          id: "ep_users",
          name: "listUsers",
          method: "GET",
          baseUrl: "https://api.example.com",
          path: "/users",
          headers: [
            { key: "X-API-Key", value: "{{secret.X_API_KEY}}", enabled: true },
            {
              key: "Authorization",
              value: "Bearer {{secret.TOKEN}}",
              enabled: true,
            },
          ],
        },
      },
    ];
    const out = reduceDataOps(new Map(), ops, ctx());
    expect(out.apiEndpoints.has("getUsers")).toBe(false);
    const next = out.apiEndpoints.get("listUsers")!;
    expect(next.id).toBe("ep_users");
    expect(next.headers).toHaveLength(2);
    expect(next.targetCollectionId).toBe("users"); // 보존
    expect(next.responseMapping).toEqual({ dataPath: "data" }); // 보존
    expect(next.timeout).toBe(30000);
    expect(out.endpointsUpserted).toEqual(new Set(["ep_users"]));
    expect(out.inverse[0]).toMatchObject({
      op: "define_endpoint",
      endpoint: {
        id: "ep_users",
        name: "getUsers",
        headers: [
          { key: "X-API-Key", value: "{{secret.X_API_KEY}}", enabled: true },
        ],
        dataPath: "data",
        targetCollectionId: "users",
      },
    });
    // 왕복
    const back = reduceDataOps(new Map(), out.inverse, {
      projectId: "p",
      apiEndpoints: out.apiEndpoints,
    });
    const { updated_at: _ignored, ...restored } =
      back.apiEndpoints.get("getUsers")!;
    expect(restored).toEqual(endpoint({}));
  });

  it("update: patch 의 `{{secret.KEY}}` placeholder 는 같은 키의 기존 원문을 보존한다 (AI 가 redacted 정의를 그대로 돌려줘도 secret 이 지워지지 않음 — live 발견)", () => {
    const seeded = new Map<string, ApiEndpoint>([
      [
        "getUsers",
        endpoint({
          headers: [
            { key: "X-API-Key", value: "sk-REAL-1", enabled: true },
            { key: "Cookie", value: "session=ck-REAL-2", enabled: true },
          ],
          queryParams: [
            {
              key: "api_key",
              value: "qk-REAL-3",
              type: "string",
              required: true,
            },
          ],
        }),
      ],
    ]);
    const out = reduceDataOps(
      new Map(),
      [
        {
          op: "define_endpoint",
          endpoint: {
            id: "ep_users",
            name: "getUsers",
            method: "GET",
            baseUrl: "https://api.example.com",
            path: "/users",
            headers: [
              {
                key: "X-API-Key",
                value: "{{secret.X_API_KEY}}",
                enabled: true,
              },
              { key: "Cookie", value: "{{secret.COOKIE}}", enabled: false },
              {
                key: "Authorization",
                value: "Bearer {{secret.TOKEN}}",
                enabled: true,
              },
            ],
            queryParams: [
              {
                key: "api_key",
                value: "{{secret.API_KEY}}",
                type: "string",
                required: true,
              },
            ],
          },
        },
      ],
      { projectId: "p", apiEndpoints: seeded },
    );
    const next = out.apiEndpoints.get("getUsers")!;
    expect(next.headers).toEqual([
      { key: "X-API-Key", value: "sk-REAL-1", enabled: true },
      { key: "Cookie", value: "session=ck-REAL-2", enabled: false }, // 값 보존 · enabled 는 patch
      { key: "Authorization", value: "Bearer {{secret.TOKEN}}", enabled: true }, // 새 키는 그대로 (vault 참조)
    ]);
    expect(next.queryParams[0].value).toBe("qk-REAL-3");
    // inverse 는 원문 그대로 (되돌리면 원상)
    const inverse = out.inverse[0] as Extract<
      DataOp,
      { op: "define_endpoint" }
    >;
    expect(inverse.op).toBe("define_endpoint");
    expect(inverse.endpoint.headers?.map((h) => h.value)).toEqual([
      "sk-REAL-1",
      "session=ck-REAL-2",
    ]);
  });

  it("delete: Map 에서 빠지고 inverse 는 같은 id 로 재정의 (참조 보존) · 왕복", () => {
    const out = reduceDataOps(
      new Map(),
      [{ op: "delete_endpoint", endpointId: "ep_users" }],
      ctx(),
    );
    expect(out.apiEndpoints.size).toBe(0);
    expect(out.endpointsDeleted).toEqual(new Set(["ep_users"]));
    expect(out.inverse[0]).toMatchObject({
      op: "define_endpoint",
      endpoint: { id: "ep_users", name: "getUsers" },
    });
    const back = reduceDataOps(new Map(), out.inverse, {
      projectId: "p",
      apiEndpoints: out.apiEndpoints,
    });
    expect(back.apiEndpoints.get("getUsers")?.id).toBe("ep_users");
    expect(back.endpointsUpserted).toEqual(new Set(["ep_users"]));
  });

  it("없는 id 삭제 · 다른 endpoint 와 이름 충돌 · 빈 이름은 throw (무변경)", () => {
    expect(() =>
      reduceDataOps(
        new Map(),
        [{ op: "delete_endpoint", endpointId: "nope" }],
        ctx(),
      ),
    ).toThrow(DataChangeError);
    expect(() =>
      reduceDataOps(
        new Map(),
        [
          {
            op: "define_endpoint",
            endpoint: {
              name: "getUsers",
              method: "POST",
              baseUrl: "https://x",
              path: "/y",
            },
          },
        ],
        ctx(),
      ),
    ).toThrow(/이름/);
    expect(() =>
      reduceDataOps(
        new Map(),
        [
          {
            op: "define_endpoint",
            endpoint: {
              name: "  ",
              method: "GET",
              baseUrl: "https://x",
              path: "/",
            },
          },
        ],
        ctx(),
      ),
    ).toThrow(DataChangeError);
  });
});

describe("applyDataChange — define_endpoint (cross-store)", () => {
  function makeStore() {
    const state: Record<string, unknown> = {
      collections: new Map<string, DataTable>([
        [
          "users",
          {
            id: "users",
            name: "Users",
            project_id: "p",
            schema: [{ id: "f1", key: "name", type: "string" }],
            mockData: [],
            useMockData: true,
          },
        ],
      ]),
      variables: new Map(),
      apiEndpoints: seedEndpoints(),
      errors: new Map(),
    };
    const set = (patch: unknown) =>
      Object.assign(state, typeof patch === "function" ? patch(state) : patch);
    const get = () => state;
    return {
      state,
      apply: createApplyDataChangeAction(set as never, get as never),
      endpoints: () => state.apiEndpoints as Map<string, ApiEndpoint>,
    };
  }
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("update → api_endpoints.update 1 · 메모리 Map · History 1 (elementId = endpoint id) · collections DB 0", async () => {
    const { apply, endpoints } = makeStore();
    const result = await apply(
      {
        ops: [
          {
            op: "define_endpoint",
            endpoint: {
              id: "ep_users",
              name: "getUsers",
              method: "GET",
              baseUrl: "https://api.example.com",
              path: "/users",
              headers: [
                {
                  key: "Authorization",
                  value: "Bearer {{secret.TOKEN}}",
                  enabled: true,
                },
              ],
            },
          },
        ],
        origin: "ai",
      },
      { projectId: "p" },
    );
    expect(result.endpointIds).toEqual(["ep_users"]);
    expect(endpoints().get("getUsers")?.headers[0].key).toBe("Authorization");
    expect(dbMock.api_endpoints.update).toHaveBeenCalledTimes(1);
    expect(dbMock.api_endpoints.insert).not.toHaveBeenCalled();
    expect(dbMock.collections.update).not.toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry.mock.calls[0][0]).toMatchObject({
      type: "data",
      elementId: "ep_users",
    });
  });

  it("create → insert 1 · undo (inverse delete_endpoint, record:false) → delete 1 · Map 원상 · History 0", async () => {
    const { apply, endpoints } = makeStore();
    const result = await apply(
      {
        ops: [
          {
            op: "define_endpoint",
            endpoint: {
              name: "bearerCheck",
              method: "GET",
              baseUrl: "https://httpbin.org",
              path: "/bearer",
            },
          },
        ],
        origin: "ai",
      },
      { projectId: "p" },
    );
    expect(dbMock.api_endpoints.insert).toHaveBeenCalledTimes(1);
    expect(endpoints().size).toBe(2);
    await apply({ ops: result.inverse, origin: "user" }, { record: false });
    expect(dbMock.api_endpoints.delete).toHaveBeenCalledTimes(1);
    expect(endpoints().size).toBe(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
  });

  it("endpoint 생성 + bind_element 한 묶음에서 바인딩이 실패하면 endpoint 도 rollback (Map · DB delete)", async () => {
    // preflight 는 통과 (요소 있음) 하고 commit 에서 실패하는 경우
    registerDataBindingConsumer({
      has: () => true,
      apply: () => null,
    });
    const { apply, endpoints } = makeStore();
    await expect(
      apply(
        {
          ops: [
            {
              op: "define_endpoint",
              endpoint: {
                name: "bearerCheck",
                method: "GET",
                baseUrl: "https://httpbin.org",
                path: "/bearer",
              },
            },
            { op: "bind_element", elementId: "ghost", collectionId: "users" },
          ],
          origin: "ai",
        },
        { projectId: "p" },
      ),
    ).rejects.toThrow();
    expect(endpoints().size).toBe(1);
    expect(dbMock.api_endpoints.insert).toHaveBeenCalledTimes(1);
    expect(dbMock.api_endpoints.delete).toHaveBeenCalledTimes(1);
    expect(addEntry).not.toHaveBeenCalled();
  });
});
