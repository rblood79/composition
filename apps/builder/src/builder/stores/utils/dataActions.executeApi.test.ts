/**
 * 리서치 D1 회귀 — 실행기가 최상위 배열 응답을 그대로 행으로 돌려주는지.
 * 종전: 기본 dataPath "data" 를 축소해 undefined 를 반환 → "Success" + 빈 본문.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createExecuteApiEndpointAction } from "./dataActions";
import type { ApiEndpoint } from "../../../types/builder/data.types";

const endpoint = (overrides: Partial<ApiEndpoint>): ApiEndpoint => ({
  id: "api_1",
  name: "typicode · users",
  project_id: "p",
  method: "GET",
  baseUrl: "https://jsonplaceholder.typicode.com",
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

function makeStore(ep: ApiEndpoint) {
  const state = {
    apiEndpoints: new Map([[ep.name, ep]]),
    collections: new Map(),
    loadingApis: new Set<string>(),
    errors: new Map(),
  };
  const set = vi.fn((patch: unknown) => {
    Object.assign(state, typeof patch === "function" ? patch(state) : patch);
  });
  const get = () => state;
  return { state, set: set as never, get: get as never };
}

const users = [
  { id: 1, name: "Leanne" },
  { id: 2, name: "Ervin" },
];

describe("executeApiEndpoint — 응답 행 추출 (D1)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => users })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("빈 dataPath + 최상위 배열 → 배열", async () => {
    const { set, get } = makeStore(endpoint({}));
    const run = createExecuteApiEndpointAction(set, get);
    await expect(run("api_1")).resolves.toEqual(users);
  });

  it('종전 기본값 "data" 가 남아 있어도 최상위 배열을 돌려준다 (undefined 금지)', async () => {
    const { set, get } = makeStore(
      endpoint({ responseMapping: { dataPath: "data" } }),
    );
    const run = createExecuteApiEndpointAction(set, get);
    await expect(run("api_1")).resolves.toEqual(users);
  });

  it("객체 응답의 관례 키 (results) 를 찾는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ count: 2, results: users }),
      })),
    );
    const { set, get } = makeStore(endpoint({}));
    const run = createExecuteApiEndpointAction(set, get);
    await expect(run("api_1")).resolves.toEqual(users);
  });
});
