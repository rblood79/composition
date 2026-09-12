import { describe, expect, it } from "vitest";
import type {
  ApiEndpoint,
  ApiRunRecord,
  DataTable,
} from "../../../../types/builder/data.types";
import {
  findLinkedApi,
  resolveCollectionBadgeStatus,
} from "./collectionBadgeStatus";

const table = (over: Partial<DataTable> = {}): DataTable =>
  ({
    id: "c1",
    name: "users",
    project_id: "p",
    schema: [{ id: "f-id", key: "id", type: "number" }],
    mockData: [{ id: 1 }, { id: 2 }],
    useMockData: true,
    ...over,
  }) as DataTable;

const api = (over: Partial<ApiEndpoint> = {}): ApiEndpoint =>
  ({
    id: "ep1",
    name: "GET users",
    method: "GET",
    url: "https://x",
    targetCollectionId: "c1",
    ...over,
  }) as ApiEndpoint;

const run = (ok: boolean, status?: number): ApiRunRecord =>
  ({
    runId: "r1",
    endpointId: "ep1",
    startedAt: "2026-09-12T00:00:00Z",
    durationMs: 10,
    ok,
    request: { method: "GET", url: "https://x", headers: {}, bodyType: "none" },
    response: status ? ({ status } as ApiRunRecord["response"]) : null,
  }) as ApiRunRecord;

describe("findLinkedApi", () => {
  it("targetCollectionId 우선, 없으면 이름 fallback", () => {
    expect(findLinkedApi(table(), [api()])?.id).toBe("ep1");
    expect(
      findLinkedApi(table(), [
        api({ targetCollectionId: undefined, targetCollection: "users" }),
      ])?.id,
    ).toBe("ep1");
    expect(findLinkedApi(table(), [api({ targetCollectionId: "other" })])).toBe(
      undefined,
    );
  });
});

describe("resolveCollectionBadgeStatus", () => {
  it("mock 모드 정상 → normal + mockData 행 수", () => {
    const s = resolveCollectionBadgeStatus(table(), [], new Map());
    expect(s).toMatchObject({ rows: 2, state: "normal" });
    expect(s.errorStatus).toBeUndefined();
  });

  it("행 0 → empty", () => {
    const s = resolveCollectionBadgeStatus(
      table({ mockData: [] }),
      [],
      new Map(),
    );
    expect(s.state).toBe("empty");
    expect(s.rows).toBe(0);
  });

  it("연결 API 마지막 실행 실패 → error (rows 무관하게 우선)", () => {
    const s = resolveCollectionBadgeStatus(
      table({ useMockData: false, runtimeData: [{ id: 1 }] }),
      [api()],
      new Map([["ep1", run(false, 500)]]),
    );
    expect(s.state).toBe("error");
    expect(s.errorStatus).toBe(500);
    expect(s.linkedApiId).toBe("ep1");
  });

  it("실행 성공이면 error 아님", () => {
    const s = resolveCollectionBadgeStatus(
      table({ useMockData: false, runtimeData: [{ id: 1 }] }),
      [api()],
      new Map([["ep1", run(true, 200)]]),
    );
    expect(s.state).toBe("normal");
    expect(s.linkedApiId).toBe("ep1");
  });

  it("api 모드 · runtimeData 없으면 mockData 로 폴백해 행 수", () => {
    const s = resolveCollectionBadgeStatus(
      table({ useMockData: false }),
      [],
      new Map(),
    );
    expect(s.rows).toBe(2);
    expect(s.state).toBe("normal");
  });
});
