/**
 * Anthropic Messages API 어댑터 (ADR-134 Phase 1, D1).
 *
 * OpenAI 계열과 다른 점 3개를 이 파일이 흡수한다:
 * 1. system 은 메시지 배열이 아니라 최상위 `system` 필드다.
 * 2. 도구 결과는 `role: "tool"` 이 아니라 **user 메시지 안의 `tool_result` 블록**이다.
 * 3. 도구 호출 인자는 `input_json_delta` 로 조각나 온다 (OpenAI 의 `arguments` 누적과 같은 역할).
 *
 * Claude 5 계열 (Fable 5.1 · Opus 5 · Sonnet 5) 계약 — 2026-09-03 Fable 5.1 레퍼런스 대조:
 * - thinking 은 adaptive 가 기본이고 Fable 5.x 는 끌 수 없다. `thinking.budget_tokens` 와
 *   `thinking.type: "disabled"` 는 400 → `thinking` 필드를 보내지 않고 강도는
 *   `output_config.effort` 로 조절한다.
 * - 비기본 `temperature` / `top_p` / `top_k` 는 400 → 보내지 않는다.
 * - thinking 블록은 매 턴 **변경 없이** replay 해야 한다 (빈 블록·signature 포함).
 *   스트림에서 블록을 index 순으로 모아 `stop.assistantTurn` 으로 돌려주고,
 *   `providerContent` 가 실린 assistant 메시지는 그 블록을 그대로 쓴다.
 * - `tool_choice` 는 `auto` / `none` 만 (forced `any` / `tool` 은 400).
 * - `stop_reason: "refusal"` + `stop_details.category` 를 그대로 노출한다.
 *
 * 브라우저에서 `api.anthropic.com` 을 직접 부르려면 provider 가 요구하는 opt-in 헤더가
 * 따로 필요하다 — 이 어댑터는 그것을 **스스로 붙이지 않는다**. 키를 브라우저에 두는 문제는
 * Phase 2 (D10 secret isolation) 의 결정이고, 필요한 배포에서는 `config.headers` 로 명시한다.
 */
import {
  parseSSEStream,
  requestStream,
  type LLMAssistantTurn,
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

/**
 * 기본 `max_tokens` — adaptive thinking 이 이 한도 **안에서** 돌아간다. 레퍼런스의
 * 에이전트 루프 예시값 (16000). 호출자가 `maxTokens` 를 주면 그 값이 우선한다.
 */
export const ANTHROPIC_DEFAULT_MAX_TOKENS = 16000;

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string };

/** replay 하는 assistant 턴은 provider 원문 (thinking 블록 포함) 그대로다. */
type WireMessage =
  | { role: "user"; content: ContentBlock[] }
  | { role: "assistant"; content: ContentBlock[] | readonly unknown[] };

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

    // 같은 provider 가 돌려준 원문이 있으면 그대로 — thinking 블록·signature 가 보존된다.
    const replay = message.providerContent;
    if (replay?.providerId === PROVIDER_ID && replay.blocks.length > 0) {
      wire.push({ role: "assistant", content: replay.blocks });
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
    case "refusal":
      return "refusal";
    default:
      return "other";
  }
}

/** 스트림에서 index 별로 조립 중인 content 블록. */
type PendingBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string; signature?: string }
  | { type: "redacted_thinking"; data: string }
  | { type: "tool_use"; id: string; name: string; json: string }
  | { type: "unknown"; raw: unknown };

/** 조립이 끝난 블록을 wire 형식으로 — replay 시 API 에 그대로 실린다. */
function toWireBlock(block: PendingBlock): unknown {
  switch (block.type) {
    case "text":
      return { type: "text", text: block.text };
    case "thinking":
      return {
        type: "thinking",
        thinking: block.thinking,
        ...(block.signature !== undefined
          ? { signature: block.signature }
          : {}),
      };
    case "redacted_thinking":
      return { type: "redacted_thinking", data: block.data };
    case "tool_use":
      return {
        type: "tool_use",
        id: block.id,
        name: block.name,
        input: safeParse(block.json),
      };
    default:
      return block.raw;
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

    // `thinking` · `temperature` 는 보내지 않는다 (파일 상단 계약). `options.temperature`
    // 는 OpenAI 호환 어댑터 전용이다.
    return {
      model: this.config.model,
      max_tokens: options.maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
      stream: true,
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
      ...(options.reasoningEffort
        ? { output_config: { effort: options.reasoningEffort } }
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

    /** content block index → 조립 중인 블록 (thinking · text · tool_use 전부) */
    const blocks = new Map<number, PendingBlock>();
    let stopReason: LLMStopReason = "end";
    let stopDetail: string | undefined;

    for await (const event of parseSSEStream(response)) {
      const type = event.type as string | undefined;

      if (type === "content_block_start") {
        const index = event.index as number;
        const block = event.content_block as
          | {
              type: string;
              id?: string;
              name?: string;
              text?: string;
              thinking?: string;
              signature?: string;
              data?: string;
            }
          | undefined;
        if (!block) continue;
        switch (block.type) {
          case "tool_use":
            blocks.set(index, {
              type: "tool_use",
              id: block.id ?? `call_${index}`,
              name: block.name ?? "",
              json: "",
            });
            break;
          case "text":
            blocks.set(index, { type: "text", text: block.text ?? "" });
            break;
          case "thinking":
            blocks.set(index, {
              type: "thinking",
              thinking: block.thinking ?? "",
              ...(block.signature !== undefined
                ? { signature: block.signature }
                : {}),
            });
            break;
          case "redacted_thinking":
            blocks.set(index, {
              type: "redacted_thinking",
              data: block.data ?? "",
            });
            break;
          default:
            blocks.set(index, { type: "unknown", raw: block });
        }
        continue;
      }

      if (type === "content_block_delta") {
        const index = event.index as number;
        const delta = event.delta as
          | {
              type: string;
              text?: string;
              partial_json?: string;
              thinking?: string;
              signature?: string;
            }
          | undefined;
        if (!delta) continue;
        let block = blocks.get(index);
        // start 없이 delta 부터 오는 경우 (테스트 · 일부 프록시) 는 text 로 연다
        if (!block && delta.type === "text_delta") {
          block = { type: "text", text: "" };
          blocks.set(index, block);
        }
        if (delta.type === "text_delta" && delta.text) {
          if (block?.type === "text") block.text += delta.text;
          yield { type: "text-delta", delta: delta.text };
        } else if (delta.type === "input_json_delta") {
          if (block?.type === "tool_use")
            block.json += delta.partial_json ?? "";
        } else if (delta.type === "thinking_delta") {
          if (block?.type === "thinking")
            block.thinking += delta.thinking ?? "";
        } else if (delta.type === "signature_delta") {
          if (block?.type === "thinking")
            block.signature = delta.signature ?? "";
        }
        continue;
      }

      if (type === "message_delta") {
        const delta = event.delta as
          | { stop_reason?: unknown; stop_details?: { category?: unknown } }
          | undefined;
        if (delta?.stop_reason) stopReason = toStopReason(delta.stop_reason);
        const category = delta?.stop_details?.category;
        if (typeof category === "string") stopDetail = category;
      }
    }

    const ordered = [...blocks.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, block]) => block);

    const calls: LLMToolCall[] = [];
    for (const block of ordered) {
      if (block.type === "tool_use" && block.name) {
        calls.push({ id: block.id, name: block.name, arguments: block.json });
      }
    }
    for (const call of calls) yield { type: "tool-call", call };

    const assistantTurn: LLMAssistantTurn | undefined =
      ordered.length > 0
        ? { providerId: PROVIDER_ID, blocks: ordered.map(toWireBlock) }
        : undefined;

    yield {
      type: "stop",
      reason: calls.length > 0 ? "tool-calls" : stopReason,
      ...(stopDetail !== undefined ? { detail: stopDetail } : {}),
      ...(assistantTurn ? { assistantTurn } : {}),
    };
  }
}
