/**
 * Agent Service — Tool Calling + Agent Loop (ADR-134 Phase 2).
 *
 * `GroqAgentService` 의 후신이다. 루프 자체 (최대 턴 · 도구 실행 · 429 백오프 ·
 * AbortController) 는 그대로 두고, **모델 호출만 `LLMProvider` 뒤로 옮겼다** — 어느
 * provider 인지, 로컬인지 원격인지 이 파일은 모른다.
 *
 * 사라진 것: `groq-sdk` · `dangerouslyAllowBrowser` · 하드코딩된 모델 id ·
 * `VITE_GROQ_API_KEY`. 모델과 endpoint 는 에이전트 프로파일이 정하고 (D1/D8), 키는
 * `byokKeyStore` 가 호출 시점에만 넘긴다 (D10).
 */
import type {
  AgentEvent,
  ToolCall,
  ToolExecutor,
} from "../../types/integrations/ai.types";
import type {
  ChatMessage,
  BuilderContext,
} from "../../types/integrations/chat.types";
import { createToolRegistry, getToolDefinitions } from "./tools";
import { buildSystemPrompt } from "./systemPrompt";
import {
  isRateLimitError,
  type LLMMessage,
  type LLMProvider,
} from "./providers/LLMProvider";
import { resolveProvider } from "./providers/agentProfiles";

const MAX_TURNS = 10;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

export class AgentService {
  private toolExecutors: Map<string, ToolExecutor>;
  private abortController: AbortController | null = null;

  constructor(private readonly provider: LLMProvider) {
    this.toolExecutors = createToolRegistry();
  }

  /** Agent Loop 실행 (AsyncGenerator 패턴 — 기존 계약 그대로). */
  async *runAgentLoop(
    messages: ChatMessage[],
    context: BuilderContext,
  ): AsyncGenerator<AgentEvent> {
    this.abortController = new AbortController();

    // 카탈로그 Tier 2 선택 (ADR-134 Phase 5) 은 이번 턴 요청문을 근거로 삼는다.
    const latestRequest = [...messages]
      .reverse()
      .find((m) => m.role === "user")?.content;

    const conversation: LLMMessage[] = [
      { role: "system", content: buildSystemPrompt(context, latestRequest) },
      ...this.convertMessages(messages),
    ];

    const tools = await getToolDefinitions();
    let turn = 0;

    while (turn < MAX_TURNS) {
      if (this.abortController.signal.aborted) {
        yield { type: "aborted" };
        return;
      }

      turn++;

      try {
        let assistantContent = "";
        const toolCalls: ToolCall[] = [];

        for await (const event of this.streamWithRetry(conversation, tools)) {
          if (this.abortController.signal.aborted) {
            yield { type: "aborted" };
            return;
          }

          if (event.type === "text-delta") {
            assistantContent += event.delta;
            yield { type: "text-delta", content: event.delta };
          } else if (event.type === "tool-call") {
            toolCalls.push({
              id: event.call.id,
              name: event.call.name,
              arguments: event.call.arguments,
            });
          }
        }

        // Tool calls 없으면 → 최종 응답
        if (toolCalls.length === 0) {
          yield { type: "final", content: assistantContent };
          return;
        }

        conversation.push({
          role: "assistant",
          content: assistantContent || null,
          toolCalls: toolCalls.map((tc) => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          })),
        });

        for (const tc of toolCalls) {
          if (this.abortController.signal.aborted) {
            yield { type: "aborted" };
            return;
          }

          yield {
            type: "tool-use-start",
            toolName: tc.name,
            toolCallId: tc.id,
          };

          try {
            const args = JSON.parse(tc.arguments || "{}");
            const executor = this.toolExecutors.get(tc.name);

            if (!executor) {
              const errorMsg = `알 수 없는 도구: ${tc.name}`;
              yield {
                type: "tool-error",
                toolName: tc.name,
                toolCallId: tc.id,
                error: errorMsg,
              };
              conversation.push({
                role: "tool",
                toolCallId: tc.id,
                content: JSON.stringify({ error: errorMsg }),
              });
              continue;
            }

            const result = await executor.execute(args);

            yield {
              type: "tool-result",
              toolName: tc.name,
              toolCallId: tc.id,
              result,
            };

            conversation.push({
              role: "tool",
              toolCallId: tc.id,
              content: JSON.stringify(result),
            });
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : "Unknown error";
            yield {
              type: "tool-error",
              toolName: tc.name,
              toolCallId: tc.id,
              error: errorMsg,
            };
            conversation.push({
              role: "tool",
              toolCallId: tc.id,
              content: JSON.stringify({ error: errorMsg }),
            });
          }
        }

        // 다음 턴 계속
      } catch (error) {
        if (this.abortController.signal.aborted) {
          yield { type: "aborted" };
          return;
        }

        const errorMsg =
          error instanceof Error ? error.message : "LLM provider 오류";
        yield {
          type: "tool-error",
          toolName: "llm_provider",
          toolCallId: "",
          error: errorMsg,
        };
        return;
      }
    }

    yield { type: "max-turns-reached" };
  }

  /** 429 지수 백오프 재시도 — 스트림 시작 실패에만 적용한다. */
  private async *streamWithRetry(
    messages: readonly LLMMessage[],
    tools: Awaited<ReturnType<typeof getToolDefinitions>>,
  ) {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const stream = this.provider.completeWithTools(messages, {
          tools,
          toolChoice: "auto",
          signal: this.abortController?.signal,
        });
        // 첫 이벤트를 받아 봐야 요청 성공 여부가 확정된다
        const first = await stream.next();
        if (!first.done) yield first.value;
        yield* stream;
        return;
      } catch (error) {
        lastError = error;
        if (!isRateLimitError(error) || attempt >= MAX_RETRIES) throw error;
        if (this.abortController?.signal.aborted) throw error;

        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[AgentService] 429 Rate limit, ${delay}ms 후 재시도 (${attempt + 1}/${MAX_RETRIES})`,
        );
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Agent Loop 중단. */
  stop(): void {
    this.abortController?.abort();
  }

  /** ChatMessage[] → provider 중립 메시지. */
  private convertMessages(messages: ChatMessage[]): LLMMessage[] {
    return messages
      .filter((msg) => msg.role !== "system") // system prompt는 별도 처리
      .map((msg): LLMMessage => {
        if (msg.role === "tool" && msg.metadata?.toolCallId) {
          return {
            role: "tool",
            toolCallId: msg.metadata.toolCallId,
            content: msg.content,
          };
        }

        if (msg.role === "assistant" && msg.metadata?.toolCalls?.length) {
          return {
            role: "assistant",
            content: msg.content || null,
            toolCalls: msg.metadata.toolCalls.map((tc) => ({
              id: tc.id,
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            })),
          };
        }

        return msg.role === "assistant"
          ? { role: "assistant", content: msg.content }
          : { role: "user", content: msg.content };
      });
  }
}

/**
 * 활성 프로파일(`main`)로 AgentService 를 만든다.
 *
 * 미구성이면 `null` — 키가 없어서가 아니라 **endpoint·모델이 정해지지 않아서** 다.
 * 호출자는 이 상태를 사용자에게 설정으로 안내한다 (기존 "키 없음" 분기와 같은 자리).
 */
export function createAgentService(): AgentService | null {
  const provider = resolveProvider("main");
  if (!provider) {
    if (import.meta.env.DEV) {
      console.warn(
        "[AgentService] 에이전트 프로파일이 구성되지 않았습니다 (endpoint·모델 미설정).",
      );
    }
    return null;
  }
  return new AgentService(provider);
}
