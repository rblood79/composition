/**
 * ADR-196 Phase 2 — executor 분기 (G2): denied / precondition-failed / declined / ok /
 * error · 배치 원소별 승인 · 기록 1:1 (5 status 전부) · 승인 전 store 변경 0.
 *
 * adapter 는 spy — 게이트가 adapter 를 부르는지 / 안 부르는지만 본다. adapter 자체의
 * 심볼 대조는 `agentCommands.test.ts`, history entry 수는 `agentCommands.history.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../../builder/stores";
import { historyManager } from "../../builder/stores/history";
import { useViewportSyncStore } from "../../builder/workspace/canvas/stores";
import { useAgentCommandLogStore } from "../../builder/stores/agentCommandLog";
import { useDataStore } from "../../builder/stores/data";
import { AGENT_COMMANDS } from "./agentCommands";
import { DATA_AGENT_COMMANDS } from "./dataAgentCommands";
import {
  executeAgentCommand,
  executeAgentCommands,
  listAgentCommands,
  type AgentExecutionContext,
} from "./executeAgentCommand";

vi.mock("./dataAgentCommands", () => ({
  DATA_AGENT_COMMANDS: {
    "data.openTable": vi.fn(async () => ({ ok: true })),
    "data.openEndpoint": vi.fn(async () => ({ ok: true })),
    "data.runEndpoint": vi.fn(async () => ({ ok: true })),
    "data.importPaste": vi.fn(async () => ({ ok: true, historyIndex: 3 })),
  },
}));

vi.mock("./agentCommands", () => ({
  AGENT_COMMANDS: {
    zoomIn: vi.fn(),
    toggleNavigator: vi.fn(),
    undo: vi.fn(async () => undefined),
    alignLeft: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    cut: vi.fn(async () => undefined),
    duplicate: vi.fn(async () => {
      throw new Error("boom");
    }),
  },
}));

const spies = AGENT_COMMANDS as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;

function seed(selected: string[], multi = selected.length > 1) {
  const elementsMap = new Map(
    ["body", "a", "b"].map((id) => [
      id,
      {
        id,
        type: id === "body" ? "body" : "Button",
        props: {},
        parent_id: id === "body" ? null : "body",
        page_id: "page-1",
      },
    ]),
  );
  useStore.setState({
    currentPageId: "page-1",
    selectedElementId: selected[0] ?? null,
    selectedElementIds: selected,
    multiSelectMode: multi,
    elementsMap,
  } as never);
  useViewportSyncStore.setState({
    containerSize: { width: 800, height: 600 },
  } as never);
  historyManager.clearAllHistory();
  historyManager.setCurrentPage("page-1");
}

function ctx(approve = true): AgentExecutionContext & {
  requestConfirm: ReturnType<typeof vi.fn>;
} {
  return {
    host: "chrome-mcp",
    requestConfirm: vi.fn(async () => approve),
  };
}

const log = () => useAgentCommandLogStore.getState().entries;

describe("executeAgentCommand — 게이트 분기", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAgentCommandLogStore.getState().clear();
    seed(["a"]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("denied — 정의에 없는 id", async () => {
    const r = await executeAgentCommand("nope", undefined, ctx());
    expect(r).toMatchObject({ status: "denied", reason: "unknown-command" });
    expect(log()).toHaveLength(1);
    expect(log()[0]).toMatchObject({
      status: "denied",
      id: "nope",
      mutation: "unknown",
    });
  });

  it("denied — external (openProject) 은 reason external, adapter 호출 0", async () => {
    const c = ctx();
    const r = await executeAgentCommand("openProject", undefined, c);
    expect(r).toMatchObject({ status: "denied", reason: "external" });
    expect(c.requestConfirm).not.toHaveBeenCalled();
    expect(log()[0]).toMatchObject({ status: "denied", mutation: "external" });
  });

  it("denied — allowlist 밖 (escape) 은 not-agent-callable", async () => {
    const r = await executeAgentCommand("escape", undefined, ctx());
    expect(r).toMatchObject({ status: "denied", reason: "not-agent-callable" });
  });

  it("precondition-failed — alignLeft 는 multiSelectMode 없이는 adapter 를 부르지 않는다", async () => {
    seed(["a", "b"], false);
    const r = await executeAgentCommand("alignLeft", undefined, ctx());
    expect(r).toMatchObject({
      status: "precondition-failed",
      reason: "multi-select-mode-off",
    });
    expect(spies.alignLeft).not.toHaveBeenCalled();
    expect(log()[0]).toMatchObject({
      status: "precondition-failed",
      undoable: false,
    });
  });

  it("precondition-failed — delete 는 body 만 선택되면 selection-empty", async () => {
    seed(["body"]);
    const r = await executeAgentCommand("delete", undefined, ctx());
    expect(r).toMatchObject({
      status: "precondition-failed",
      reason: "selection-empty",
    });
    expect(spies.delete).not.toHaveBeenCalled();
  });

  it("declined — confirm 거부 시 adapter 호출 0 (승인 전 store 변경 0)", async () => {
    const c = ctx(false);
    const r = await executeAgentCommand("delete", undefined, c);
    expect(r).toMatchObject({ status: "declined", reason: "user-declined" });
    expect(c.requestConfirm).toHaveBeenCalledTimes(1);
    expect(c.requestConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "delete",
        summary: expect.any(String),
        meta: expect.objectContaining({ confirm: true }),
      }),
    );
    expect(spies.delete).not.toHaveBeenCalled();
    expect(log()[0]).toMatchObject({ status: "declined", id: "delete" });
  });

  it("ok — confirm:true 명령은 승인 후 adapter 1회, undoable + historyIndex", async () => {
    const c = ctx(true);
    const r = await executeAgentCommand("delete", undefined, c);
    expect(spies.delete).toHaveBeenCalledTimes(1);
    expect(spies.delete).toHaveBeenCalledWith(
      expect.objectContaining({ elementsMap: useStore.getState().elementsMap }),
    );
    expect(r).toMatchObject({ status: "ok", id: "delete", undoable: true });
    expect(r).toHaveProperty("historyIndex");
    expect(log()[0]).toMatchObject({ status: "ok", undoable: true });
  });

  it("ok — view 명령 (zoomIn) 은 confirm 요청 0, undoable false", async () => {
    const c = ctx();
    const r = await executeAgentCommand("zoomIn", undefined, c);
    expect(c.requestConfirm).not.toHaveBeenCalled();
    expect(spies.zoomIn).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ status: "ok", undoable: false });
    expect(r).not.toHaveProperty("historyIndex");
  });

  it("legacy toggleNodes는 canonical toggleNavigator adapter와 log ID로 정규화한다", async () => {
    const r = await executeAgentCommand("toggleNodes", undefined, ctx());

    expect(spies.toggleNavigator).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({
      status: "ok",
      id: "toggleNavigator",
      undoable: false,
    });
    expect(log()[0]).toMatchObject({ status: "ok", id: "toggleNavigator" });
  });

  it("precondition — undo 는 canUndo 가 false 면 nothing-to-undo", async () => {
    const r = await executeAgentCommand("undo", undefined, ctx());
    expect(r).toMatchObject({
      status: "precondition-failed",
      reason: "nothing-to-undo",
    });
    expect(spies.undo).not.toHaveBeenCalled();
  });

  it("error — adapter 예외는 error 로 기록되고 던지지 않는다", async () => {
    const r = await executeAgentCommand("duplicate", undefined, ctx());
    expect(r).toMatchObject({ status: "error", reason: "boom" });
    expect(log()[0]).toMatchObject({ status: "error", id: "duplicate" });
  });

  it("기록 1:1 — 호출 5건 (5 status) = 기록 5건, seq 단조 증가, host 기록", async () => {
    seed(["a", "b"], false);
    await executeAgentCommand("nope", undefined, ctx()); // denied
    await executeAgentCommand("alignLeft", undefined, ctx()); // precondition-failed
    await executeAgentCommand("delete", undefined, ctx(false)); // declined
    await executeAgentCommand("zoomIn", undefined, ctx()); // ok
    await executeAgentCommand("duplicate", undefined, ctx()); // error
    const statuses = log().map((e) => e.status);
    expect(statuses).toEqual([
      "denied",
      "precondition-failed",
      "declined",
      "ok",
      "error",
    ]);
    const seqs = log().map((e) => e.seq);
    expect([...seqs].sort((x, y) => x - y)).toEqual(seqs);
    expect(log().every((e) => e.host === "chrome-mcp")).toBe(true);
    expect(log().every((e) => typeof e.durationMs === "number")).toBe(true);
  });
});

describe("executeAgentCommands — 배치", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAgentCommandLogStore.getState().clear();
    seed(["a", "b"]);
  });

  it("원소별 승인 — confirm:true 원소마다 requestConfirm 이 따로 온다", async () => {
    const c = ctx(true);
    const results = await executeAgentCommands(
      [{ id: "zoomIn" }, { id: "delete" }, { id: "cut" }],
      c,
    );
    expect(results.map((r) => r.status)).toEqual(["ok", "ok", "ok"]);
    expect(c.requestConfirm).toHaveBeenCalledTimes(2);
    expect(c.requestConfirm.mock.calls.map((call) => call[0].id)).toEqual([
      "delete",
      "cut",
    ]);
  });

  it("첫 non-ok 에서 중단 — 거부된 delete 뒤의 alignLeft 는 실행되지 않는다", async () => {
    const c = ctx(false);
    const results = await executeAgentCommands(
      [{ id: "zoomIn" }, { id: "delete" }, { id: "alignLeft" }],
      c,
    );
    expect(results.map((r) => r.status)).toEqual(["ok", "declined"]);
    expect(spies.alignLeft).not.toHaveBeenCalled();
    expect(log()).toHaveLength(2);
  });
});

const dataSpies = DATA_AGENT_COMMANDS as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;

function seedData(loaded = true) {
  useDataStore.setState({
    isInitialized: loaded,
    currentProjectId: loaded ? "p1" : null,
    collections: new Map([["c1", { id: "c1", name: "Users" }]]),
    apiEndpoints: new Map([
      ["e1", { id: "e1", name: "getUsers", method: "GET" }],
      ["e2", { id: "e2", name: "createUser", method: "POST" }],
    ]),
  } as never);
}

describe("executeAgentCommand — data.* (ADR-213 Phase 5) 같은 게이트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAgentCommandLogStore.getState().clear();
    seed(["a"]);
    seedData();
  });

  it("precondition-failed — 프로젝트 미로드 · 대상 없음은 adapter 호출 0, 기록 1", async () => {
    seedData(false);
    const r = await executeAgentCommand(
      "data.openTable",
      { name: "Users" },
      ctx(),
    );
    expect(r).toMatchObject({
      status: "precondition-failed",
      reason: "no-project",
    });
    seedData();
    const r2 = await executeAgentCommand(
      "data.openTable",
      { name: "Ghost" },
      ctx(),
    );
    expect(r2).toMatchObject({
      status: "precondition-failed",
      reason: "collection-not-found",
    });
    expect(dataSpies["data.openTable"]).not.toHaveBeenCalled();
    expect(log()).toHaveLength(2);
    expect(log()[1]).toMatchObject({
      id: "data.openTable",
      mutation: "view",
      args: { name: "Ghost" },
    });
  });

  it("ok — openTable 은 confirm 0, adapter 가 읽기 모델 · host · t 를 받는다, 기록 1 (executor)", async () => {
    const c = ctx();
    const r = await executeAgentCommand(
      "data.openTable",
      { collectionId: "c1" },
      c,
    );
    expect(c.requestConfirm).not.toHaveBeenCalled();
    expect(dataSpies["data.openTable"]).toHaveBeenCalledWith(
      { collectionId: "c1" },
      expect.objectContaining({
        host: "chrome-mcp",
        t: expect.any(Function),
        read: expect.objectContaining({
          projectLoaded: true,
          collections: [{ id: "c1", name: "Users" }],
        }),
      }),
    );
    expect(r).toMatchObject({
      status: "ok",
      id: "data.openTable",
      undoable: false,
    });
    expect(log()).toHaveLength(1);
    expect(log()[0]).toMatchObject({ status: "ok", id: "data.openTable" });
  });

  it("runEndpoint — GET 은 승인 0, POST 는 승인을 묻고 거부 시 adapter 0", async () => {
    const get = ctx(false);
    const r = await executeAgentCommand(
      "data.runEndpoint",
      { name: "getUsers" },
      get,
    );
    expect(get.requestConfirm).not.toHaveBeenCalled();
    expect(r).toMatchObject({ status: "ok" });

    const post = ctx(false);
    const r2 = await executeAgentCommand(
      "data.runEndpoint",
      { endpointId: "e2" },
      post,
    );
    expect(post.requestConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "data.runEndpoint",
        meta: expect.objectContaining({ mutation: "none", confirm: true }),
        args: { endpointId: "e2" },
      }),
    );
    expect(r2).toMatchObject({ status: "declined", reason: "user-declined" });
    expect(dataSpies["data.runEndpoint"]).toHaveBeenCalledTimes(1);
  });

  it("error — adapter throw (HTTP 실패) 는 error 로 기록, adapter 의 error outcome 도 같은 기록", async () => {
    dataSpies["data.runEndpoint"].mockRejectedValueOnce(new Error("HTTP 401"));
    const r = await executeAgentCommand(
      "data.runEndpoint",
      { name: "getUsers" },
      ctx(),
    );
    expect(r).toMatchObject({ status: "error", reason: "HTTP 401" });
    expect(log()[0]).toMatchObject({ status: "error", id: "data.runEndpoint" });
  });

  it("importPaste — 승인·기록은 dispatcher 몫: executor confirm 0, ok 기록 0, historyIndex 는 adapter 값", async () => {
    const c = ctx(false);
    const r = await executeAgentCommand(
      "data.importPaste",
      { text: "[{\"a\":1}]", name: "T" },
      c,
    );
    expect(c.requestConfirm).not.toHaveBeenCalled();
    expect(r).toMatchObject({
      status: "ok",
      id: "data.importPaste",
      undoable: true,
      historyIndex: 3,
    });
    expect(log()).toHaveLength(0);

    dataSpies["data.importPaste"].mockResolvedValueOnce({
      ok: false,
      status: "declined",
      reason: "user-declined",
    });
    const r2 = await executeAgentCommand(
      "data.importPaste",
      { text: "[{\"a\":1}]", name: "T" },
      c,
    );
    expect(r2).toMatchObject({ status: "declined", reason: "user-declined" });
    expect(log()).toHaveLength(0);
  });

  it("precondition — importPaste 필수 인자 (text · name|collectionId) 는 adapter 전에 막힌다", async () => {
    const r = await executeAgentCommand("data.importPaste", { name: "T" }, ctx());
    expect(r).toMatchObject({
      status: "precondition-failed",
      reason: "text-required",
    });
    const r2 = await executeAgentCommand("data.importPaste", "[]", ctx());
    expect(r2).toMatchObject({ status: "precondition-failed" });
    expect(dataSpies["data.importPaste"]).not.toHaveBeenCalled();
  });

  it("배치 — data.* 와 단축키 명령이 섞여도 원소별 게이트 · 첫 non-ok 중단", async () => {
    const results = await executeAgentCommands(
      [
        { id: "data.openTable", args: { name: "Users" } },
        { id: "zoomIn" },
        { id: "data.openEndpoint", args: { name: "nope" } },
        { id: "data.runEndpoint", args: { name: "getUsers" } },
      ],
      ctx(),
    );
    expect(results.map((r) => r.status)).toEqual([
      "ok",
      "ok",
      "precondition-failed",
    ]);
    expect(dataSpies["data.runEndpoint"]).not.toHaveBeenCalled();
  });
});

describe("listAgentCommands — descriptor", () => {
  it("allowlist 40 + data.* 4, external 0, confirm 필드 노출", () => {
    const list = listAgentCommands();
    expect(list).toHaveLength(44);
    expect(list.slice(40).map((d) => d.id)).toEqual([
      "data.openTable",
      "data.openEndpoint",
      "data.runEndpoint",
      "data.importPaste",
    ]);
    expect(list.find((d) => d.id === "data.importPaste")).toMatchObject({
      confirm: false,
      undo: "history",
      mutation: "document",
      args: { type: "object", required: ["text"] },
    });
    // runEndpoint 는 method 로 판정 — descriptor 는 "물을 수 있음"
    expect(list.find((d) => d.id === "data.runEndpoint")).toMatchObject({
      confirm: true,
      mutation: "none",
    });
    expect(list.some((d) => d.mutation === "external")).toBe(false);
    expect(list.find((d) => d.id === "delete")).toMatchObject({
      confirm: true,
      undo: "history",
      mutation: "document",
    });
    expect(list.some((d) => d.id === "toggleNavigator")).toBe(true);
    expect(list.some((d) => d.id === ("toggleNodes" as never))).toBe(false);
    expect(list.every((d) => d.description.length > 0)).toBe(true);
  });
});
