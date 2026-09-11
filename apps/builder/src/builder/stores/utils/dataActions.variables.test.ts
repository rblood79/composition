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

  it("createVariable(page — legacy UI) 는 직접 저장 · History 0 · owner-unresolved 배지", async () => {
    const { set, get } = makeStore();
    const created = await createCreateVariableAction(
      set as never,
      get as never,
    )({
      name: "pv",
      project_id: "p",
      type: "string",
      scope: "page",
    });
    expect(created).toMatchObject({
      scope: "page",
      owner: { kind: "project" },
      migrationStatus: "owner-unresolved",
    });
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
