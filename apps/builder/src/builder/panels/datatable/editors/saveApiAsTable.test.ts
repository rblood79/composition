/**
 * ADR-212 Phase 4 UX-2 — "테이블로 저장" DataChange 빌더. API 응답 → collection 생성 +
 * source=api + endpoint 정의 (targetCollectionId 연결) 를 한 DataChange (ops) 로. 적용은
 * applyDataChange 가 preflight+commit+inverse+rollback (ADR-213 coordinator).
 */
import { describe, expect, it } from "vitest";
import { buildSaveApiAsTableOps } from "./saveApiAsTable";
import type { ApiEndpoint } from "../../../../types/builder/data.types";

const endpoint = {
  id: "ep1",
  name: "orders-api",
  project_id: "p",
  method: "GET",
  baseUrl: "https://x.test",
  path: "/orders",
  headers: [{ key: "Accept", value: "application/json", enabled: true }],
  queryParams: [],
  bodyType: "none",
  responseMapping: { dataPath: "data" },
} as unknown as ApiEndpoint;

describe("buildSaveApiAsTableOps", () => {
  it("신규 테이블: create_collection(source api) + set_source + define_endpoint(target)", () => {
    const ops = buildSaveApiAsTableOps({
      projectId: "p",
      collectionId: "c-new",
      tableName: "Orders",
      schema: [
        { key: "id", type: "number" },
        { key: "total", type: "number" },
      ],
      rows: [{ id: 1, total: 10 }],
      endpoint,
      dataPath: "data",
      mode: "create",
    });
    expect(ops[0]).toMatchObject({
      op: "create_collection",
      id: "c-new",
      name: "Orders",
      source: "api",
    });
    expect(ops.find((o) => o.op === "set_source")).toMatchObject({
      op: "set_source",
      collectionId: "c-new",
      source: "api",
      endpointId: "ep1",
    });
    expect(ops.find((o) => o.op === "define_endpoint")).toMatchObject({
      op: "define_endpoint",
      endpoint: { id: "ep1", targetCollectionId: "c-new", dataPath: "data" },
    });
  });
  it("기존 테이블에 잇기: create_collection 없이 set_source + define_endpoint(target)", () => {
    const ops = buildSaveApiAsTableOps({
      projectId: "p",
      collectionId: "c-exist",
      tableName: "Orders",
      schema: [{ key: "id", type: "number" }],
      rows: [],
      endpoint,
      dataPath: "data",
      mode: "attach",
    });
    expect(ops.some((o) => o.op === "create_collection")).toBe(false);
    expect(ops.find((o) => o.op === "set_source")).toMatchObject({
      collectionId: "c-exist",
      endpointId: "ep1",
    });
    expect(ops.find((o) => o.op === "define_endpoint")).toMatchObject({
      endpoint: { targetCollectionId: "c-exist" },
    });
  });
});
