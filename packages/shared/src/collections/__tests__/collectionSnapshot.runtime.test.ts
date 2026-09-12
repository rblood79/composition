/**
 * ADR-152 Phase 6 — publish/export data snapshot: `toRuntimeCollection` 은 정의 (schema + id) 와
 * mockData · useMockData 만 싣고 runtimeData (빌더 세션의 API 응답, 메모리 전용) · 저장소 메타를 뺀다.
 * export 검증 스키마는 `schema[].id` 를 통과시켜야 import 뒤에도 `{#id}` · fieldMap 참조가 산다.
 */
import { describe, expect, it } from "vitest";
import {
  toRuntimeCollection,
  toExportCollection,
  resolveCollectionSnapshot,
} from "../collectionSnapshot";
import { ExportedProjectSchema } from "../../schemas/project.schema";

const table = {
  id: "c1",
  name: "Users",
  project_id: "p",
  schema: [
    {
      id: "f-name",
      key: "name",
      type: "string",
      label: "Name",
      required: true,
    },
  ],
  mockData: [{ name: "a" }],
  runtimeData: [{ name: "rt" }],
  useMockData: false,
  created_at: "2026-01-01",
  updated_at: "2026-01-02",
  status: "success",
} as const;

describe("toRuntimeCollection", () => {
  it("schema(id 포함) · mockData · useMockData 만 — runtimeData · 메타 제외", () => {
    const out = toRuntimeCollection(table as never);
    expect(out).toEqual({
      id: "c1",
      name: "Users",
      schema: [
        {
          id: "f-name",
          key: "name",
          type: "string",
          label: "Name",
          required: true,
        },
      ],
      mockData: [{ name: "a" }],
      useMockData: false,
    });
    expect("runtimeData" in out).toBe(false);
    // snapshot 은 runtimeData 없이 mockData 로 폴백 (publish 에서 API 실행 전 표시)
    expect(resolveCollectionSnapshot(out).data).toEqual([{ name: "a" }]);
  });
});

describe("toExportCollection (ADR-218 — export 채널)", () => {
  it("executionPolicy 포함 · runtimeData 제외", () => {
    const withPolicy = {
      ...table,
      executionPolicy: { mode: "interval", intervalSec: 30 },
    };
    const out = toExportCollection(withPolicy as never);
    expect(out.executionPolicy).toEqual({ mode: "interval", intervalSec: 30 });
    expect("runtimeData" in out).toBe(false);
  });

  it("executionPolicy 없으면 필드 생략 (BC)", () => {
    const out = toExportCollection(table as never);
    expect("executionPolicy" in out).toBe(false);
  });
  // ExportedProjectSchema 의 executionPolicy 통과(import 보존)는 G3 live(export→import)로 검증.
});

describe("ExportedProjectSchema — schema[].id 통과", () => {
  it("검증 결과 (strip) 에 필드 id 가 남는다", () => {
    const result = ExportedProjectSchema.safeParse({
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      project: { id: "0f494e47-da0a-41da-8b6f-f680386badcf", name: "P" },
      document: { version: "composition-1.0", children: [] },
      collections: [toRuntimeCollection(table as never)],
      metadata: { builderVersion: "1.0.0" },
    });
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    expect(result.data?.collections?.[0].schema?.[0]).toMatchObject({
      id: "f-name",
      key: "name",
    });
  });
});
