/**
 * ADR-134 G2 — 대체 provider 경유로 기존 도구가 전수 통과하는가.
 *
 * provider 는 stub 이다 (네트워크 0). 보는 것은 **루프 계약**: 도구 호출이 레지스트리로
 * 정확히 전달되고, 결과가 대화에 다시 실리고, `AgentEvent` 순서가 이전과 같은가.
 * AbortController 경로도 여기서 잠근다 (Phase 2 보존 항목).
 */
import { describe, expect, it, vi } from "vitest";
import { AgentService } from "./AgentService";
import type {
  LLMCompletionOptions,
  LLMMessage,
  LLMProvider,
  LLMStreamEvent,
} from "./providers/LLMProvider";
import type { AgentEvent } from "../../types/integrations/ai.types";
import { localizedStrings } from "@/i18n/translations";
import type { PromptTranslate } from "./promptTranslate";
import type {
  BuilderContext,
  ChatMessage,
} from "../../types/integrations/chat.types";

const TOOL_NAMES = [
  "create_element",
  "update_element",
  "delete_element",
  "get_editor_state",
  "get_selection",
  "search_elements",
  "batch_design",
  "run_command",
] as const;

const execute = vi.hoisted(() =>
  vi.fn(async () => ({ success: true, data: { ok: true } })),
);

vi.mock("./tools", () => ({
  createToolRegistry: () =>
    new Map(
      [
        "create_element",
        "update_element",
        "delete_element",
        "get_editor_state",
        "get_selection",
        "search_elements",
        "batch_design",
        "run_command",
      ].map((name) => [name, { name, execute }]),
    ),
  getToolDefinitions: async () =>
    [
      "create_element",
      "update_element",
      "delete_element",
      "get_editor_state",
      "get_selection",
      "search_elements",
      "batch_design",
      "run_command",
    ].map((name) => ({
      name,
      description: name,
      parameters: { type: "object", properties: {} },
    })),
}));

vi.mock("./systemPrompt", () => ({ buildSystemPrompt: () => "system" }));

/** 첫 턴에 도구 1건, 둘째 턴에 최종 텍스트를 내보내는 stub. */
function stubProvider(toolName: string) {
  const seen: Array<readonly LLMMessage[]> = [];
  let turn = 0;
  const provider: LLMProvider = {
    id: "openai-compatible",
    model: "stub",
    async *completeWithTools(
      messages: readonly LLMMessage[],
      _options?: LLMCompletionOptions,
    ): AsyncGenerator<LLMStreamEvent> {
      seen.push(messages.map((m) => ({ ...m })));
      turn += 1;
      if (turn === 1) {
        yield {
          type: "tool-call",
          call: { id: "c1", name: toolName, arguments: '{"x":1}' },
        };
        yield { type: "stop", reason: "tool-calls" };
        return;
      }
      yield { type: "text-delta", delta: "완료" };
      yield { type: "stop", reason: "end" };
    },
  };
  return { provider, seen };
}

const CONTEXT = {} as BuilderContext;
const USER: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    content: "해줘",
    status: "complete",
    timestamp: 0,
  },
];

async function drain(
  service: AgentService,
  messages: ChatMessage[] = USER,
): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of service.runAgentLoop(messages, CONTEXT)) {
    events.push(event);
  }
  return events;
}

/** ko-KR 카탈로그에 묶은 프롬프트 해소기 (ADR-200 후속). */
const t: PromptTranslate = (key, params) => {
  const message = localizedStrings["ko-KR"][key];
  if (typeof message === "function") return message(params);
  return message ?? key;
};

describe("AgentService — 도구 전수 통과 (G2)", () => {
  it.each(TOOL_NAMES)(
    "%s 가 레지스트리로 전달되고 결과가 대화에 실린다",
    async (name) => {
      execute.mockClear();
      const { provider, seen } = stubProvider(name);

      const events = await drain(new AgentService(provider, t));

      expect(execute).toHaveBeenCalledWith({ x: 1 }, t);
      expect(events).toEqual([
        { type: "tool-use-start", toolName: name, toolCallId: "c1" },
        {
          type: "tool-result",
          toolName: name,
          toolCallId: "c1",
          result: { success: true, data: { ok: true } },
        },
        { type: "text-delta", content: "완료" },
        { type: "final", content: "완료" },
      ]);

      // 둘째 턴 대화에 assistant tool_call + tool 결과가 순서대로 실린다
      const second = seen[1];
      expect(second.at(-2)).toMatchObject({ role: "assistant" });
      expect(second.at(-1)).toMatchObject({
        role: "tool",
        toolCallId: "c1",
      });
    },
  );

  it("system prompt 는 대화 맨 앞에 한 번만 실린다", async () => {
    const { provider, seen } = stubProvider("get_selection");
    await drain(new AgentService(provider, t));

    expect(seen[0][0]).toEqual({ role: "system", content: "system" });
    expect(seen[1].filter((m) => m.role === "system")).toHaveLength(1);
  });

  it("등록되지 않은 도구는 tool-error 로 남고 루프는 계속된다", async () => {
    const { provider } = stubProvider("unknown_tool");
    const events = await drain(new AgentService(provider, t));

    expect(events[1]).toMatchObject({
      type: "tool-error",
      toolName: "unknown_tool",
    });
    expect(events.at(-1)).toEqual({ type: "final", content: "완료" });
  });

  it("stop() 이후에는 aborted 로 끝난다 (AbortController 보존)", async () => {
    const { provider } = stubProvider("get_selection");
    const service = new AgentService(provider, t);

    const events: AgentEvent[] = [];
    for await (const event of service.runAgentLoop(USER, CONTEXT)) {
      events.push(event);
      if (event.type === "tool-use-start") service.stop();
    }

    expect(events.at(-1)).toEqual({ type: "aborted" });
    expect(events.some((e) => e.type === "final")).toBe(false);
  });

  it("provider 오류는 tool-error(llm_provider) 로 노출된다", async () => {
    const provider: LLMProvider = {
      id: "openai-compatible",
      model: "stub",
      // eslint-disable-next-line require-yield
      async *completeWithTools(): AsyncGenerator<LLMStreamEvent> {
        throw new Error("endpoint 없음");
      },
    };

    const events = await drain(new AgentService(provider, t));
    expect(events).toEqual([
      {
        type: "tool-error",
        toolName: "llm_provider",
        toolCallId: "",
        error: "endpoint 없음",
      },
    ]);
  });
});
