/**
 * ADR-214 · ADR-286 — 프로젝트 변수 액션은 `define_variable` 적용기 (문서 쓰기 하나 · History)
 * 의 얇은 wrapper 다. 페이지 · 요소 변수는 문서의 상태 변수라 이 액션의 scope 는 project 뿐.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Variable } from "../../../types/builder/data.types";

const addEntry = vi.fn();

import {
  createCreateVariableAction,
  createDeleteVariableAction,
  createUpdateVariableAction,
} from "./dataActions";
import {
  attachTestDataStore,
  installTestDataChangeRecorder,
  testDataCommits,
} from "./__tests__/support/dataChangeRecorder";

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
    apiEndpoints: new Map(),
    errors: new Map(),
    isLoading: false,
  };
  const set = (patch: unknown) => {
    Object.assign(state, typeof patch === "function" ? patch(state) : patch);
  };
  const get = () => state;
  attachTestDataStore(set as never, get as never);
  return { state, set, get };
}

beforeEach(() => {
  testDataCommits.length = 0;
  installTestDataChangeRecorder((entry) => addEntry(entry));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  addEntry.mockClear();
});

describe("create / update / delete — define_variable wrapper (문서 쓰기 · History)", () => {
  it("createVariable → 문서 쓰기 1 · owner project · Map name 키", async () => {
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
    expect(testDataCommits).toHaveLength(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect((addEntry.mock.calls[0][0] as { elementId: string }).elementId).toBe(
      created.id,
    );
  });

  it("createVariable(page · component) 는 거부한다 — 페이지 · 요소 변수는 문서의 상태 변수", async () => {
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
        page_id: "pg",
      }),
    ).rejects.toThrow(/상태 변수/);
    expect(testDataCommits).toHaveLength(0);
    expect((state.variables as Map<string, Variable>).size).toBe(0);
  });

  it("updateVariable: 정의 축은 define_variable · validation · transform 은 같은 entry 쓰기 (둘 다 History)", async () => {
    const existing = base({ id: "v1", name: "a", defaultValue: "x" });
    const { set, get, state } = makeStore(new Map([["a", existing]]));
    const update = createUpdateVariableAction(set as never, get as never);

    await update("v1", { name: "b", defaultValue: "y" });
    const variables = () => state.variables as Map<string, Variable>;
    expect(variables().has("a")).toBe(false);
    expect(variables().get("b")).toMatchObject({ id: "v1", defaultValue: "y" });
    expect(addEntry).toHaveBeenCalledTimes(1);

    await update("v1", { validation: { required: true } });
    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(testDataCommits.at(-1)!.variables![0]).toMatchObject({
      id: "v1",
      validation: { required: true },
    });
    expect(variables().get("b")?.validation).toEqual({ required: true });
  });

  it("updateVariable 이름 충돌 → throw · 상태 무변경", async () => {
    const { set, get, state } = makeStore(
      new Map([
        ["a", base({ id: "v1", name: "a" })],
        ["b", base({ id: "v2", name: "b" })],
      ]),
    );
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
    expect(testDataCommits.at(-1)!.variablesDeleted).toEqual(["v1"]);
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
