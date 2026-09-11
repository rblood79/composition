/**
 * ADR-213 HC1 · R7 — AI/agent 데이터 쓰기의 유일한 진입점.
 *
 * - 승인 host 가 없으면 거부 (문서 무변경)
 * - 거부 → `rejected`, applyDataChange 호출 0
 * - 승인 → executor 가 origin 을 stamp 해 applyDataChange 1회, 세션 provenance 1건
 * - 모델 입력의 origin · 사람 전용 op · restore 는 `invalid`
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const applyDataChange = vi.fn();
vi.mock("../../../builder/stores/data", () => ({
  useDataStore: {
    getState: () => ({ applyDataChange, currentProjectId: "p1" }),
  },
}));

const append = vi.fn((entry: unknown) => ({ seq: 1, ...(entry as object) }));
vi.mock("../../../builder/stores/agentCommandLog", () => ({
  useAgentCommandLogStore: { getState: () => ({ append }) },
}));

vi.mock("../../../builder/stores/history", () => ({
  historyManager: {
    getCurrentPageHistory: () => ({ currentIndex: 7 }),
  },
}));

import {
  hasAgentCommandConfirmationHost,
  resolveAgentCommandConfirmation,
  subscribeAgentCommandConfirmation,
  type AgentCommandConfirmationRequest,
} from "../../agent/agentCommandConfirmation";
import { dispatchDataProposal } from "./dataProposalDispatcher";

const t = (key: string) => key;

describe("dispatchDataProposal", () => {
  let unsubscribe: (() => void) | null = null;
  let lastRequest: AgentCommandConfirmationRequest | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    applyDataChange.mockResolvedValue({
      applied: [],
      inverse: [],
      collectionIds: ["c1"],
    });
    unsubscribe?.();
    unsubscribe = null;
    lastRequest = null;
  });

  function mountHost(decision: boolean) {
    unsubscribe = subscribeAgentCommandConfirmation((request) => {
      // resolve 뒤 null 알림이 오므로 열린 요청만 남긴다
      if (request) {
        lastRequest = request;
        queueMicrotask(() => resolveAgentCommandConfirmation(decision));
      }
    });
  }

  it("승인 host 가 없으면 rejected · 적용 0", async () => {
    expect(hasAgentCommandConfirmationHost()).toBe(false);
    const result = await dispatchDataProposal(
      {
        ops: [{ op: "bind_element", elementId: "e1", collectionId: "c1" }],
        host: "ai-panel",
        origin: "ai",
      },
      t,
    );
    expect(result.status).toBe("rejected");
    expect(applyDataChange).not.toHaveBeenCalled();
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ status: "declined" }),
    );
  });

  it("거부 → rejected · 적용 0 · provenance declined", async () => {
    mountHost(false);
    const result = await dispatchDataProposal(
      {
        ops: [{ op: "bind_element", elementId: "e1", collectionId: "c1" }],
        host: "ai-panel",
        origin: "ai",
      },
      t,
    );
    expect(result.status).toBe("rejected");
    expect(applyDataChange).not.toHaveBeenCalled();
    expect(lastRequest?.id).toBe("data.propose");
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "data.propose",
        status: "declined",
        host: "ai-panel",
      }),
    );
  });

  it("승인 → origin stamp 후 applyDataChange 1회 · historyId · provenance ok", async () => {
    mountHost(true);
    const result = await dispatchDataProposal(
      {
        ops: [
          {
            op: "bind_element",
            elementId: "e1",
            collectionId: "c1",
            fieldMap: { value: "f1" },
          },
        ],
        label: "bind",
        host: "chrome-mcp",
        origin: "agent",
      },
      t,
    );
    expect(result).toMatchObject({ status: "applied", historyId: 7 });
    expect(applyDataChange).toHaveBeenCalledTimes(1);
    expect(applyDataChange.mock.calls[0][0]).toEqual({
      ops: [
        {
          op: "bind_element",
          elementId: "e1",
          collectionId: "c1",
          fieldMap: { value: "f1" },
        },
      ],
      origin: "agent",
      label: "bind",
    });
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "data.propose",
        status: "ok",
        host: "chrome-mcp",
        undoable: true,
        historyIndex: 7,
        args: expect.objectContaining({
          origin: "agent",
          opsCount: 1,
          approved: true,
        }),
      }),
    );
  });

  it("모델 입력에 사람 전용 op · restore · 빈 ops 가 오면 invalid (승인 요청 0)", async () => {
    mountHost(true);
    for (const ops of [
      [{ op: "remove_rows", collectionId: "c1", rowIndexes: [0] }],
      [
        {
          op: "bind_element",
          elementId: "e1",
          collectionId: "c1",
          restore: { props: 1 },
        },
      ],
      [],
    ]) {
      const result = await dispatchDataProposal(
        { ops: ops as never, host: "ai-panel", origin: "ai" },
        t,
      );
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") expect(result.errors.length).toBeGreaterThan(0);
    }
    expect(lastRequest).toBeNull();
    expect(applyDataChange).not.toHaveBeenCalled();
  });

  it("적용기가 throw 하면 error 상태 · provenance error", async () => {
    mountHost(true);
    applyDataChange.mockRejectedValueOnce(
      new Error("요소를 찾을 수 없습니다: e1"),
    );
    const result = await dispatchDataProposal(
      {
        ops: [{ op: "bind_element", elementId: "e1", collectionId: "c1" }],
        host: "ai-panel",
        origin: "ai",
      },
      t,
    );
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") expect(result.errors[0]).toContain("e1");
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error" }),
    );
  });
});
