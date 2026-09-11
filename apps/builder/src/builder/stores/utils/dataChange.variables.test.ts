/**
 * ADR-214 Phase 1 — `define_variable` op (프로젝트 변수 CRUD 를 ADR-152 적용기에 통합).
 *
 * - reduce: create (id 발급 · applied 에 실림) / update (rename 은 name 키 재발급) / remove
 *   (definition null) · 역연산 왕복 · 이름 고유 (store + 문서 state 예약어) · 없는 id 거부
 * - apply: IndexedDB `variables` insert/update/delete · 메모리 Map (name 키) · History
 *   `type:"data"` entry (elementId = variableId) · collections 무변경 · record:false
 * - 갱신은 `owner-unresolved` 배지를 지우지 않는다 (Phase 5 의 명시 해소 전까지)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataOp } from "@composition/shared";
import type { DataTable, Variable } from "../../../types/builder/data.types";

const dbMock = {
  collections: {
    insert: vi.fn(async (dt: DataTable) => dt),
    update: vi.fn(async () => ({}) as DataTable),
    delete: vi.fn(async () => undefined),
  },
  variables: {
    insert: vi.fn(async (v: Variable) => v),
    update: vi.fn(
      async (_id: string, _u: Partial<Variable>) => ({}) as Variable,
    ),
    delete: vi.fn(async () => undefined),
  },
};
vi.mock("../../../lib/db", () => ({ getDB: async () => dbMock }));

const addEntry = vi.fn();
vi.mock("../history", () => ({
  historyManager: { addEntry: (...args: unknown[]) => addEntry(...args) },
}));

const activeDocument = { current: null as unknown };
vi.mock("../canonical/canonicalElementsBridge", () => ({
  getActiveCanonicalDocument: () => activeDocument.current,
}));

import {
  DataChangeError,
  createApplyDataChangeAction,
  reduceDataOps,
} from "./dataChange";

const variable = (patch: Partial<Variable>): Variable => ({
  id: "v_user",
  name: "userName",
  project_id: "p",
  type: "string",
  defaultValue: "guest",
  persist: false,
  scope: "global",
  owner: { kind: "project" },
  ...patch,
});

const seedVariables = () =>
  new Map<string, Variable>([
    ["userName", variable({})],
    [
      "legacyComp",
      variable({
        id: "v_comp",
        name: "legacyComp",
        scope: "component",
        migrationStatus: "owner-unresolved",
      }),
    ],
  ]);

const ctx = () => ({ projectId: "p", variables: seedVariables() });

describe("reduceDataOps — define_variable", () => {
  it("create: id 발급 · applied 에 variableId · inverse 는 remove · collections 무변경", () => {
    const r = reduceDataOps(
      new Map(),
      [
        {
          op: "define_variable",
          definition: { name: "count", type: "number", defaultValue: 0 },
        },
      ],
      ctx(),
    );
    const applied = r.applied[0] as { variableId: string };
    expect(applied.variableId).toBeTruthy();
    const created = r.variables.get("count")!;
    expect(created).toMatchObject({
      id: applied.variableId,
      name: "count",
      type: "number",
      defaultValue: 0,
      persist: false,
      project_id: "p",
      scope: "global",
      owner: { kind: "project" },
    });
    expect(r.inverse).toEqual([
      {
        op: "define_variable",
        variableId: applied.variableId,
        definition: null,
      },
    ]);
    expect(r.variablesUpserted).toEqual(new Set([applied.variableId]));
    expect(r.upserted.size).toBe(0);
    expect(r.collections.size).toBe(0);
  });

  it("update (rename): name 키 재발급 · 다른 필드 보존 · 배지 유지 · inverse 는 이전 정의", () => {
    const r = reduceDataOps(
      new Map(),
      [
        {
          op: "define_variable",
          variableId: "v_comp",
          definition: {
            name: "renamed",
            type: "boolean",
            defaultValue: true,
            persist: true,
          },
        },
      ],
      ctx(),
    );
    expect(r.variables.has("legacyComp")).toBe(false);
    expect(r.variables.get("renamed")).toMatchObject({
      id: "v_comp",
      type: "boolean",
      defaultValue: true,
      persist: true,
      scope: "component",
      migrationStatus: "owner-unresolved",
      owner: { kind: "project" },
    });
    expect(r.inverse).toEqual([
      {
        op: "define_variable",
        variableId: "v_comp",
        definition: {
          name: "legacyComp",
          type: "string",
          defaultValue: "guest",
          persist: false,
        },
      },
    ]);
  });

  it("remove: definition null → 삭제 · inverse 는 같은 id 로 재정의 (참조 보존)", () => {
    const r = reduceDataOps(
      new Map(),
      [{ op: "define_variable", variableId: "v_user", definition: null }],
      ctx(),
    );
    expect(r.variables.has("userName")).toBe(false);
    expect(r.variablesDeleted).toEqual(new Set(["v_user"]));
    expect(r.inverse).toEqual([
      {
        op: "define_variable",
        variableId: "v_user",
        definition: {
          name: "userName",
          type: "string",
          defaultValue: "guest",
          persist: false,
        },
      },
    ]);
    // 왕복
    const back = reduceDataOps(new Map(), r.inverse, {
      projectId: "p",
      variables: r.variables,
    });
    expect(back.variables.get("userName")?.id).toBe("v_user");
  });

  it("이름 고유: store 안 다른 변수 · 문서 state 예약어와 충돌하면 throw · 자기 이름 유지는 허용", () => {
    expect(() =>
      reduceDataOps(
        new Map(),
        [
          {
            op: "define_variable",
            definition: { name: "userName", type: "string" },
          },
        ],
        ctx(),
      ),
    ).toThrow(DataChangeError);
    expect(() =>
      reduceDataOps(
        new Map(),
        [
          {
            op: "define_variable",
            definition: { name: "cardCount", type: "number" },
          },
        ],
        { ...ctx(), documentVariableNames: new Set(["cardCount"]) },
      ),
    ).toThrow(/cardCount/);
    expect(() =>
      reduceDataOps(
        new Map(),
        [
          {
            op: "define_variable",
            variableId: "v_user",
            definition: { name: "userName", type: "number" },
          },
        ],
        ctx(),
      ),
    ).not.toThrow();
  });

  it("없는 id 삭제 · variableId 없는 null 정의 · 빈 이름은 throw", () => {
    expect(() =>
      reduceDataOps(
        new Map(),
        [{ op: "define_variable", variableId: "nope", definition: null }],
        ctx(),
      ),
    ).toThrow(DataChangeError);
    expect(() =>
      reduceDataOps(
        new Map(),
        [{ op: "define_variable", definition: null }],
        ctx(),
      ),
    ).toThrow(DataChangeError);
    expect(() =>
      reduceDataOps(
        new Map(),
        [
          {
            op: "define_variable",
            definition: { name: "   ", type: "string" },
          },
        ],
        ctx(),
      ),
    ).toThrow(DataChangeError);
  });

  it("variables ctx 가 없으면 빈 Map 으로 시작한다 (collections 전용 호출 호환)", () => {
    const r = reduceDataOps(
      new Map(),
      [{ op: "define_variable", definition: { name: "a", type: "string" } }],
      { projectId: "p" },
    );
    expect(r.variables.size).toBe(1);
  });
});

describe("applyDataChange — define_variable", () => {
  function makeStore() {
    const state: Record<string, unknown> = {
      collections: new Map(),
      variables: seedVariables(),
      errors: new Map(),
    };
    const set = (patch: unknown) =>
      Object.assign(state, typeof patch === "function" ? patch(state) : patch);
    const get = () => state;
    return {
      state,
      apply: createApplyDataChangeAction(set as never, get as never),
      variables: () => state.variables as Map<string, Variable>,
    };
  }
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    activeDocument.current = null;
  });
  afterEach(() => vi.restoreAllMocks());

  it("create → variables.insert 1 · 메모리 Map · History data entry (elementId = variableId) · collections DB 0", async () => {
    const { apply, variables } = makeStore();
    const result = await apply({
      ops: [
        {
          op: "define_variable",
          definition: { name: "count", type: "number", defaultValue: 0 },
        },
      ],
      origin: "user",
    });
    const id = (result.applied[0] as { variableId: string }).variableId;
    expect(variables().get("count")?.id).toBe(id);
    expect(dbMock.variables.insert).toHaveBeenCalledTimes(1);
    expect(dbMock.collections.insert).not.toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][0] as {
      type: string;
      elementId: string;
      elementIds: string[];
      data: { dataChangeEvent: { inverse: DataOp[] } };
    };
    expect(entry.type).toBe("data");
    expect(entry.elementId).toBe(id);
    expect(entry.elementIds).toEqual([id]);
    expect(entry.data.dataChangeEvent.inverse).toEqual([
      { op: "define_variable", variableId: id, definition: null },
    ]);
    expect(result.variableIds).toEqual([id]);
  });

  it("update → variables.update 1 · remove → delete 1 · undo(remove) → insert 같은 id (record:false, History 0)", async () => {
    const { apply, variables } = makeStore();
    await apply({
      ops: [
        {
          op: "define_variable",
          variableId: "v_user",
          definition: { name: "userName", type: "string", defaultValue: "Ana" },
        },
      ],
      origin: "user",
    });
    expect(dbMock.variables.update).toHaveBeenCalledWith(
      "v_user",
      expect.objectContaining({ defaultValue: "Ana" }),
    );
    expect(variables().get("userName")?.defaultValue).toBe("Ana");

    const removed = await apply({
      ops: [{ op: "define_variable", variableId: "v_user", definition: null }],
      origin: "user",
    });
    expect(dbMock.variables.delete).toHaveBeenCalledWith("v_user");
    expect(variables().has("userName")).toBe(false);

    addEntry.mockClear();
    await apply({ ops: removed.inverse, origin: "user" }, { record: false });
    expect(addEntry).not.toHaveBeenCalled();
    expect(dbMock.variables.insert).toHaveBeenCalledTimes(1);
    expect(variables().get("userName")?.id).toBe("v_user");
  });

  it("문서 안 페이지/요소 state 이름은 프로젝트 변수로 못 쓴다 (활성 canonical 문서 조회)", async () => {
    activeDocument.current = {
      version: "composition-1.0",
      children: [
        {
          id: "page",
          type: "frame",
          metadata: { type: "page" },
          state: [{ id: "v_pg", name: "pageVar", type: "string" }],
        },
      ],
    };
    const { apply, variables } = makeStore();
    await expect(
      apply({
        ops: [
          {
            op: "define_variable",
            definition: { name: "pageVar", type: "string" },
          },
        ],
        origin: "user",
      }),
    ).rejects.toThrow(DataChangeError);
    expect(variables().has("pageVar")).toBe(false);
    expect(dbMock.variables.insert).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it("DB 실패 → 메모리 0 · History 0 · errors 기록", async () => {
    const { apply, variables, state } = makeStore();
    dbMock.variables.insert.mockRejectedValueOnce(new Error("quota"));
    await expect(
      apply({
        ops: [
          { op: "define_variable", definition: { name: "x", type: "string" } },
        ],
        origin: "user",
      }),
    ).rejects.toThrow("quota");
    expect(variables().has("x")).toBe(false);
    expect(addEntry).not.toHaveBeenCalled();
    expect((state.errors as Map<string, Error>).has("applyDataChange")).toBe(
      true,
    );
  });
});
