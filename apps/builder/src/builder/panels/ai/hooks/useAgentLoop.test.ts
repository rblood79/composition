// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrchestratedEvent } from "../../../../services/ai/agents/orchestrator";

const scripted = vi.hoisted(() => ({ events: [] as OrchestratedEvent[] }));

vi.mock("../../../../services/ai/createAgentRunner", () => ({
  createAgentRunner: () => ({
    orchestrated: true,
    // eslint-disable-next-line require-yield
    async *runAgentLoop() {
      for (const event of scripted.events) yield event;
    },
    stop: () => {},
  }),
}));

vi.mock("../../../stores", () => ({
  useStore: {
    getState: () => ({ selectedElementId: null }),
  },
}));

vi.mock("../../../stores/aiVisualFeedback", () => ({
  useAIVisualFeedbackStore: {
    getState: () => ({
      startGenerating: () => {},
      completeGenerating: () => {},
      cancelGenerating: () => {},
      addFlashForNode: () => {},
    }),
  },
}));

import { useConversationStore } from "../../../stores/conversation";
import { useAgentLoop } from "./useAgentLoop";

const context = {
  currentPageId: "page-1",
  elements: [],
  recentChanges: [],
};

beforeEach(() => {
  useConversationStore.setState({
    messages: [],
    isStreaming: false,
    isAgentRunning: false,
    currentTurn: 0,
    activeToolCalls: [],
    currentContext: context,
  });
});

afterEach(() => {
  cleanup();
  scripted.events = [];
});

describe("도구 실행 뒤의 assistant 텍스트", () => {
  it("도구 결과 다음에 온 텍스트도 화면에 남는다", async () => {
    scripted.events = [
      { type: "text-delta", content: "먼저 프레임을 만들게요." },
      {
        type: "tool-result",
        toolCallId: "t1",
        toolName: "create_element",
        result: { success: true, data: { type: "frame" } },
      },
      { type: "text-delta", content: "프레임을 만들었습니다." },
    ] as OrchestratedEvent[];

    const { result } = renderHook(() => useAgentLoop());
    await act(async () => {
      await result.current.runAgent("프레임 만들어줘");
    });

    const assistantText = useConversationStore
      .getState()
      .messages.filter((m) => m.role === "assistant")
      .map((m) => m.content)
      .join("\n");

    expect(assistantText).toContain("먼저 프레임을 만들게요.");
    expect(assistantText).toContain("프레임을 만들었습니다.");
  });
});

describe("진행 표시", () => {
  it("계획·역할·수리가 진행 상태로 모인다", async () => {
    scripted.events = [
      { type: "agent-start", agent: "planner", label: "계획" },
      {
        type: "plan-ready",
        plan: { goal: "목표", steps: [{ index: 1, instruction: "a" }] },
      },
      { type: "agent-end", agent: "planner", ok: true },
      { type: "repair-attempt", attempt: 1, max: 2, issues: ["어긋남"] },
    ] as OrchestratedEvent[];

    const { result } = renderHook(() => useAgentLoop());
    await act(async () => {
      await result.current.runAgent("만들어줘");
    });

    expect(result.current.progress.plan?.goal).toBe("목표");
    expect(result.current.progress.agents[0].agent).toBe("planner");
    expect(result.current.progress.repairs).toHaveLength(1);
  });
});
