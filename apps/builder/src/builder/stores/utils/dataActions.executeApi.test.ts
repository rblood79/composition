/**
 * 리서치 D1 회귀 — 실행기가 최상위 배열 응답을 그대로 행으로 돌려주는지.
 * 종전: 기본 dataPath "data" 를 축소해 undefined 를 반환 → "Success" + 빈 본문.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_RUN_BODY_PREVIEW_MAX_BYTES,
  createExecuteApiEndpointAction,
} from "./dataActions";
import type {
  ApiEndpoint,
  ApiRunRecord,
} from "../../../types/builder/data.types";

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
    apiRuns: new Map<string, ApiRunRecord>(),
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

/** fetch `Response` 흉내 — text() 가 정본, headers 는 entries 로 편다 */
function fakeResponse(
  body: unknown,
  init: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
  } = {},
) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: init.statusText ?? (status === 200 ? "OK" : ""),
    headers: new Headers(init.headers ?? {}),
    text: async () => text,
    json: async () => JSON.parse(text),
  };
}

describe("executeApiEndpoint — 응답 행 추출 (D1)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => fakeResponse(users)),
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
      vi.fn(async () => fakeResponse({ count: 2, results: users })),
    );
    const { set, get } = makeStore(endpoint({}));
    const run = createExecuteApiEndpointAction(set, get);
    await expect(run("api_1")).resolves.toEqual(users);
  });
});

describe("executeApiEndpoint — 실행 스냅샷 (ADR-213 Phase 3)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("성공: endpoint 당 마지막 1건 — 최종 URL(query 포함) · 보낸 헤더 · 상태 · 응답 헤더 · 본문 앞부분 (원문 그대로)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fakeResponse(users, {
          headers: { "content-type": "application/json", "x-request-id": "r1" },
        }),
      ),
    );
    const { state, set, get } = makeStore(
      endpoint({
        headers: [
          { key: "X-API-Key", value: "sk-CANARY-7f3a9c", enabled: true },
          { key: "X-Off", value: "no", enabled: false },
        ],
        queryParams: [
          {
            key: "api_key",
            value: "qk-CANARY",
            type: "string",
            required: true,
          },
        ],
      }),
    );
    await createExecuteApiEndpointAction(set, get)("api_1");
    const run = state.apiRuns.get("api_1")!;
    expect(run).toMatchObject({
      endpointId: "api_1",
      ok: true,
      request: {
        method: "GET",
        url: "https://jsonplaceholder.typicode.com/users?api_key=qk-CANARY",
        headers: { "X-API-Key": "sk-CANARY-7f3a9c" },
        bodyType: "none",
      },
      response: {
        status: 200,
        headers: { "content-type": "application/json", "x-request-id": "r1" },
        bodyPreview: JSON.stringify(users),
        bodyTruncated: false,
      },
    });
    expect(run.request.headers).not.toHaveProperty("X-Off");
    expect(run.runId).toMatch(/\S/);
    expect(run.error).toBeUndefined();
  });

  it("HTTP 401: throw 하되 스냅샷에 상태 · 응답 본문 · error 를 남긴다 (errors Map 도 종전대로)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fakeResponse(
          { error: "missing bearer", apiKey: "leak-CANARY" },
          {
            status: 401,
            statusText: "Unauthorized",
            headers: { "www-authenticate": "Bearer" },
          },
        ),
      ),
    );
    const { state, set, get } = makeStore(endpoint({}));
    await expect(
      createExecuteApiEndpointAction(set, get)("api_1"),
    ).rejects.toThrow("HTTP 401");
    const run = state.apiRuns.get("api_1")!;
    expect(run.ok).toBe(false);
    expect(run.error).toBe("HTTP 401: Unauthorized");
    expect(run.response).toMatchObject({
      status: 401,
      statusText: "Unauthorized",
      headers: { "www-authenticate": "Bearer" },
    });
    expect(run.response?.bodyPreview).toContain("missing bearer");
    expect(state.errors.get("executeApi_api_1")?.message).toBe(
      "HTTP 401: Unauthorized",
    );
  });

  it("네트워크 오류: response null · error 메시지, 스냅샷은 남는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const { state, set, get } = makeStore(endpoint({}));
    await expect(
      createExecuteApiEndpointAction(set, get)("api_1"),
    ).rejects.toThrow("Failed to fetch");
    const run = state.apiRuns.get("api_1")!;
    expect(run).toMatchObject({
      ok: false,
      response: null,
      error: "Failed to fetch",
    });
  });

  it("본문 미리보기는 바이트 상한에서 자른다 (멀티바이트 경계 안전) · JSON 아님은 실패로 기록", async () => {
    const big = "가".repeat(API_RUN_BODY_PREVIEW_MAX_BYTES); // 3 bytes each
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => fakeResponse(big)),
    );
    const { state, set, get } = makeStore(endpoint({}));
    await expect(
      createExecuteApiEndpointAction(set, get)("api_1"),
    ).rejects.toThrow();
    const run = state.apiRuns.get("api_1")!;
    expect(run.ok).toBe(false);
    expect(run.response?.bodyTruncated).toBe(true);
    expect(
      new TextEncoder().encode(run.response!.bodyPreview).length,
    ).toBeLessThanOrEqual(API_RUN_BODY_PREVIEW_MAX_BYTES);
    expect(run.response?.bodyPreview.endsWith("가")).toBe(true);
    expect(run.response?.bodyBytes).toBe(API_RUN_BODY_PREVIEW_MAX_BYTES * 3);
  });
});
