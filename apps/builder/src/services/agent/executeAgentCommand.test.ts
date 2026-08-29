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
import { AGENT_COMMANDS } from "./agentCommands";
import {
  executeAgentCommand,
  executeAgentCommands,
  listAgentCommands,
  type AgentExecutionContext,
} from "./executeAgentCommand";

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

describe("listAgentCommands — descriptor", () => {
  it("allowlist 40 만, external 0, confirm 필드 노출", () => {
    const list = listAgentCommands();
    expect(list).toHaveLength(40);
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
