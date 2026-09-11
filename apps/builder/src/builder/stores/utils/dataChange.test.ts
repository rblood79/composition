/**
 * ADR-152 Phase 1c — `DataChange` 적용기.
 *
 * - reduceDataOps: op 별 결과 + 역연산 (inverse 를 적용하면 원상 — 왕복 불변식)
 * - applyDataChange: DB → 메모리 → History (`type:"data"`, inverse 동봉) → Canvas
 * - record:false (undo/redo 재적용) 는 History 를 만들지 않는다
 * - 검증 실패 (없는 collection · 범위 밖 row · 미배선 op) 는 아무것도 바꾸지 않는다
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataOp } from "@composition/shared";
import type { DataTable } from "../../../types/builder/data.types";

const dbMock = {
  collections: {
    insert: vi.fn(async (dt: DataTable) => dt),
    update: vi.fn(async (_id: string, _u: Partial<DataTable>) => ({}) as DataTable),
    delete: vi.fn(async () => undefined),
  },
};
vi.mock("../../../lib/db", () => ({ getDB: async () => dbMock }));

const addEntry = vi.fn();
vi.mock("../history", () => ({
  historyManager: { addEntry: (...args: unknown[]) => addEntry(...args) },
}));

import {
  DataChangeError,
  createApplyDataChangeAction,
  reduceDataOps,
  registerDataBindingConsumer,
  type DataBindingConsumer,
} from "./dataChange";

const users = (): DataTable => ({
  id: "c1",
  name: "Users",
  project_id: "p",
  schema: [
    { id: "f_name", key: "name", type: "string", label: "Name" },
    { id: "f_email", key: "email", type: "email" },
  ],
  mockData: [
    { name: "a", email: "a@x" },
    { name: "b", email: "b@x" },
    { name: "c", email: "c@x" },
  ],
  runtimeData: [{ name: "rt", email: "rt@x" }],
  useMockData: true,
});

const seed = () => new Map<string, DataTable>([["c1", users()]]);

/** 왕복 불변식: ops 적용 후 inverse 적용 = 원상 (runtimeData 는 메모리 전용이라 제외). */
function roundTrip(ops: DataOp[]) {
  const before = seed();
  const forward = reduceDataOps(before, ops, { projectId: "p" });
  const back = reduceDataOps(forward.collections, forward.inverse, { projectId: "p" });
  const strip = (m: Map<string, DataTable>) =>
    [...m.values()].map(({ runtimeData: _r, updated_at: _u, created_at: _c, ...rest }) => rest);
  expect(strip(back.collections)).toEqual(strip(before));
  // inverse 의 inverse 는 forward 와 같은 효과
  const again = reduceDataOps(back.collections, back.inverse, { projectId: "p" });
  expect(strip(again.collections)).toEqual(strip(forward.collections));
  return forward;
}

describe("reduceDataOps — op 별 결과 + 역연산 왕복", () => {
  it("set_cell", () => {
    const r = roundTrip([{ op: "set_cell", collectionId: "c1", rowIndex: 1, fieldId: "f_name", value: "B" }]);
    expect(r.collections.get("c1")!.mockData[1]).toEqual({ name: "B", email: "b@x" });
    expect(r.inverse).toEqual([{ op: "set_cell", collectionId: "c1", rowIndex: 1, fieldId: "f_name", value: "b" }]);
  });

  it("remove_rows (비연속) → inverse 는 오름차순 insert_rows", () => {
    const r = roundTrip([{ op: "remove_rows", collectionId: "c1", rowIndexes: [2, 0] }]);
    expect(r.collections.get("c1")!.mockData).toEqual([{ name: "b", email: "b@x" }]);
    expect(r.inverse.map((o) => o.op)).toEqual(["insert_rows", "insert_rows"]);
    expect((r.inverse[0] as { at: number }).at).toBe(0);
    expect((r.inverse[1] as { at: number }).at).toBe(2);
  });

  it("insert_rows (at 생략 = 끝) / replace_rows (CSV)", () => {
    const ins = roundTrip([{ op: "insert_rows", collectionId: "c1", rows: [{ name: "d" }] }]);
    expect(ins.collections.get("c1")!.mockData).toHaveLength(4);
    expect(ins.inverse).toEqual([{ op: "remove_rows", collectionId: "c1", rowIndexes: [3] }]);
    const rep = roundTrip([{ op: "replace_rows", collectionId: "c1", rows: [{ name: "z" }] }]);
    expect(rep.collections.get("c1")!.mockData).toEqual([{ name: "z" }]);
    expect((rep.inverse[0] as { rows: unknown[] }).rows).toHaveLength(3);
  });

  it("update_field key 변경 = rename — 행 (mockData · runtimeData) 도 옮기고 id 는 고정", () => {
    const r = roundTrip([{ op: "update_field", collectionId: "c1", fieldId: "f_name", patch: { key: "fullName", label: null } }]);
    const c = r.collections.get("c1")!;
    expect(c.schema[0]).toEqual({ id: "f_name", key: "fullName", type: "string" });
    expect(c.mockData[0]).toEqual({ fullName: "a", email: "a@x" });
    expect(c.runtimeData?.[0]).toEqual({ fullName: "rt", email: "rt@x" });
    expect(r.inverse).toEqual([{ op: "update_field", collectionId: "c1", fieldId: "f_name", patch: { key: "name", label: "Name" } }]);
  });

  it("add_field (id 없음 → 부여, applied 에 id 실림) / remove_field (schema 만, 행 값 유지)", () => {
    const add = roundTrip([{ op: "add_field", collectionId: "c1", field: { key: "age", type: "number" }, index: 1 }]);
    const added = add.collections.get("c1")!.schema[1];
    expect(added.key).toBe("age");
    expect(added.id).toMatch(/\S+/);
    expect((add.applied[0] as { field: { id?: string } }).field.id).toBe(added.id);
    expect(add.inverse).toEqual([{ op: "remove_field", collectionId: "c1", fieldId: added.id }]);

    const rm = roundTrip([{ op: "remove_field", collectionId: "c1", fieldId: "f_email" }]);
    expect(rm.collections.get("c1")!.schema.map((f) => f.key)).toEqual(["name"]);
    expect(rm.collections.get("c1")!.mockData[0]).toEqual({ name: "a", email: "a@x" });
    expect(rm.inverse).toEqual([{ op: "add_field", collectionId: "c1", field: { id: "f_email", key: "email", type: "email" }, index: 1 }]);
  });

  it("create_collection / delete_collection — 같은 id 로 되살아난다 (바인딩 참조 보존)", () => {
    const del = roundTrip([{ op: "delete_collection", collectionId: "c1" }]);
    expect(del.collections.size).toBe(0);
    expect(del.inverse[0]).toMatchObject({ op: "create_collection", id: "c1", name: "Users", projectId: "p" });

    const cr = reduceDataOps(new Map(), [{ op: "create_collection", name: "Roles", schema: [{ key: "role", type: "string" }] }], { projectId: "p" });
    const created = [...cr.collections.values()][0];
    expect(created.project_id).toBe("p");
    expect(created.schema[0].id).toMatch(/\S+/);
    expect((cr.applied[0] as { id?: string }).id).toBe(created.id);
    expect(cr.inverse).toEqual([{ op: "delete_collection", collectionId: created.id }]);
  });

  it("update_collection / set_source", () => {
    const r = roundTrip([
      { op: "update_collection", collectionId: "c1", patch: { name: "People" } },
      { op: "set_source", collectionId: "c1", source: "api" },
    ]);
    const c = r.collections.get("c1")!;
    expect(c.name).toBe("People");
    expect(c.useMockData).toBe(false);
    // inverse 는 역순
    expect(r.inverse.map((o) => o.op)).toEqual(["set_source", "update_collection"]);
  });

  it("검증 실패는 throw — 없는 collection · 범위 밖 row · 미배선 op (bind_element · endpointId)", () => {
    const m = seed();
    expect(() => reduceDataOps(m, [{ op: "set_cell", collectionId: "nope", rowIndex: 0, fieldId: "f_name", value: 1 }], {})).toThrow(DataChangeError);
    expect(() => reduceDataOps(m, [{ op: "set_cell", collectionId: "c1", rowIndex: 9, fieldId: "f_name", value: 1 }], {})).toThrow(DataChangeError);
    // bind_element 는 canonical 축 — 순수 reducer 에 오면 계약 위반 (적용기가 먼저 나눈다)
    expect(() => reduceDataOps(m, [{ op: "bind_element", elementId: "e", collectionId: "c1" }], {})).toThrow(DataChangeError);
    expect(() => reduceDataOps(m, [{ op: "set_source", collectionId: "c1", source: "api", endpointId: "api_1" }], {})).toThrow(DataChangeError);
    expect(() => reduceDataOps(m, [{ op: "update_field", collectionId: "c1", fieldId: "f_name", patch: { key: "email" } }], {})).toThrow(/email/);
  });
});

describe("applyDataChange — DB · 메모리 · History · record:false", () => {
  function makeStore() {
    const state: Record<string, unknown> = { collections: seed(), errors: new Map() };
    const set = (patch: unknown) => Object.assign(state, typeof patch === "function" ? patch(state) : patch);
    const get = () => state;
    return { state, apply: createApplyDataChangeAction(set as never, get as never), collections: () => state.collections as Map<string, DataTable> };
  }
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("셀 편집 → DB update 1 · 메모리 갱신 · History data entry (inverse 동봉)", async () => {
    const { apply, collections } = makeStore();
    const result = await apply({ ops: [{ op: "set_cell", collectionId: "c1", rowIndex: 0, fieldId: "f_name", value: "A" }], origin: "user" });
    expect(collections().get("c1")!.mockData[0].name).toBe("A");
    expect(dbMock.collections.update).toHaveBeenCalledTimes(1);
    expect(dbMock.collections.update.mock.calls[0][0]).toBe("c1");
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][0] as { type: string; elementId: string; data: { dataChangeEvent: { change: { ops: DataOp[]; origin: string }; inverse: DataOp[] } } };
    expect(entry.type).toBe("data");
    expect(entry.elementId).toBe("c1");
    expect(entry.data.dataChangeEvent.change.origin).toBe("user");
    expect(entry.data.dataChangeEvent.inverse).toEqual(result.inverse);
    expect(result.inverse[0]).toMatchObject({ op: "set_cell", value: "a" });
  });

  it("record:false 는 History 0 (undo/redo 재적용 경로)", async () => {
    const { apply } = makeStore();
    await apply({ ops: [{ op: "remove_rows", collectionId: "c1", rowIndexes: [0] }], origin: "user" }, { record: false });
    expect(addEntry).not.toHaveBeenCalled();
    expect(dbMock.collections.update).toHaveBeenCalledTimes(1);
  });

  it("create → insert · delete → delete · undo(delete) → insert 같은 id", async () => {
    const { apply, collections } = makeStore();
    const created = await apply({ ops: [{ op: "create_collection", name: "Roles", schema: [{ key: "r", type: "string" }] }], origin: "user" });
    expect(dbMock.collections.insert).toHaveBeenCalledTimes(1);
    const id = (created.applied[0] as { id: string }).id;
    expect(collections().has(id)).toBe(true);

    const deleted = await apply({ ops: [{ op: "delete_collection", collectionId: id }], origin: "user" });
    expect(dbMock.collections.delete).toHaveBeenCalledWith(id);
    expect(collections().has(id)).toBe(false);

    await apply({ ops: deleted.inverse, origin: "user" }, { record: false });
    expect(dbMock.collections.insert).toHaveBeenCalledTimes(2);
    expect(collections().get(id)?.name).toBe("Roles");
  });

  it("검증 실패 → DB 0 · 메모리 0 · History 0 · throw", async () => {
    const { apply, collections } = makeStore();
    await expect(
      apply({ ops: [{ op: "set_cell", collectionId: "c1", rowIndex: 0, fieldId: "f_name", value: "A" }, { op: "delete_collection", collectionId: "nope" }], origin: "user" }),
    ).rejects.toThrow(DataChangeError);
    expect(collections().get("c1")!.mockData[0].name).toBe("a");
    expect(dbMock.collections.update).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it("DB 실패 → 메모리 0 · History 0 · errors 기록 · throw", async () => {
    const { apply, collections, state } = makeStore();
    dbMock.collections.update.mockRejectedValueOnce(new Error("quota"));
    await expect(apply({ ops: [{ op: "set_cell", collectionId: "c1", rowIndex: 0, fieldId: "f_name", value: "A" }], origin: "user" })).rejects.toThrow("quota");
    expect(collections().get("c1")!.mockData[0].name).toBe("a");
    expect(addEntry).not.toHaveBeenCalled();
    expect((state.errors as Map<string, Error>).has("applyDataChange")).toBe(true);
  });
});

describe("applyDataChange — bind_element (ADR-213 Phase 2, canonical 축 consumer + cross-store 원자성)", () => {
  type Snap = { props?: unknown; extension?: unknown };
  /** 가짜 canonical — 요소별 props/extension dataBinding 자리 */
  let nodes: Map<string, Snap>;
  let failOn: string | null;
  const consumer: DataBindingConsumer = {
    has: (id) => nodes.has(id),
    apply: (id, write) => {
      if (id === failOn) throw new Error("canonical write failed");
      const node = nodes.get(id);
      if (!node) return null;
      const previous: Snap = { props: node.props, extension: node.extension };
      if (write.restore) {
        nodes.set(id, { props: write.restore.props, extension: write.restore.extension });
      } else if (write.binding === null) {
        nodes.set(id, {});
      } else {
        nodes.set(id, { props: write.binding });
      }
      return { previous };
    },
  };

  function makeStore() {
    const state: Record<string, unknown> = { collections: seed(), errors: new Map() };
    const set = (patch: unknown) => Object.assign(state, typeof patch === "function" ? patch(state) : patch);
    const get = () => state;
    return { state, apply: createApplyDataChangeAction(set as never, get as never), collections: () => state.collections as Map<string, DataTable> };
  }
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    nodes = new Map([
      ["e_free", {}],
      ["e_legacy", { extension: { type: "collection", source: "static", config: { data: [] } } }],
    ]);
    failOn = null;
    registerDataBindingConsumer(consumer);
  });
  afterEach(() => {
    registerDataBindingConsumer(null);
    vi.restoreAllMocks();
  });

  it("bind → props.dataBinding 이 사람 UI 형상 {source:dataTable, collectionId, name} 으로 기록 · History 1 · inverse 는 restore 스냅샷", async () => {
    const { apply } = makeStore();
    const result = await apply({ ops: [{ op: "bind_element", elementId: "e_free", collectionId: "c1", fieldMap: { value: "f_name" } }], origin: "ai" });
    expect(nodes.get("e_free")).toEqual({ props: { source: "dataTable", collectionId: "c1", name: "Users", fieldMap: { value: "f_name" } } });
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][0] as { elementIds: string[]; data: { dataChangeEvent: { change: { origin: string } } } };
    expect(entry.elementIds).toContain("e_free");
    expect(entry.data.dataChangeEvent.change.origin).toBe("ai");
    expect(result.inverse).toEqual([{ op: "bind_element", elementId: "e_free", collectionId: null, restore: { props: undefined, extension: undefined } }]);
    expect(dbMock.collections.update).not.toHaveBeenCalled();
  });

  it("undo(inverse, record:false) 는 legacy extension 형태까지 원상 복구한다", async () => {
    const { apply } = makeStore();
    const before = structuredClone(nodes.get("e_legacy"));
    const forward = await apply({ ops: [{ op: "bind_element", elementId: "e_legacy", collectionId: "c1" }], origin: "agent" });
    expect(nodes.get("e_legacy")).toEqual({ props: { source: "dataTable", collectionId: "c1", name: "Users" } });
    await apply({ ops: forward.inverse, origin: "agent" }, { record: false });
    expect(nodes.get("e_legacy")).toEqual(before);
    expect(addEntry).toHaveBeenCalledTimes(1);
  });

  it("collectionId:null 은 해제 — inverse 로 다시 붙는다", async () => {
    const { apply } = makeStore();
    await apply({ ops: [{ op: "bind_element", elementId: "e_free", collectionId: "c1" }], origin: "user" });
    const unbound = await apply({ ops: [{ op: "bind_element", elementId: "e_free", collectionId: null }], origin: "user" });
    expect(nodes.get("e_free")).toEqual({});
    await apply({ ops: unbound.inverse, origin: "user" }, { record: false });
    expect(nodes.get("e_free")).toEqual({ props: { source: "dataTable", collectionId: "c1", name: "Users" } });
  });

  it("preflight — 없는 요소 · 없는 collection 은 아무것도 바꾸지 않고 throw (같은 change 안에서 만든 collection 은 허용)", async () => {
    const { apply, collections } = makeStore();
    await expect(apply({ ops: [{ op: "bind_element", elementId: "ghost", collectionId: "c1" }], origin: "ai" })).rejects.toThrow(DataChangeError);
    await expect(apply({ ops: [{ op: "set_cell", collectionId: "c1", rowIndex: 0, fieldId: "f_name", value: "A" }, { op: "bind_element", elementId: "e_free", collectionId: "nope" }], origin: "ai" })).rejects.toThrow(DataChangeError);
    expect(collections().get("c1")!.mockData[0].name).toBe("a");
    expect(dbMock.collections.update).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();

    const created = await apply({ ops: [{ op: "create_collection", id: "c_new", name: "Roles", schema: [{ key: "r", type: "string" }] }, { op: "bind_element", elementId: "e_free", collectionId: "c_new" }], origin: "ai" });
    expect(nodes.get("e_free")).toEqual({ props: { source: "dataTable", collectionId: "c_new", name: "Roles" } });
    expect(created.inverse.map((o) => o.op)).toEqual(["bind_element", "delete_collection"]);
    expect(addEntry).toHaveBeenCalledTimes(1);
  });

  it("두 번째 binding 이 실패하면 첫 binding 과 collection 변경을 전부 되돌리고 History 0", async () => {
    const { apply, collections } = makeStore();
    failOn = "e_legacy";
    const before = structuredClone(nodes.get("e_legacy"));
    await expect(
      apply({
        ops: [
          { op: "set_cell", collectionId: "c1", rowIndex: 0, fieldId: "f_name", value: "A" },
          { op: "bind_element", elementId: "e_free", collectionId: "c1" },
          { op: "bind_element", elementId: "e_legacy", collectionId: "c1" },
        ],
        origin: "ai",
      }),
    ).rejects.toThrow("canonical write failed");
    expect(nodes.get("e_free")).toEqual({});
    expect(nodes.get("e_legacy")).toEqual(before);
    expect(collections().get("c1")!.mockData[0].name).toBe("a");
    // DB: 1회 commit + 1회 rollback update
    expect(dbMock.collections.update).toHaveBeenCalledTimes(2);
    expect(addEntry).not.toHaveBeenCalled();
  });

  it("consumer 미등록이면 binding op 는 throw (조용한 no-op 금지)", async () => {
    registerDataBindingConsumer(null);
    const { apply } = makeStore();
    await expect(apply({ ops: [{ op: "bind_element", elementId: "e_free", collectionId: "c1" }], origin: "ai" })).rejects.toThrow(DataChangeError);
  });
});
