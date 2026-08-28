/**
 * OpenAI Chat Completions 호환 어댑터 (ADR-134 Phase 1, D1).
 *
 * **전용 어댑터를 만들지 않는다** — Ollama · vLLM · LM Studio · 사내 gateway · OpenAI 는
 * 전부 이 어댑터 + `baseUrl` 로 포섭한다 (breakdown §3). 폐쇄망/로컬 endpoint 직결이
 * 1차 축이므로 (2026-08-28 사용자 결정) `apiKey` 는 선택이다.
 *
 * function calling 포맷은 기존 Groq 경로와 동일한 wire 형태라, 도구 7종 + `run_command`
 * 의 JSON Schema 가 변환 없이 그대로 실린다.
 */
import {
  LLM_DEFAULTS,
  parseSSEStream,
  requestStream,
  type LLMCompletionOptions,
  type LLMMessage,
  type LLMProvider,
  type LLMProviderConfig,
  type LLMStopReason,
  type LLMStreamEvent,
  type LLMToolCall,
} from "./LLMProvider";

const PROVIDER_ID = "openai-compatible" as const;

type WireMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

/** 중립 메시지 → Chat Completions 메시지. */
export function toOpenAIMessages(
  messages: readonly LLMMessage[],
): WireMessage[] {
  return messages.map((message): WireMessage => {
    if (message.role === "tool") {
      return {
        role: "tool",
        content: message.content,
        tool_call_id: message.toolCallId,
      };
    }
    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: message.content,
        ...(message.toolCalls?.length
          ? {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: "function" as const,
                function: { name: call.name, arguments: call.arguments },
              })),
            }
          : {}),
      };
    }
    return { role: message.role, content: message.content };
  });
}

/** 중립 도구 정의 → `tools[]` (function calling). */
export function toOpenAITools(options: LLMCompletionOptions) {
  if (!options.tools?.length) return undefined;
  return options.tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

function toStopReason(finishReason: unknown): LLMStopReason {
  switch (finishReason) {
    case "stop":
      return "end";
    case "tool_calls":
    case "function_call":
      return "tool-calls";
    case "length":
      return "max-tokens";
    default:
      return "other";
  }
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly id = PROVIDER_ID;

  constructor(private readonly config: LLMProviderConfig) {}

  get model(): string {
    return this.config.model;
  }

  /** 요청 본문 — 테스트와 프록시(Phase 2)가 같은 형태를 재사용한다. */
  buildRequestBody(
    messages: readonly LLMMessage[],
    options: LLMCompletionOptions = {},
  ): Record<string, unknown> {
    const tools = toOpenAITools(options);
    return {
      model: this.config.model,
      messages: toOpenAIMessages(messages),
      stream: true,
      temperature: options.temperature ?? LLM_DEFAULTS.temperature,
      max_tokens: options.maxTokens ?? LLM_DEFAULTS.maxTokens,
      ...(tools ? { tools, tool_choice: options.toolChoice ?? "auto" } : {}),
      ...(options.reasoningEffort
        ? { reasoning_effort: options.reasoningEffort }
        : {}),
    };
  }

  async *completeWithTools(
    messages: readonly LLMMessage[],
    options: LLMCompletionOptions = {},
  ): AsyncGenerator<LLMStreamEvent> {
    const headers: Record<string, string> = { ...this.config.headers };
    if (this.config.apiKey) {
      headers.authorization = `Bearer ${this.config.apiKey}`;
    }

    const response = await requestStream(
      this.config,
      PROVIDER_ID,
      `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`,
      headers,
      this.buildRequestBody(messages, options),
      options.signal,
    );

    const pending: LLMToolCall[] = [];
    let stopReason: LLMStopReason = "end";

    for await (const chunk of parseSSEStream(response)) {
      const choice = (
        chunk.choices as
          | Array<{
              delta?: {
                content?: string;
                tool_calls?: Array<{
                  index?: number;
                  id?: string;
                  function?: { name?: string; arguments?: string };
                }>;
              };
              finish_reason?: string | null;
            }>
          | undefined
      )?.[0];
      if (!choice) continue;

      if (choice.delta?.content) {
        yield { type: "text-delta", delta: choice.delta.content };
      }

      for (const call of choice.delta?.tool_calls ?? []) {
        const index = call.index ?? 0;
        pending[index] ??= {
          id: call.id ?? `call_${index}`,
          name: "",
          arguments: "",
        };
        if (call.id) pending[index].id = call.id;
        if (call.function?.name) pending[index].name = call.function.name;
        if (call.function?.arguments) {
          pending[index].arguments += call.function.arguments;
        }
      }

      if (choice.finish_reason) {
        stopReason = toStopReason(choice.finish_reason);
      }
    }

    for (const call of pending) {
      if (call?.name) yield { type: "tool-call", call };
    }
    yield {
      type: "stop",
      reason: pending.some((call) => call?.name) ? "tool-calls" : stopReason,
    };
  }
}
