/**
 * ADR-152 Phase 1c — `DataChange` 스키마 (zod + JSON Schema 동일 소스).
 *
 * ADR-213 이 tool `input_schema` 로 재사용하므로 (1) 모든 op 가 discriminated
 * union 으로 파싱되고 (2) JSON Schema 가 같은 소스에서 생성되며 (3) 사람 UI 전용
 * op 를 뺀 변형이 나온다.
 */
import { describe, expect, it } from "vitest";
import {
  DATA_OP_KINDS,
  DataChangeSchema,
  DataOpSchema,
  HUMAN_ONLY_DATA_OPS,
  dataChangeJsonSchema,
  parseDataChange,
} from "../dataChange";

const field = { id: "f1", key: "name", type: "string" as const };

describe("DataOpSchema", () => {
  it("14 op 전부 파싱된다", () => {
    const ops = [
      { op: "create_collection", name: "Users", schema: [field] },
      { op: "delete_collection", collectionId: "c1" },
      {
        op: "update_collection",
        collectionId: "c1",
        patch: { name: "People" },
      },
      { op: "add_field", collectionId: "c1", field, index: 0 },
      {
        op: "update_field",
        collectionId: "c1",
        fieldId: "f1",
        patch: { key: "fullName", label: null },
      },
      { op: "remove_field", collectionId: "c1", fieldId: "f1" },
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 0,
        fieldId: "f1",
        value: "x",
      },
      { op: "insert_rows", collectionId: "c1", rows: [{ name: "a" }], at: 0 },
      { op: "remove_rows", collectionId: "c1", rowIndexes: [0, 2] },
      { op: "replace_rows", collectionId: "c1", rows: [] },
      { op: "set_source", collectionId: "c1", source: "manual" },
      {
        op: "define_endpoint",
        endpoint: {
          name: "users",
          method: "GET",
          baseUrl: "https://x",
          path: "/u",
        },
      },
      {
        op: "bind_element",
        elementId: "e1",
        collectionId: "c1",
        fieldMap: { value: "f1" },
      },
      // ADR-214 Phase 1 — 프로젝트 변수 정의 (null = 제거)
      {
        op: "define_variable",
        definition: { name: "userName", type: "string", defaultValue: "guest" },
      },
      { op: "define_variable", variableId: "v1", definition: null },
    ];
    for (const op of ops)
      expect(DataOpSchema.safeParse(op).success, op.op).toBe(true);
    expect(new Set(ops.map((o) => o.op))).toEqual(new Set(DATA_OP_KINDS));
  });

  it("알 수 없는 op · 필수 누락 · 중첩 children 검증", () => {
    expect(DataOpSchema.safeParse({ op: "nuke" }).success).toBe(false);
    expect(
      DataOpSchema.safeParse({ op: "set_cell", collectionId: "c1" }).success,
    ).toBe(false);
    const nested = {
      op: "add_field",
      collectionId: "c1",
      field: {
        key: "addr",
        type: "object",
        children: [{ key: "zip", type: "bogus" }],
      },
    };
    expect(DataOpSchema.safeParse(nested).success).toBe(false);
  });
});

describe("DataChangeSchema", () => {
  it("origin 4종 · ops 1개 이상 · label 선택", () => {
    const ok = parseDataChange({
      ops: [{ op: "delete_collection", collectionId: "c1" }],
      origin: "user",
    });
    expect(ok.ops).toHaveLength(1);
    expect(() => parseDataChange({ ops: [], origin: "user" })).toThrow();
    expect(() =>
      parseDataChange({
        ops: [{ op: "delete_collection", collectionId: "c1" }],
        origin: "bot",
      }),
    ).toThrow();
    expect(
      DataChangeSchema.safeParse({
        ops: [{ op: "delete_collection", collectionId: "c1" }],
        origin: "ai",
        label: "x",
      }).success,
    ).toBe(true);
  });
});

describe("dataChangeJsonSchema — 같은 소스에서 생성", () => {
  it("전체 op 를 담고 $defs 로 재귀 필드를 표현한다", () => {
    const json = dataChangeJsonSchema() as {
      properties: {
        ops: { items: { oneOf: { properties: { op: { const: string } } }[] } };
      };
      $defs?: Record<string, unknown>;
    };
    const kinds = json.properties.ops.items.oneOf.map(
      (o) => o.properties.op.const,
    );
    expect(new Set(kinds)).toEqual(new Set(DATA_OP_KINDS));
    expect(JSON.stringify(json)).toContain("$ref");
  });

  it("excludeOps 로 사람 UI 전용 op 를 뺀 변형 (ADR-213 tool 용)", () => {
    const json = dataChangeJsonSchema({ excludeOps: HUMAN_ONLY_DATA_OPS }) as {
      properties: {
        ops: { items: { oneOf: { properties: { op: { const: string } } }[] } };
      };
    };
    const kinds = json.properties.ops.items.oneOf.map(
      (o) => o.properties.op.const,
    );
    expect(kinds).not.toContain("remove_field");
    expect(kinds).not.toContain("remove_rows");
    expect(kinds).not.toContain("define_variable"); // ADR-214 — 변수 AI 쓰기는 범위 밖
    expect(kinds).toContain("set_cell");
  });
});
