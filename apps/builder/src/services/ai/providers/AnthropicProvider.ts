/**
 * Anthropic Messages API 어댑터 (ADR-134 Phase 1, D1).
 *
 * OpenAI 계열과 다른 점 3개를 이 파일이 흡수한다:
 * 1. system 은 메시지 배열이 아니라 최상위 `system` 필드다.
 * 2. 도구 결과는 `role: "tool"` 이 아니라 **user 메시지 안의 `tool_result` 블록**이다.
 * 3. 도구 호출 인자는 `input_json_delta` 로 조각나 온다 (OpenAI 의 `arguments` 누적과 같은 역할).
 *
 * 브라우저에서 `api.anthropic.com` 을 직접 부르려면 provider 가 요구하는 opt-in 헤더가
 * 따로 필요하다 — 이 어댑터는 그것을 **스스로 붙이지 않는다**. 키를 브라우저에 두는 문제는
 * Phase 2 (D10 secret isolation) 의 결정이고, 필요한 배포에서는 `config.headers` 로 명시한다.
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

const PROVIDER_ID = "anthropic" as const;
const ANTHROPIC_VERSION = "2023-06-01";

/** reasoning effort → thinking budget (maxTokens 보다 작아야 한다). */
const THINKING_BUDGET: Record<string, number> = {
  low: 1024,
  medium: 4096,
  high: 8192,
};

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string };

type WireMessage = { role: "user" | "assistant"; content: ContentBlock[] };

/**
 * 중립 메시지 → Messages API `{ system, messages }`.
 *
 * 연속한 `tool` 메시지는 하나의 user 메시지 안에 여러 `tool_result` 블록으로 합친다
 * (Messages API 가 요구하는 형태).
 */
export function toAnthropicMessages(messages: readonly LLMMessage[]): {
  system?: string;
  messages: WireMessage[];
} {
  const systemParts: string[] = [];
  const wire: WireMessage[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      systemParts.push(message.content);
      continue;
    }

    if (message.role === "tool") {
      const block: ContentBlock = {
        type: "tool_result",
        tool_use_id: message.toolCallId,
        content: message.content,
      };
      const last = wire.at(-1);
      if (
        last?.role === "user" &&
        last.content.every((c) => c.type === "tool_result")
      ) {
        last.content.push(block);
      } else {
        wire.push({ role: "user", content: [block] });
      }
      continue;
    }

    if (message.role === "user") {
      wire.push({
        role: "user",
        content: [{ type: "text", text: message.content }],
      });
      continue;
    }

    const content: ContentBlock[] = [];
    if (message.content) content.push({ type: "text", text: message.content });
    for (const call of message.toolCalls ?? []) {
      content.push({
        type: "tool_use",
        id: call.id,
        name: call.name,
        input: safeParse(call.arguments),
      });
    }
    if (content.length > 0) wire.push({ role: "assistant", content });
  }

  return {
    ...(systemParts.length > 0 ? { system: systemParts.join("\n\n") } : {}),
    messages: wire,
  };
}

function safeParse(json: string): unknown {
  try {
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

/** 중립 도구 정의 → `tools[]` (`input_schema` 로 이름만 다르다). */
export function toAnthropicTools(options: LLMCompletionOptions) {
  if (!options.tools?.length) return undefined;
  return options.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}

function toStopReason(raw: unknown): LLMStopReason {
  switch (raw) {
    case "end_turn":
    case "stop_sequence":
      return "end";
    case "tool_use":
      return "tool-calls";
    case "max_tokens":
      return "max-tokens";
    default:
      return "other";
  }
}

export class AnthropicProvider implements LLMProvider {
  readonly id = PROVIDER_ID;

  constructor(private readonly config: LLMProviderConfig) {}

  get model(): string {
    return this.config.model;
  }

  buildRequestBody(
    messages: readonly LLMMessage[],
    options: LLMCompletionOptions = {},
  ): Record<string, unknown> {
    const { system, messages: wire } = toAnthropicMessages(messages);
    const tools = toAnthropicTools(options);
    const maxTokens = options.maxTokens ?? LLM_DEFAULTS.maxTokens;
    const budget = options.reasoningEffort
      ? THINKING_BUDGET[options.reasoningEffort]
      : undefined;

    return {
      model: this.config.model,
      max_tokens: maxTokens,
      stream: true,
      temperature: options.temperature ?? LLM_DEFAULTS.temperature,
      ...(system ? { system } : {}),
      messages: wire,
      ...(tools
        ? {
            tools,
            tool_choice: {
              type: options.toolChoice === "none" ? "none" : "auto",
            },
          }
        : {}),
      ...(budget && budget < maxTokens
        ? { thinking: { type: "enabled", budget_tokens: budget } }
        : {}),
    };
  }

  async *completeWithTools(
    messages: readonly LLMMessage[],
    options: LLMCompletionOptions = {},
  ): AsyncGenerator<LLMStreamEvent> {
    const headers: Record<string, string> = {
      "anthropic-version": ANTHROPIC_VERSION,
      ...this.config.headers,
    };
    if (this.config.apiKey) headers["x-api-key"] = this.config.apiKey;

    const response = await requestStream(
      this.config,
      PROVIDER_ID,
      `${this.config.baseUrl.replace(/\/$/, "")}/v1/messages`,
      headers,
      this.buildRequestBody(messages, options),
      options.signal,
    );

    /** content block index → 조립 중인 도구 호출 */
    const pending = new Map<number, LLMToolCall>();
    let stopReason: LLMStopReason = "end";

    for await (const event of parseSSEStream(response)) {
      const type = event.type as string | undefined;

      if (type === "content_block_start") {
        const index = event.index as number;
        const block = event.content_block as
          { type: string; id?: string; name?: string } | undefined;
        if (block?.type === "tool_use") {
          pending.set(index, {
            id: block.id ?? `call_${index}`,
            name: block.name ?? "",
            arguments: "",
          });
        }
        continue;
      }

      if (type === "content_block_delta") {
        const index = event.index as number;
        const delta = event.delta as
          { type: string; text?: string; partial_json?: string } | undefined;
        if (delta?.type === "text_delta" && delta.text) {
          yield { type: "text-delta", delta: delta.text };
        } else if (delta?.type === "input_json_delta") {
          const call = pending.get(index);
          if (call) call.arguments += delta.partial_json ?? "";
        }
        continue;
      }

      if (type === "message_delta") {
        const delta = event.delta as { stop_reason?: unknown } | undefined;
        if (delta?.stop_reason) stopReason = toStopReason(delta.stop_reason);
      }
    }

    for (const call of pending.values()) {
      if (call.name) yield { type: "tool-call", call };
    }
    yield {
      type: "stop",
      reason: pending.size > 0 ? "tool-calls" : stopReason,
    };
  }
}
