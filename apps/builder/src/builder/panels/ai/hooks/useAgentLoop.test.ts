// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrchestratedEvent } from "../../../../services/ai/agents/orchestrator";

const scripted = vi.hoisted(() => ({
  events: [] as OrchestratedEvent[],
  lastContext: null as unknown,
  /** 프로파일이 구성됐는가 — `createAgentRunner` 가 호출 시점에 읽는다. */
  configured: true,
  runnerCreations: 0,
}));

vi.mock("../../../../services/ai/createAgentRunner", () => ({
  createAgentRunner: () => {
    scripted.runnerCreations += 1;
    if (!scripted.configured) return null;
    return {
      orchestrated: true,
      // eslint-disable-next-line require-yield
      async *runAgentLoop(_messages: unknown, context: unknown) {
        scripted.lastContext = context;
        for (const event of scripted.events) yield event;
      },
      stop: () => {},
    };
  },
}));

vi.mock("../../../../services/ai/providers/agentProfiles", () => ({
  isAgentProfileReady: () => scripted.configured,
}));

vi.mock("../../../stores", () => ({
  useStore: {
    getState: () => ({ selectedElementId: null }),
  },
}));

vi.mock("../../../../services/ai/builderContext", () => ({
  buildBuilderContext: () => ({
    currentPageId: "page-77",
    selectedElementId: "b1",
    elements: [{ id: "b1", type: "Button" }],
    selectedElement: {
      id: "b1",
      type: "Button",
      props: { children: "확인" },
      parent_id: null,
    },
  }),
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
import { createElement } from "react";
import { I18nProvider } from "@/i18n";

beforeEach(() => {
  useConversationStore.setState({
    messages: [],
    isStreaming: false,
    isAgentRunning: false,
    currentTurn: 0,
    activeToolCalls: [],
  });
});

afterEach(() => {
  cleanup();
  scripted.events = [];
  scripted.lastContext = null;
  scripted.configured = true;
  scripted.runnerCreations = 0;
});

/** 훅이 `useI18n` 을 쓰므로 provider 밑에서 돌린다 (ADR-200 R7). */
const wrapper = ({ children }: { children: React.ReactNode }) =>
  createElement(I18nProvider, null, children);

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

    const { result } = renderHook(() => useAgentLoop(), { wrapper });
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
      { type: "agent-start", agent: "planner", labelKey: "ai.rolePlanner" },
      {
        type: "plan-ready",
        plan: { goal: "목표", steps: [{ index: 1, instruction: "a" }] },
      },
      { type: "agent-end", agent: "planner", ok: true },
      { type: "repair-attempt", attempt: 1, max: 2, issues: ["어긋남"] },
    ] as OrchestratedEvent[];

    const { result } = renderHook(() => useAgentLoop(), { wrapper });
    await act(async () => {
      await result.current.runAgent("만들어줘");
    });

    expect(result.current.progress.plan?.goal).toBe("목표");
    expect(result.current.progress.agents[0].agent).toBe("planner");
    expect(result.current.progress.repairs).toHaveLength(1);
  });
});

describe("컨텍스트 조립 시점", () => {
  /**
   * 이전에는 AIPanel 의 effect 가 conversation store 에 컨텍스트를 넣어 두고 `runAgent`
   * 가 그것을 읽었다. 패널이 mount 된 채 감춰지면 (`<Activity mode="hidden">`) effect 가
   * 멈춰 컨텍스트가 null 로 남고, 제출이 사용자 메시지조차 없이 조용히 무시됐다.
   * 이제 턴 시점에 스토어에서 만든다 — 준비 안 됨 상태가 존재하지 않는다.
   */
  it("패널 effect 가 돌지 않아도 스토어에서 만들어 실행한다", async () => {
    scripted.events = [];

    const { result } = renderHook(() => useAgentLoop(), { wrapper });
    await act(async () => {
      await result.current.runAgent("만들어줘");
    });

    const userMessages = useConversationStore
      .getState()
      .messages.filter((m) => m.role === "user");
    expect(userMessages).toHaveLength(1);

    const context = scripted.lastContext as {
      currentPageId: string;
      elements: Array<{ id: string; type: string }>;
      selectedElement?: { props: Record<string, unknown> };
    };
    expect(context.currentPageId).toBe("page-77");
    expect(context.elements).toEqual([{ id: "b1", type: "Button" }]);
    expect(context.selectedElement?.props).toEqual({ children: "확인" });
  });
});

describe("실행기 생성 시점", () => {
  /**
   * 실행기를 mount 때 한 번 memo 하면, 설정 패널에서 프로파일을 채운 뒤에도 null 실행기가
   * 남아 새로고침 전까지 "이해하지 못했습니다" fallback 만 나왔다 (2026-09-03 live 실측 —
   * LLM 호출 0). 실행기는 턴 시작 시점에 만든다 — 프로파일·키도 그때 조회한다 (D10).
   */
  it("프로파일을 나중에 채워도 새로고침 없이 다음 턴부터 실행기를 쓴다", async () => {
    scripted.configured = false;
    scripted.events = [
      { type: "text-delta", content: "실행기 응답" },
    ] as OrchestratedEvent[];

    const { result, rerender } = renderHook(() => useAgentLoop(), { wrapper });
    expect(result.current.hasAgent).toBe(false);

    await act(async () => {
      await result.current.runAgent("첫 요청");
    });
    const beforeConfig = useConversationStore
      .getState()
      .messages.filter((m) => m.role === "assistant")
      .map((m) => m.content);
    expect(beforeConfig.join("\n")).not.toContain("실행기 응답");

    // 설정 패널이 프로파일을 채우고 돌아온다 — 훅은 다시 렌더될 뿐 remount 되지 않는다
    scripted.configured = true;
    rerender();
    expect(result.current.hasAgent).toBe(true);

    await act(async () => {
      await result.current.runAgent("둘째 요청");
    });
    const afterConfig = useConversationStore
      .getState()
      .messages.filter((m) => m.role === "assistant")
      .map((m) => m.content);
    expect(afterConfig.join("\n")).toContain("실행기 응답");
    expect(scripted.runnerCreations).toBeGreaterThanOrEqual(2);
  });
});
