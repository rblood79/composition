/**
 * ADR-213 Phase 1 — 읽기 tool 4 (G1 정적 부분).
 *
 * - `list_collections` / `get_collection`: id · name 참조, sampleRows ≤ 5, format concise/detailed
 * - `list_api_endpoints` / `get_api_endpoint`: 공유 redactor 를 지나 canary 원문 0
 * - 쓰기 0 — 호출 전후 store 가 같은 참조다
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDataStore } from "../../../builder/stores/data";
import type { ApiEndpoint, DataTable } from "../../../types/builder/data.types";
import type { ToolTranslate } from "../../../types/integrations/ai.types";
import { getApiEndpointTool } from "./getApiEndpoint";
import { getCollectionTool } from "./getCollection";
import { listApiEndpointsTool } from "./listApiEndpoints";
import { listCollectionsTool } from "./listCollections";

vi.mock("./canonicalToolReadModel", () => ({
  getAiToolReadModel: () => ({
    elements: [
      {
        id: "e1",
        props: { dataBinding: { source: "dataTable", collectionId: "users" } },
      },
    ],
    elementsById: new Map(),
    childrenByParent: new Map(),
    state: {},
  }),
}));

const t: ToolTranslate = (key, params) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

const CANARY = "sk-CANARY-31c0";

function users(): DataTable {
  return {
    id: "users",
    name: "Users",
    project_id: "p1",
    schema: [
      {
        id: "f_name",
        key: "name",
        type: "string",
        label: "이름",
        required: true,
      },
      { id: "f_age", key: "age", type: "number" },
    ],
    mockData: Array.from({ length: 8 }, (_, i) => ({ name: `U${i}`, age: i })),
    useMockData: true,
  };
}

function endpoint(): ApiEndpoint {
  return {
    id: "ep1",
    name: "getUsers",
    project_id: "p1",
    method: "GET",
    baseUrl: "https://api.example.com",
    path: "/users",
    headers: [
      { key: "Authorization", value: `Bearer ${CANARY}`, enabled: true },
    ],
    queryParams: [
      { key: "api_key", value: CANARY, type: "string", required: true },
    ],
    bodyType: "none",
    responseMapping: { dataPath: "data" },
    executionMode: "client",
    targetCollectionId: "users",
  };
}

beforeEach(() => {
  useDataStore.setState({
    collections: new Map([["users", users()]]),
    apiEndpoints: new Map([["ep1", endpoint()]]),
    apiRuns: new Map(),
    errors: new Map([["executeApi_ep1", new Error("HTTP 401: Unauthorized")]]),
  });
});

describe("list_collections", () => {
  it("concise 는 요약 + usedBy, detailed 는 fields 까지", async () => {
    const concise = await listCollectionsTool.execute({}, t);
    expect(concise.success).toBe(true);
    expect(concise.data).toEqual([
      {
        id: "users",
        name: "Users",
        fieldCount: 2,
        rowCount: 8,
        source: "manual",
        usedBy: 1,
      },
    ]);
    const detailed = await listCollectionsTool.execute(
      { format: "detailed" },
      t,
    );
    expect((detailed.data as Array<{ fields: unknown }>)[0].fields).toEqual([
      { id: "f_name", key: "name", type: "string" },
      { id: "f_age", key: "age", type: "number" },
    ]);
  });
});

describe("get_collection", () => {
  it("name 으로도 찾고, sampleRows 는 5 로 잘린다", async () => {
    const result = await getCollectionTool.execute(
      { name: "Users", sampleRows: 50 },
      t,
    );
    expect(result.success).toBe(true);
    const data = result.data as {
      sample: unknown[];
      rowCount: number;
      schema: unknown[];
    };
    expect(data.sample).toHaveLength(5);
    expect(data.rowCount).toBe(8);
    expect(data.schema).toEqual([
      {
        id: "f_name",
        key: "name",
        type: "string",
        label: "이름",
        required: true,
      },
      { id: "f_age", key: "age", type: "number" },
    ]);
  });

  it("참조가 없거나 못 찾으면 복구 안내를 담은 오류", async () => {
    expect((await getCollectionTool.execute({}, t)).error).toBe(
      "aiToolError.collectionRefRequired",
    );
    expect(
      (await getCollectionTool.execute({ collectionId: "nope" }, t)).error,
    ).toContain("aiToolError.collectionNotFound");
  });
});

describe("list_api_endpoints / get_api_endpoint — redactor 경계", () => {
  it("목록은 url 을 합쳐 주고 마지막 실행 오류를 싣는다", async () => {
    const result = await listApiEndpointsTool.execute({}, t);
    expect(result.data).toEqual([
      {
        id: "ep1",
        name: "getUsers",
        method: "GET",
        url: "https://api.example.com/users",
        targetCollectionId: "users",
        lastRun: { ok: false, error: "HTTP 401: Unauthorized" },
      },
    ]);
  });

  it("정의는 canary 원문 0 (header · query)", async () => {
    const result = await getApiEndpointTool.execute({ endpointId: "ep1" }, t);
    expect(result.success).toBe(true);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(CANARY);
    expect(serialized).toContain("{{secret.AUTHORIZATION}}");
    expect(serialized).toContain("{{secret.API_KEY}}");
  });

  it("읽기 tool 은 store 를 바꾸지 않는다", async () => {
    const before = useDataStore.getState();
    await listCollectionsTool.execute({ format: "detailed" }, t);
    await getCollectionTool.execute({ collectionId: "users" }, t);
    await listApiEndpointsTool.execute({}, t);
    await getApiEndpointTool.execute({ name: "getUsers" }, t);
    const after = useDataStore.getState();
    expect(after.collections).toBe(before.collections);
    expect(after.apiEndpoints).toBe(before.apiEndpoints);
  });
});
