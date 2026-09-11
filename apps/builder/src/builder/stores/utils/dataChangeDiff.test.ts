/**
 * ADR-152 Phase 1c — `updateCollection(id, updates)` (partial patch) → `DataOp[]`.
 *
 * 기존 호출부 (DataTableEditor · import envelope) 는 그대로 두고, wrapper 가 patch 를
 * op 로 옮긴다. 편집기 경로 4종 (셀 · 행 삭제 · CSV 교체 · 필드 rename) 이 정확한
 * op 1개로 떨어져야 History 라벨과 역연산이 맞는다.
 */
import { describe, expect, it } from "vitest";
import type { DataTable } from "../../../types/builder/data.types";
import { collectionUpdateToOps } from "./dataChangeDiff";
import { reduceDataOps } from "./dataChange";

const base = (): DataTable => ({
  id: "c1",
  name: "Users",
  project_id: "p",
  schema: [
    { id: "f_name", key: "name", type: "string" },
    { id: "f_email", key: "email", type: "email" },
  ],
  mockData: [
    { name: "a", email: "a@x" },
    { name: "b", email: "b@x" },
    { name: "c", email: "c@x" },
  ],
  useMockData: true,
});

/** wrapper 가 만든 op 를 적용한 결과가 patch 를 직접 덮은 결과와 같은가. */
function expectEquivalent(existing: DataTable, updates: Parameters<typeof collectionUpdateToOps>[1]) {
  const { ops } = collectionUpdateToOps(existing, updates);
  const next = reduceDataOps(new Map([[existing.id, existing]]), ops, {}).collections.get(existing.id)!;
  const { runtimeData: _r, ...expected } = { ...existing, ...updates };
  const { runtimeData: _n, updated_at: _u, ...actual } = next;
  // add_field 가 id 를 부여하므로 schema 는 key 열로 비교
  expect({ ...actual, schema: actual.schema.map((f) => f.key) }).toEqual({
    ...expected,
    schema: expected.schema.map((f) => f.key),
  });
  return ops;
}

describe("collectionUpdateToOps — 편집기 경로 4종", () => {
  it("셀 편집 → set_cell 1", () => {
    const e = base();
    const ops = expectEquivalent(e, {
      mockData: e.mockData.map((r, i) => (i === 1 ? { ...r, name: "B" } : r)),
    });
    expect(ops).toEqual([{ op: "set_cell", collectionId: "c1", rowIndex: 1, fieldId: "f_name", value: "B" }]);
  });

  it("행 삭제 → remove_rows / 행 추가 (끝) → insert_rows", () => {
    const e = base();
    expect(expectEquivalent(e, { mockData: e.mockData.filter((_, i) => i !== 1) })).toEqual([
      { op: "remove_rows", collectionId: "c1", rowIndexes: [1] },
    ]);
    expect(expectEquivalent(e, { mockData: [...e.mockData, { name: "d", email: "d@x" }] })).toEqual([
      { op: "insert_rows", collectionId: "c1", rows: [{ name: "d", email: "d@x" }], at: 3 },
    ]);
  });

  it("CSV 교체 (구조가 다른 행 전체) → replace_rows", () => {
    const e = base();
    const rows = [{ name: "x", email: "x@x" }, { name: "y", email: "y@x" }];
    expect(expectEquivalent(e, { mockData: rows })).toEqual([{ op: "replace_rows", collectionId: "c1", rows }]);
  });

  it("필드 rename (schema + 옮긴 행 함께) → update_field 1 — 행 op 0", () => {
    const e = base();
    const ops = expectEquivalent(e, {
      schema: e.schema.map((f) => (f.key === "name" ? { ...f, key: "fullName" } : f)),
      mockData: e.mockData.map(({ name, ...rest }) => ({ fullName: name, ...rest })),
      runtimeData: undefined,
    });
    expect(ops).toEqual([{ op: "update_field", collectionId: "c1", fieldId: "f_name", patch: { key: "fullName" } }]);
  });

  it("필드 추가 (id 없음) → add_field / 필드 삭제 → remove_field / label 변경 → update_field", () => {
    const e = base();
    expect(expectEquivalent(e, { schema: [...e.schema, { key: "age", type: "number" }] })).toEqual([
      { op: "add_field", collectionId: "c1", field: { key: "age", type: "number" }, index: 2 },
    ]);
    expect(expectEquivalent(e, { schema: e.schema.filter((f) => f.key !== "email") })).toEqual([
      { op: "remove_field", collectionId: "c1", fieldId: "f_email" },
    ]);
    expect(expectEquivalent(e, { schema: e.schema.map((f) => (f.key === "email" ? { ...f, label: "Mail" } : f)) })).toEqual([
      { op: "update_field", collectionId: "c1", fieldId: "f_email", patch: { label: "Mail" } },
    ]);
  });

  it("이름 · useMockData → update_collection · set_source; 같은 값은 op 0", () => {
    const e = base();
    expect(expectEquivalent(e, { name: "People", useMockData: false })).toEqual([
      { op: "update_collection", collectionId: "c1", patch: { name: "People" } },
      { op: "set_source", collectionId: "c1", source: "api" },
    ]);
    expect(collectionUpdateToOps(e, { name: "Users", mockData: e.mockData, schema: e.schema }).ops).toEqual([]);
  });

  it("runtimeData 는 op 가 아니라 별도 반환 (History 밖 · 메모리 전용)", () => {
    const e = base();
    const rt = [{ name: "rt" }];
    const out = collectionUpdateToOps(e, { runtimeData: rt });
    expect(out.ops).toEqual([]);
    expect(out.runtimeData).toBe(rt);
  });

  it("같은 값의 셀 재입력 (참조만 바뀜) 은 op 0", () => {
    const e = base();
    expect(collectionUpdateToOps(e, { mockData: e.mockData.map((r) => ({ ...r })) }).ops).toEqual([]);
  });
});
