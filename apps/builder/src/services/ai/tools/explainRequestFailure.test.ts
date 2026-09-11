/**
 * ADR-213 Phase 3 — `explain_request_failure` (AI-3, G3 정적 부분).
 *
 * - 컨텍스트 = 요청 정의 · 보낸 요청 · 응답 status/headers · 본문 앞 2KB · 대상 테이블 스키마
 * - **전부 공유 redactor 를 지난다**: 요청 헤더 · query · 본문 · 응답 헤더 (Set-Cookie) ·
 *   응답 본문 · endpoint 정의의 canary 원문 0 (R8)
 * - 참조 없음 → 가장 최근 실패 실행 · 실행 기록 없음 → 안내 오류 · 성공 실행도 설명 가능
 * - 쓰기 0
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDataStore } from "../../../builder/stores/data";
import type {
  ApiEndpoint,
  ApiRunRecord,
  DataTable,
} from "../../../types/builder/data.types";
import type { ToolTranslate } from "../../../types/integrations/ai.types";
import {
  REQUEST_FAILURE_BODY_MAX_BYTES,
  buildRequestFailureContext,
  explainRequestFailureTool,
} from "./explainRequestFailure";

vi.mock("./canonicalToolReadModel", () => ({
  getAiToolReadModel: () => ({
    elements: [],
    elementsById: new Map(),
    childrenByParent: new Map(),
    state: {},
  }),
}));

const t: ToolTranslate = (key, params) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

const HDR_CANARY = "sk-CANARY-hdr-4b1e";
const QRY_CANARY = "qk-CANARY-qry-9d2c";
const BODY_CANARY = "bk-CANARY-body-77aa";
const COOKIE_CANARY = "ck-CANARY-cookie-0f5d";
const RESP_CANARY = "rk-CANARY-resp-c3e1";

function users(): DataTable {
  return {
    id: "users",
    name: "Users",
    project_id: "p1",
    schema: [
      { id: "f_name", key: "name", type: "string", required: true },
      { id: "f_age", key: "age", type: "number" },
    ],
    mockData: [],
    useMockData: true,
  };
}

function endpoint(overrides: Partial<ApiEndpoint> = {}): ApiEndpoint {
  return {
    id: "ep1",
    name: "getUsers",
    project_id: "p1",
    method: "POST",
    baseUrl: "https://api.example.com",
    path: "/users",
    headers: [{ key: "X-API-Key", value: HDR_CANARY, enabled: true }],
    queryParams: [
      { key: "api_key", value: QRY_CANARY, type: "string", required: true },
    ],
    bodyType: "json",
    bodyTemplate: `{"apiKey":"${BODY_CANARY}","q":"x"}`,
    responseMapping: { dataPath: "data" },
    executionMode: "client",
    targetCollectionId: "users",
    ...overrides,
  };
}

function failedRun(overrides: Partial<ApiRunRecord> = {}): ApiRunRecord {
  return {
    runId: "run_1",
    endpointId: "ep1",
    startedAt: "2026-09-11T12:00:00.000Z",
    durationMs: 120,
    ok: false,
    error: "HTTP 401: Unauthorized",
    request: {
      method: "POST",
      url: `https://api.example.com/users?api_key=${QRY_CANARY}`,
      headers: {
        "X-API-Key": HDR_CANARY,
        Cookie: `session=${COOKIE_CANARY}`,
        "Content-Type": "application/json",
      },
      bodyType: "json",
      body: `{"apiKey":"${BODY_CANARY}","q":"x"}`,
    },
    response: {
      status: 401,
      statusText: "Unauthorized",
      headers: {
        "www-authenticate": "Bearer",
        "set-cookie": `session=${COOKIE_CANARY}; Path=/`,
      },
      bodyPreview: `{"error":"missing bearer","token":"${RESP_CANARY}"}`,
      bodyTruncated: false,
      bodyBytes: 60,
    },
    ...overrides,
  };
}

beforeEach(() => {
  useDataStore.setState({
    collections: new Map([["users", users()]]),
    apiEndpoints: new Map([["ep1", endpoint()]]),
    apiRuns: new Map([["ep1", failedRun()]]),
    errors: new Map(),
  });
});

describe("buildRequestFailureContext — 순수 · redactor 경계", () => {
  it("canary 원문 0 (요청 헤더 · Cookie · query · 본문 · 응답 Set-Cookie · 응답 본문 · 정의) · placeholder 로 대체", () => {
    const ctx = buildRequestFailureContext(endpoint(), failedRun(), [users()]);
    const serialized = JSON.stringify(ctx);
    for (const canary of [
      HDR_CANARY,
      QRY_CANARY,
      BODY_CANARY,
      COOKIE_CANARY,
      RESP_CANARY,
    ]) {
      expect(serialized).not.toContain(canary);
    }
    expect(ctx.request.headers["X-API-Key"]).toBe("{{secret.X_API_KEY}}");
    expect(ctx.request.headers.Cookie).toBe("{{secret.COOKIE}}");
    expect(ctx.request.headers["Content-Type"]).toBe("application/json");
    expect(ctx.request.url).toBe(
      "https://api.example.com/users?api_key={{secret.API_KEY}}",
    );
    expect(ctx.response?.headers["set-cookie"]).toBe("{{secret.SET_COOKIE}}");
    expect(ctx.response?.headers["www-authenticate"]).toBe("Bearer");
    expect(ctx.response?.body).toContain('"error":"missing bearer"');
    expect(ctx.endpoint.headers[0].value).toBe("{{secret.X_API_KEY}}");
  });

  it("상태 · 오류 · 대상 테이블 스키마 (id · key · type · required) 를 싣는다", () => {
    const ctx = buildRequestFailureContext(endpoint(), failedRun(), [users()]);
    expect(ctx).toMatchObject({
      endpoint: { id: "ep1", name: "getUsers", method: "POST" },
      run: { runId: "run_1", ok: false, error: "HTTP 401: Unauthorized" },
      response: { status: 401, statusText: "Unauthorized" },
      targetCollection: {
        id: "users",
        name: "Users",
        fields: [
          { id: "f_name", key: "name", type: "string", required: true },
          { id: "f_age", key: "age", type: "number", required: false },
        ],
      },
    });
    // responseMapping 은 원인 추정 (dataPath 불일치) 에 필요
    expect(ctx.endpoint.responseMapping).toEqual({ dataPath: "data" });
  });

  it("응답 본문은 2KB 안 (스냅샷이 더 길어도) · 잘림 표시", () => {
    const long = "a".repeat(REQUEST_FAILURE_BODY_MAX_BYTES + 500);
    const ctx = buildRequestFailureContext(
      endpoint(),
      failedRun({
        response: {
          status: 500,
          statusText: "Internal Server Error",
          headers: {},
          bodyPreview: long,
          bodyTruncated: false,
          bodyBytes: long.length,
        },
      }),
      [users()],
    );
    expect(ctx.response?.body.length).toBe(REQUEST_FAILURE_BODY_MAX_BYTES);
    expect(ctx.response?.bodyTruncated).toBe(true);
  });

  it("네트워크 오류 (response null) · 대상 테이블 없음도 조립된다", () => {
    const ctx = buildRequestFailureContext(
      endpoint({ targetCollectionId: undefined, targetCollection: undefined }),
      failedRun({ response: null, error: "Failed to fetch" }),
      [users()],
    );
    expect(ctx.response).toBeNull();
    expect(ctx.targetCollection).toBeNull();
    expect(ctx.run.error).toBe("Failed to fetch");
  });
});

describe("explain_request_failure tool", () => {
  it("endpointId 로 찾고, 안내 문구 (원인 + define_endpoint 제안 형식) 를 붙인다 · 쓰기 0", async () => {
    const before = useDataStore.getState();
    const result = await explainRequestFailureTool.execute(
      { endpointId: "ep1" },
      t,
    );
    expect(result.success).toBe(true);
    const data = result.data as { guidance: string; run: { runId: string } };
    expect(data.run.runId).toBe("run_1");
    expect(data.guidance).toBe("aiPrompt.explainFailureGuidance");
    expect(JSON.stringify(result)).not.toContain(HDR_CANARY);
    const after = useDataStore.getState();
    expect(after.apiEndpoints).toBe(before.apiEndpoints);
    expect(after.apiRuns).toBe(before.apiRuns);
    expect(after.collections).toBe(before.collections);
  });

  it("참조가 없으면 가장 최근 실패 실행을 고른다 (성공만 있으면 최근 성공)", async () => {
    useDataStore.setState({
      apiEndpoints: new Map([
        ["ep1", endpoint()],
        ["ep2", endpoint({ id: "ep2", name: "other", path: "/other" })],
      ]),
      apiRuns: new Map([
        [
          "ep1",
          failedRun({
            ok: true,
            error: undefined,
            startedAt: "2026-09-11T12:05:00.000Z",
          }),
        ],
        [
          "ep2",
          failedRun({
            runId: "run_2",
            endpointId: "ep2",
            startedAt: "2026-09-11T12:01:00.000Z",
          }),
        ],
      ]),
    });
    const picked = await explainRequestFailureTool.execute({}, t);
    expect((picked.data as { run: { runId: string } }).run.runId).toBe("run_2");
  });

  it("실행 기록이 없으면 안내 오류 · runId 불일치도 오류 · 없는 endpoint 는 복구 안내", async () => {
    useDataStore.setState({ apiRuns: new Map() });
    expect(
      await explainRequestFailureTool.execute({ endpointId: "ep1" }, t),
    ).toEqual({
      success: false,
      error: 'aiToolError.noRunRecorded:{"name":"getUsers"}',
    });
    expect(await explainRequestFailureTool.execute({}, t)).toEqual({
      success: false,
      error: "aiToolError.noRunAtAll",
    });
    useDataStore.setState({ apiRuns: new Map([["ep1", failedRun()]]) });
    const mismatch = await explainRequestFailureTool.execute(
      { endpointId: "ep1", runId: "run_zzz" },
      t,
    );
    expect(mismatch.success).toBe(false);
    expect(mismatch.error).toContain("aiToolError.runNotFound");
    const missing = await explainRequestFailureTool.execute(
      { endpointId: "nope" },
      t,
    );
    expect(missing.error).toContain("aiToolError.endpointNotFound");
  });

  it("성공한 실행도 설명 대상 (ok:true · status 200)", async () => {
    useDataStore.setState({
      apiRuns: new Map([
        [
          "ep1",
          failedRun({
            ok: true,
            error: undefined,
            response: {
              status: 200,
              statusText: "OK",
              headers: {},
              bodyPreview: '{"data":[]}',
              bodyTruncated: false,
              bodyBytes: 11,
            },
          }),
        ],
      ]),
    });
    const result = await explainRequestFailureTool.execute(
      { name: "getUsers" },
      t,
    );
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      run: { ok: true },
      response: { status: 200 },
    });
  });
});
