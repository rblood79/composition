/**
 * ADR-013 — 연결 대상 캡처 · 실행 직전 검증 · read-back. 요소/페이지/프로젝트 문맥과
 * 바인딩 스냅샷은 elements store · canonical store · data 적용기 consumer 에서 읽는다 (mock).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type El = {
  id: string;
  type: string;
  page_id?: string;
  customId?: string;
  parent_id?: string | null;
  props?: Record<string, unknown>;
};
const state = vi.hoisted(() => ({
  elements: new Map<string, El>(),
  projectId: "p1" as string | null,
  snapshots: new Map<string, { props?: unknown; extension?: unknown }>(),
  // executeQuickConnect 협력자
  applyDataChange: vi.fn(),
  collections: new Map<string, { id: string; name: string }>(),
  addEntry: vi.fn(),
  removeElements: vi.fn(async (ids: string[]) => {
    for (const id of ids) state.elements.delete(id);
  }),
  merged: [] as El[],
  mutationLog: [] as string[],
  // ADR-241 — instance 열 계획이 읽는 활성 canonical 문서
  doc: null as unknown,
}));

vi.mock("../../../stores", () => ({
  useStore: {
    getState: () => ({
      elementsMap: state.elements,
      elements: [...state.elements.values()],
      removeElements: state.removeElements,
    }),
    setState: (
      fn: (prev: { elements: El[]; layoutVersion: number }) => unknown,
    ) => {
      fn({ elements: [...state.elements.values()], layoutVersion: 0 });
    },
  },
}));
vi.mock("../../../stores/data", () => ({
  useDataStore: {
    getState: () => ({
      applyDataChange: state.applyDataChange,
      collections: state.collections,
    }),
  },
}));
vi.mock("../../../stores/canonical/canonicalDocumentStore", () => ({
  useCanonicalDocumentStore: {
    getState: () => ({ currentProjectId: state.projectId }),
  },
}));
vi.mock("../../../stores/utils/dataChange", () => ({
  readDataBindingSnapshot: (id: string) => state.snapshots.get(id) ?? null,
}));
vi.mock("../../../stores/history", () => ({
  historyManager: { addEntry: (e: unknown) => state.addEntry(e) },
}));
vi.mock("../../../stores/history/canonicalHistoryEvents", () => ({
  buildCanonicalInsertEvents: (els: El[]) =>
    els.map((e) => ({ type: "insert", nodeId: e.id })),
  buildCanonicalRemoveEvents: (els: El[]) =>
    els.map((e) => ({ type: "remove", nodeId: e.id })),
  captureCanonicalReplaceSources: (ids: string[]) =>
    new Map(ids.map((id) => [id, { captured: true }])),
  buildCanonicalReplaceEvents: (prev: El[], next: El[]) => {
    state.mutationLog.push("replaceEvents");
    return [
      { type: "remove", nodeId: prev[0]!.id },
      { type: "insert", nodeId: next[0]!.id },
    ];
  },
}));
vi.mock("../../../stores/canonical/canonicalElementsBridge", () => ({
  getActiveCanonicalDocument: () => state.doc,
}));
vi.mock("@/adapters/canonical/canonicalMutationRunner", () => ({
  runCanonicalMutation: (stages: {
    canonical: () => unknown;
    store: () => void;
  }) => {
    stages.canonical();
    stages.store();
  },
}));
vi.mock("@/adapters/canonical/canonicalMutations", () => ({
  mergeElementsCanonicalPrimary: (els: El[]) => {
    state.mutationLog.push(`merge:${els.map((e) => e.type).join(",")}`);
    for (const e of els) state.elements.set(e.id, e);
    state.merged.push(...els);
    return { changed: true };
  },
  updateCanonicalNodeFromElementPrimary: (el: El) => {
    state.mutationLog.push(`updateInstance:${el.id}`);
    state.elements.set(el.id, el);
    return { changed: true };
  },
}));
vi.mock("../../../../utils/element/elementUtils", () => ({
  ElementUtils: {
    generateId: () =>
      `col-${state.merged.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
  },
}));
vi.mock("../../../utils/idGeneration", () => ({
  generateCustomId: (type: string) => `${type.toLowerCase()}_x`,
}));

import { COMPONENT_DESCENDANTS_MIRROR_FIELD } from "@/adapters/canonical/componentSemanticsMirror";
import {
  captureQuickConnectTarget,
  executeQuickConnect,
  planTableColumns,
  precheckQuickConnectTarget,
  readBackQuickConnect,
  resolveColumnMode,
  unmatchedColumnKeys,
} from "./quickConnect";

beforeEach(() => {
  state.elements = new Map<string, El>([
    [
      "lb",
      { id: "lb", type: "ListBox", page_id: "pg1", customId: "ListBox_1" },
    ],
    ["tb", { id: "tb", type: "Table", page_id: "pg1", customId: "Table_1" }],
    ["th", { id: "th", type: "TableHeader", page_id: "pg1", parent_id: "tb" }],
    [
      "tbody",
      { id: "tbody", type: "TableBody", page_id: "pg1", parent_id: "tb" },
    ],
  ]);
  state.projectId = "p1";
  state.snapshots = new Map([
    ["lb", {}],
    ["tb", {}],
  ]);
  state.collections = new Map();
  state.merged = [];
  state.mutationLog = [];
  state.applyDataChange.mockReset();
  state.addEntry.mockReset();
  state.removeElements.mockClear();
  state.applyDataChange.mockImplementation(
    async (change: { ops: { op: string; id?: string; name?: string }[] }) => {
      const create = change.ops.find((o) => o.op === "create_collection")!;
      state.collections.set(create.id!, { id: create.id!, name: create.name! });
      state.mutationLog.push("applyDataChange");
      return {
        applied: change.ops,
        inverse: [
          { op: "bind_element" },
          { op: "delete_collection", collectionId: create.id },
        ],
        collectionIds: [create.id],
        variableIds: [],
        endpointIds: [],
      };
    },
  );
});

const tableTarget = () => captureQuickConnectTarget("tb")!;
const input = {
  name: "People",
  project_id: "p1",
  schema: [
    { key: "name", type: "string" as const },
    { key: "email", type: "email" as const },
  ],
  mockData: [],
  useMockData: true,
};

describe("executeQuickConnect — Table 컬럼 (ADR-013 Phase 2)", () => {
  it("직접 Table + Column 0 → schema 컬럼을 **먼저** 삽입한 뒤 applyDataChange (record:false · expectBindings) → data entry 1 에 canonicalEvents 동반", async () => {
    const created = await executeQuickConnect({
      input,
      target: tableTarget(),
      projectId: "p1",
    });
    expect(created.name).toBe("People");
    expect(state.mutationLog).toEqual([
      "merge:Column,Column",
      "applyDataChange",
    ]);
    const cols = [...state.elements.values()].filter(
      (e) => e.type === "Column",
    );
    expect(
      cols.map((c) => [c.parent_id, c.props?.key, c.props?.children]),
    ).toEqual([
      ["th", "name", "name"],
      ["th", "email", "email"],
    ]);
    const [, options] = state.applyDataChange.mock.calls[0];
    expect(options).toMatchObject({
      record: false,
      projectId: "p1",
      expectBindings: { tb: { props: undefined, extension: undefined } },
    });
    expect(state.addEntry).toHaveBeenCalledTimes(1);
    const entry = state.addEntry.mock.calls[0][0] as {
      type: string;
      elementIds: string[];
      data: { dataChangeEvent: unknown; canonicalEvents: { type: string }[] };
    };
    expect(entry.type).toBe("data");
    expect(entry.data.canonicalEvents.map((e) => e.type)).toEqual([
      "insert",
      "insert",
    ]);
    expect(entry.elementIds).toEqual(
      expect.arrayContaining(["tb", created.id, ...cols.map((c) => c.id)]),
    );
  });

  it("applyDataChange 가 실패하면 삽입한 컬럼을 되돌리고 History 0 (실패를 성공으로 알리지 않는다)", async () => {
    state.applyDataChange.mockRejectedValueOnce(new Error("binding changed"));
    await expect(
      executeQuickConnect({ input, target: tableTarget(), projectId: "p1" }),
    ).rejects.toThrow("binding changed");
    expect(state.removeElements).toHaveBeenCalledTimes(1);
    expect(
      [...state.elements.values()].filter((e) => e.type === "Column"),
    ).toHaveLength(0);
    expect(state.addEntry).not.toHaveBeenCalled();
  });

  it("기존 컬럼 있음 → 기본 보존 (컬럼 mutation 0 · canonicalEvents 없음) · replace 는 remove+insert · unmatched 표시", async () => {
    state.elements.set("c-old", {
      id: "c-old",
      type: "Column",
      parent_id: "th",
      page_id: "pg1",
      props: { key: "legacy", label: "Legacy" },
    });
    state.elements.set("c-name", {
      id: "c-name",
      type: "Column",
      parent_id: "th",
      page_id: "pg1",
      props: { key: "name" },
    });
    const plan = planTableColumns(tableTarget())!;
    expect(plan.existing.map((c) => c.key)).toEqual(["legacy", "name"]);
    expect(unmatchedColumnKeys(plan, input.schema)).toEqual(["legacy"]);
    expect(resolveColumnMode(plan, false)).toBe("preserve");
    expect(resolveColumnMode(plan, true)).toBe("replace");

    await executeQuickConnect({
      input,
      target: tableTarget(),
      projectId: "p1",
    });
    expect(state.mutationLog).toEqual(["applyDataChange"]);
    expect(
      (
        state.addEntry.mock.calls[0][0] as {
          data: { canonicalEvents?: unknown };
        }
      ).data.canonicalEvents,
    ).toBeUndefined();

    state.mutationLog = [];
    state.addEntry.mockReset();
    await executeQuickConnect({
      input,
      target: tableTarget(),
      projectId: "p1",
      replaceColumns: true,
    });
    expect(state.removeElements).toHaveBeenCalledWith(["c-old", "c-name"], {
      skipHistory: true,
    });
    expect(state.mutationLog).toEqual([
      "merge:Column,Column",
      "applyDataChange",
    ]);
    const events = (
      state.addEntry.mock.calls[0][0] as {
        data: { canonicalEvents: { type: string }[] };
      }
    ).data.canonicalEvents;
    expect(events.map((e) => e.type)).toEqual([
      "remove",
      "remove",
      "insert",
      "insert",
    ]);
  });

  it("문서에 없는 ref · TableHeader 없는 노드는 컬럼 계획 없음 (바인딩만)", () => {
    state.elements.set("ref", {
      id: "ref",
      type: "ref",
      page_id: "pg1",
      customId: "table_2",
    });
    state.snapshots.set("ref", {});
    expect(planTableColumns(captureQuickConnectTarget("ref")!)).toBeNull();
    expect(planTableColumns(captureQuickConnectTarget("lb")!)).toBeNull();
    state.elements.delete("th");
    expect(planTableColumns(tableTarget())).toBeNull();
  });
});

describe("quickConnect — ref instance Table 의 자기 열 (ADR-241 Phase 2 · 진단 (b))", () => {
  const INSTANCE_DESCENDANTS = COMPONENT_DESCENDANTS_MIRROR_FIELD;
  function instanceDoc() {
    return {
      version: "composition-1.0",
      children: [
        {
          id: "page-components-body",
          type: "body",
          props: {},
          children: [
            {
              id: "component-table",
              type: "Table",
              reusable: true,
              props: {},
              children: [
                {
                  id: "component-table__1",
                  type: "TableHeader",
                  props: {},
                  slot: ["component-table-column"],
                },
                { id: "component-table__2", type: "TableBody", props: {} },
              ],
            },
            {
              id: "component-table-column",
              type: "Column",
              reusable: true,
              props: { children: "Column" },
            },
          ],
        },
        {
          id: "body-1",
          type: "body",
          props: {},
          children: [
            { id: "ti", type: "ref", ref: "component-table", props: {} },
          ],
        },
      ],
    };
  }
  beforeEach(() => {
    state.doc = instanceDoc();
    state.elements.set("ti", {
      id: "ti",
      type: "ref",
      page_id: "pg1",
      customId: "table_2",
    });
    state.snapshots.set("ti", {});
  });

  it("팔레트 Table instance → 열 계획 (host = instance 안 TableHeader · 기존 0 → create)", () => {
    const plan = planTableColumns(captureQuickConnectTarget("ti")!);
    expect(plan).toMatchObject({
      tableId: "ti",
      tableHeaderId: "ti/component-table__1",
      existing: [],
      instance: true,
    });
    expect(resolveColumnMode(plan, false)).toBe("create");
  });

  it("실행: 바인딩보다 먼저 instance 자기 열 (mode C · schema key) · History entry 1 (data + replace event)", async () => {
    await executeQuickConnect({
      input,
      target: captureQuickConnectTarget("ti")!,
      projectId: "p1",
    });
    // replace event 는 바인딩 **뒤** (post-mutation) — 열 쓰기 직후 스냅샷이면 redo 가 바인딩을 지운다 (live 실측).
    expect(state.mutationLog).toEqual([
      "updateInstance:ti",
      "applyDataChange",
      "replaceEvents",
    ]);
    const written = state.elements.get("ti") as unknown as Record<
      string,
      Record<string, { children: { ref: string; props: Record<string, unknown> }[] }>
    >;
    const columns = written[INSTANCE_DESCENDANTS]!["component-table__1"]!.children;
    expect(columns.map((c) => [c.ref, c.props.key, c.props.children])).toEqual([
      ["component-table-column", "name", "name"],
      ["component-table-column", "email", "email"],
    ]);
    expect(state.addEntry).toHaveBeenCalledTimes(1);
    const entry = state.addEntry.mock.calls[0][0] as {
      type: string;
      data: { dataChangeEvent: unknown; canonicalEvents: { type: string }[] };
    };
    expect(entry.type).toBe("data");
    expect(entry.data.dataChangeEvent).toBeDefined();
    expect(entry.data.canonicalEvents.map((e) => e.type)).toEqual([
      "remove",
      "insert",
    ]);
  });

  it("applyDataChange 실패 → instance 원복 · History 0", async () => {
    state.applyDataChange.mockRejectedValueOnce(new Error("binding changed"));
    await expect(
      executeQuickConnect({
        input,
        target: captureQuickConnectTarget("ti")!,
        projectId: "p1",
      }),
    ).rejects.toThrow("binding changed");
    expect(state.mutationLog).toEqual(["updateInstance:ti", "updateInstance:ti"]);
    expect(
      (state.elements.get("ti") as unknown as Record<string, unknown>)[
        INSTANCE_DESCENDANTS
      ],
    ).toBeUndefined();
    expect(state.addEntry).not.toHaveBeenCalled();
  });
});

describe("quickConnect (ADR-013)", () => {
  it("캡처: 식별자 + 표시 이름 (customId) + 바인딩 스냅샷 — 요소 객체는 담지 않는다", () => {
    const t = captureQuickConnectTarget("lb")!;
    expect(t).toEqual({
      elementId: "lb",
      pageId: "pg1",
      elementType: "ListBox",
      elementLabel: "ListBox_1",
      binding: { props: undefined, extension: undefined },
    });
    expect(captureQuickConnectTarget("ghost")).toBeNull();
  });

  it("precheck: 삭제 → missing · 다른 페이지/프로젝트 → context · 바인딩 변경 → binding-changed", () => {
    const t = captureQuickConnectTarget("lb")!;
    expect(precheckQuickConnectTarget(t, "p1")).toEqual({ ok: true });

    state.snapshots.set("lb", {
      props: { source: "dataTable", collectionId: "c9", name: "X" },
    });
    expect(precheckQuickConnectTarget(t, "p1")).toEqual({
      ok: false,
      reason: "binding-changed",
    });
    state.snapshots.set("lb", {});

    state.projectId = "p2";
    expect(precheckQuickConnectTarget(t, "p1")).toEqual({
      ok: false,
      reason: "context",
    });
    state.projectId = "p1";

    state.elements.set("lb", { id: "lb", type: "ListBox", page_id: "pg2" });
    expect(precheckQuickConnectTarget(t, "p1")).toEqual({
      ok: false,
      reason: "context",
    });

    state.elements.delete("lb");
    expect(precheckQuickConnectTarget(t, "p1")).toEqual({
      ok: false,
      reason: "missing",
    });
  });

  it("read-back: props.collectionId 가 새 collection 이고 extension 이 비어야 true", () => {
    state.snapshots.set("lb", {
      props: { source: "dataTable", collectionId: "c_new", name: "N" },
    });
    expect(readBackQuickConnect("lb", "c_new")).toBe(true);
    expect(readBackQuickConnect("lb", "c_other")).toBe(false);
    state.snapshots.set("lb", {
      props: { source: "dataTable", collectionId: "c_new", name: "N" },
      extension: { type: "collection" },
    });
    expect(readBackQuickConnect("lb", "c_new")).toBe(false);
    expect(readBackQuickConnect("ghost", "c_new")).toBe(false);
  });
});
