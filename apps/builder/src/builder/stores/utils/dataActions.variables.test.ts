/**
 * ADR-214 Phase 1 — variables fetch 의 owner 읽기 변환 (G1: 로드 재직렬화 0).
 *
 * - fetch 는 `owner` 를 메모리 Map 에만 채운다 — IndexedDB `update` / `insert` 0회
 * - component / page-without-page_id 는 `owner-unresolved` + console.warn 1회
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Variable } from "../../../types/builder/data.types";

const dbMock = {
  collections: {
    insert: vi.fn(async (v: unknown) => v),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => undefined),
  },
  variables: {
    getByProject: vi.fn(async () => [] as Variable[]),
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
vi.mock("../canonical/canonicalElementsBridge", () => ({
  getActiveCanonicalDocument: () => null,
}));

import {
  createCreateVariableAction,
  createDeleteVariableAction,
  createFetchVariablesAction,
  createUpdateVariableAction,
} from "./dataActions";
import { registerVariableOwnerPageSource } from "./variableOwnerMigration";

const base = (patch: Partial<Variable>): Variable => ({
  id: "v",
  name: "x",
  project_id: "p",
  type: "string",
  persist: false,
  scope: "global",
  ...patch,
});

function makeStore(variables = new Map<string, Variable>()) {
  const state: Record<string, unknown> = {
    collections: new Map(),
    variables,
    errors: new Map(),
    isLoading: false,
  };
  const set = (patch: unknown) => {
    Object.assign(state, typeof patch === "function" ? patch(state) : patch);
  };
  const get = () => state;
  return { state, set, get };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  registerVariableOwnerPageSource(null);
  dbMock.variables.getByProject.mockReset();
  dbMock.variables.insert.mockClear();
  dbMock.variables.update.mockClear();
  dbMock.variables.delete.mockClear();
  addEntry.mockClear();
});

describe("fetchVariables — owner 읽기 변환", () => {
  it("owner 를 메모리에만 채우고 IndexedDB 는 쓰지 않는다 (재직렬화 0)", async () => {
    dbMock.variables.getByProject.mockResolvedValue([
      base({ id: "a", name: "a", scope: "global" }),
      base({ id: "b", name: "b", scope: "page", page_id: "pg" }),
      base({ id: "c", name: "c", scope: "component" }),
      base({ id: "d", name: "d", scope: "page" }),
    ]);
    const { state, set } = makeStore();
    await createFetchVariablesAction(set as never)("p");

    const variables = state.variables as Map<string, Variable>;
    expect(variables.get("a")?.owner).toEqual({ kind: "project" });
    expect(variables.get("b")?.owner).toEqual({ kind: "page", pageId: "pg" });
    expect(variables.get("c")).toMatchObject({
      owner: { kind: "project" },
      migrationStatus: "owner-unresolved",
    });
    expect(variables.get("d")).toMatchObject({
      owner: { kind: "project" },
      migrationStatus: "owner-unresolved",
    });
    // scope / page_id 는 그대로 (하위 호환)
    expect(variables.get("c")?.scope).toBe("component");

    expect(dbMock.variables.update).not.toHaveBeenCalled();
    expect(dbMock.variables.insert).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("페이지 공급자가 1개를 주면 page_id 없는 page 변수는 그 페이지 (판정 C) · IndexedDB 무변경", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    registerVariableOwnerPageSource(() => ["only"]);
    dbMock.variables.getByProject.mockResolvedValue([
      base({ id: "d", name: "d", scope: "page" }),
    ]);
    const { state, set } = makeStore();
    await createFetchVariablesAction(set as never)("p");
    const variables = state.variables as Map<string, Variable>;
    expect(variables.get("d")?.owner).toEqual({ kind: "page", pageId: "only" });
    expect(variables.get("d")).not.toHaveProperty("migrationStatus");
    // C 귀속은 1회 write-back 으로 고정한다 — 그 변수만, page_id 만
    expect(variables.get("d")?.page_id).toBe("only");
    expect(dbMock.variables.update).toHaveBeenCalledTimes(1);
    expect(dbMock.variables.update).toHaveBeenCalledWith("d", {
      page_id: "only",
    });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("write-back 은 C 귀속 변수에 한정 — global · page_id 있는 page · component 는 IndexedDB 무변경", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    registerVariableOwnerPageSource(() => ["only"]);
    dbMock.variables.getByProject.mockResolvedValue([
      base({ id: "a", name: "a", scope: "global" }),
      base({ id: "b", name: "b", scope: "page", page_id: "pg" }),
      base({ id: "c", name: "c", scope: "component" }),
      base({ id: "d", name: "d", scope: "page" }),
    ]);
    const { set } = makeStore();
    await createFetchVariablesAction(set as never)("p");
    expect(dbMock.variables.update).toHaveBeenCalledTimes(1);
    expect(dbMock.variables.update.mock.calls[0][0]).toBe("d");
  });

  it("write-back 이 실패해도 로드는 성공한다 (메모리 귀속 유지 · warn 1회)", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    registerVariableOwnerPageSource(() => ["only"]);
    dbMock.variables.getByProject.mockResolvedValue([
      base({ id: "d", name: "d", scope: "page" }),
    ]);
    dbMock.variables.update.mockRejectedValueOnce(new Error("quota"));
    const { set, state } = makeStore();
    await createFetchVariablesAction(set as never)("p");
    const variables = state.variables as Map<string, Variable>;
    expect(variables.get("d")?.owner).toEqual({ kind: "page", pageId: "only" });
    expect(state.isLoading).toBe(false);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("전부 global 이면 로그 0", async () => {
    dbMock.variables.getByProject.mockResolvedValue([
      base({ id: "a", name: "a" }),
    ]);
    const { set } = makeStore();
    await createFetchVariablesAction(set as never)("p");
    expect(console.warn).not.toHaveBeenCalled();
  });
});

describe("create / update / delete — ADR-152 적용기 wrapper (History 동봉)", () => {
  it("createVariable(global) → define_variable → History 1 · owner project · Map name 키", async () => {
    const { set, get, state } = makeStore();
    const created = await createCreateVariableAction(
      set as never,
      get as never,
    )({
      name: "count",
      project_id: "p",
      type: "number",
      defaultValue: 0,
    });
    expect(created).toMatchObject({
      name: "count",
      type: "number",
      defaultValue: 0,
      scope: "global",
      owner: { kind: "project" },
    });
    expect((state.variables as Map<string, Variable>).get("count")).toBe(
      created,
    );
    expect(dbMock.variables.insert).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect((addEntry.mock.calls[0][0] as { elementId: string }).elementId).toBe(
      created.id,
    );
  });

  it("createVariable(page) 는 page_id 가 있어야 한다 — 없으면 throw · 저장 0", async () => {
    const { set, get, state } = makeStore();
    await expect(
      createCreateVariableAction(
        set as never,
        get as never,
      )({
        name: "pv",
        project_id: "p",
        type: "string",
        scope: "page",
      }),
    ).rejects.toThrow(/page_id/);
    expect(dbMock.variables.insert).not.toHaveBeenCalled();
    expect((state.variables as Map<string, Variable>).size).toBe(0);
  });

  it("createVariable(page + page_id — legacy 직접 저장) 는 History 0 · owner page (배지 없음)", async () => {
    const { set, get } = makeStore();
    const created = await createCreateVariableAction(
      set as never,
      get as never,
    )({
      name: "pv",
      project_id: "p",
      type: "string",
      scope: "page",
      page_id: "pg",
    });
    expect(created).toMatchObject({
      scope: "page",
      page_id: "pg",
      owner: { kind: "page", pageId: "pg" },
    });
    expect(created).not.toHaveProperty("migrationStatus");
    expect(addEntry).not.toHaveBeenCalled();
    expect(dbMock.variables.insert).toHaveBeenCalledTimes(1);
  });

  it("updateVariable: 정의 축은 define_variable (History) · legacy 필드는 직접 저장", async () => {
    const existing = base({ id: "v1", name: "a", defaultValue: "x" });
    const { set, get, state } = makeStore(new Map([["a", existing]]));
    const update = createUpdateVariableAction(set as never, get as never);

    await update("v1", { name: "b", defaultValue: "y" });
    const variables = () => state.variables as Map<string, Variable>;
    expect(variables().has("a")).toBe(false);
    expect(variables().get("b")).toMatchObject({ id: "v1", defaultValue: "y" });
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(dbMock.variables.update).toHaveBeenCalledTimes(1);

    await update("v1", { transform: "v => v" });
    expect(addEntry).toHaveBeenCalledTimes(1); // legacy 필드는 History 없음
    expect(dbMock.variables.update).toHaveBeenCalledTimes(2);
    expect(variables().get("b")?.transform).toBe("v => v");
  });

  it("updateVariable(scope/page_id) 는 메모리 owner 를 다시 판정한다 (global→page 는 page 소유 · page→global 은 project)", async () => {
    const existing = base({ id: "v1", name: "a", owner: { kind: "project" } });
    const { set, get, state } = makeStore(new Map([["a", existing]]));
    const update = createUpdateVariableAction(set as never, get as never);
    const variables = () => state.variables as Map<string, Variable>;

    await update("v1", { scope: "page", page_id: "pg" });
    expect(variables().get("a")).toMatchObject({
      scope: "page",
      page_id: "pg",
      owner: { kind: "page", pageId: "pg" },
    });
    expect(variables().get("a")).not.toHaveProperty("migrationStatus");
    expect(addEntry).not.toHaveBeenCalled();

    await update("v1", { scope: "global", page_id: undefined });
    expect(variables().get("a")?.owner).toEqual({ kind: "project" });
    expect(variables().get("a")?.page_id).toBeUndefined();
  });

  it("updateVariable 이름 충돌 → throw · 상태 무변경", async () => {
    const { set, get, state } = makeStore(
      new Map([
        ["a", base({ id: "v1", name: "a" })],
        ["b", base({ id: "v2", name: "b" })],
      ]),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      createUpdateVariableAction(set as never, get as never)("v1", {
        name: "b",
      }),
    ).rejects.toThrow(/이미 있습니다/);
    expect((state.variables as Map<string, Variable>).get("a")?.id).toBe("v1");
    expect(addEntry).not.toHaveBeenCalled();
  });

  it("deleteVariable → define_variable(null) → History (inverse 는 같은 id 재정의)", async () => {
    const { set, get, state } = makeStore(
      new Map([["a", base({ id: "v1", name: "a" })]]),
    );
    await createDeleteVariableAction(set as never, get as never)("v1");
    expect((state.variables as Map<string, Variable>).size).toBe(0);
    expect(dbMock.variables.delete).toHaveBeenCalledWith("v1");
    const entry = addEntry.mock.calls[0][0] as {
      data: {
        dataChangeEvent: {
          inverse: Array<{ variableId?: string; definition: unknown }>;
        };
      };
    };
    expect(entry.data.dataChangeEvent.inverse[0]).toMatchObject({
      variableId: "v1",
      definition: { name: "a", type: "string" },
    });
  });
});
