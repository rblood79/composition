/**
 * ADR-152 Phase 1 (R8 / HC7) — store 진입 경계 정규화.
 *
 * id 없는 필드에 `DataField.id` 를 부여하고 (children 재귀 포함), 이미 있는 id 는
 * 그대로 둔다. 부여가 일어났는지를 돌려줘 호출자 (fetch) 가 1회 write-back 을 그
 * collection 에만 하도록 한다.
 */
import { describe, expect, it } from "vitest";
import {
  normalizeCollection,
  normalizeSchema,
  normalizeCollectionMap,
} from "./normalizeCollection";
import type { DataTable } from "../../types/builder/data.types";

const table = (schema: DataTable["schema"]): DataTable => ({
  id: "c1",
  name: "Users",
  project_id: "p",
  schema,
  mockData: [],
  useMockData: true,
});

describe("normalizeSchema", () => {
  it("id 없는 필드에 고유 id 를 부여하고 있는 id 는 보존한다", () => {
    const { schema, assigned } = normalizeSchema([
      { key: "name", type: "string" },
      { id: "keep", key: "email", type: "email" },
    ]);
    expect(assigned).toBe(true);
    expect(schema[0].id).toMatch(/\S+/);
    expect(schema[1].id).toBe("keep");
    expect(schema[0].id).not.toBe(schema[1].id);
  });

  it("전부 id 가 있으면 같은 배열 참조 · assigned=false (재렌더 무효화 0)", () => {
    const input = [
      { id: "a", key: "name", type: "string" as const },
      { id: "b", key: "email", type: "email" as const },
    ];
    const { schema, assigned } = normalizeSchema(input);
    expect(assigned).toBe(false);
    expect(schema).toBe(input);
  });

  it("children (object/array) 도 재귀로 부여한다", () => {
    const { schema, assigned } = normalizeSchema([
      {
        key: "address",
        type: "object",
        children: [{ key: "city", type: "string" }],
      },
    ]);
    expect(assigned).toBe(true);
    expect(schema[0].children?.[0].id).toMatch(/\S+/);
  });

  it("빈 key 필드는 건드리지 않는다 (편집 중 임시 행)", () => {
    const { schema, assigned } = normalizeSchema([{ key: "", type: "string" }]);
    expect(assigned).toBe(false);
    expect(schema[0].id).toBeUndefined();
  });

  it("같은 collection 안에서 중복 id 는 뒤쪽을 새로 부여한다", () => {
    const { schema } = normalizeSchema([
      { id: "dup", key: "a", type: "string" },
      { id: "dup", key: "b", type: "string" },
    ]);
    expect(schema[0].id).toBe("dup");
    expect(schema[1].id).not.toBe("dup");
  });
});

describe("normalizeCollection / normalizeCollectionMap", () => {
  it("collection 단위 — assigned 면 새 객체, 아니면 같은 참조", () => {
    const fresh = normalizeCollection(table([{ key: "name", type: "string" }]));
    expect(fresh.assigned).toBe(true);
    expect(fresh.collection.schema[0].id).toMatch(/\S+/);

    const already = table([{ id: "x", key: "name", type: "string" }]);
    const kept = normalizeCollection(already);
    expect(kept.assigned).toBe(false);
    expect(kept.collection).toBe(already);
  });

  it("배열 → id 키 Map + write-back 대상 목록 (부여된 것만)", () => {
    const a = table([{ key: "name", type: "string" }]);
    const b = { ...table([{ id: "x", key: "n", type: "string" }]), id: "c2" };
    const { collections, assigned } = normalizeCollectionMap([a, b]);
    expect([...collections.keys()]).toEqual(["c1", "c2"]);
    expect(assigned.map((c) => c.id)).toEqual(["c1"]);
    expect(collections.get("c2")).toBe(b);
  });
});
