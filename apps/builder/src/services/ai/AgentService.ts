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
import { buildSystemPrompt, buildTurnContext } from "./systemPrompt";
import type { PromptTranslate } from "./promptTranslate";
import {
  isRateLimitError,
  type LLMMessage,
  type LLMProvider,
  type LLMStreamEvent,
} from "./providers/LLMProvider";
import { resolveProvider } from "./providers/agentProfiles";

const MAX_TURNS = 10;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

export class AgentService {
  private toolExecutors: Map<string, ToolExecutor>;
  private abortController: AbortController | null = null;

  constructor(
    private readonly provider: LLMProvider,
    /** 프롬프트 문장 해소기 — 응답 언어가 여기서 정해진다 (ADR-200 후속). */
    private readonly t: PromptTranslate,
  ) {
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

    // system 은 세션 동안 고정 — 빌더 상태·Tier 2 상세는 이번 턴 user 메시지에 싣는다
    // (Claude 5 계열의 prompt cache · thinking prefix binding, systemPrompt.ts 상단).
    const conversation: LLMMessage[] = [
      { role: "system", content: buildSystemPrompt(this.t) },
      ...this.convertMessages(
        messages,
        buildTurnContext(context, this.t, latestRequest),
      ),
    ];

    const tools = await getToolDefinitions(this.t);
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
        let stop: Extract<LLMStreamEvent, { type: "stop" }> | undefined;

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
          } else if (event.type === "stop") {
            stop = event;
          }
        }

        // 안전 분류기 거절 — 재시도 대상이 아니다. 사유를 그대로 보여 주고 끝낸다.
        if (stop?.reason === "refusal") {
          yield {
            type: "tool-error",
            toolName: "llm_provider",
            toolCallId: "",
            error: this.t("aiRuntime.refused", {
              category: stop.detail ?? "",
            }),
          };
          return;
        }

        // Tool calls 없으면 → 최종 응답
        if (toolCalls.length === 0) {
          yield { type: "final", content: assistantContent };
          return;
        }

        // provider 원문 (thinking 블록 포함) 을 같이 실어 다음 요청에 그대로 replay 한다.
        conversation.push({
          role: "assistant",
          content: assistantContent || null,
          toolCalls: toolCalls.map((tc) => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          })),
          ...(stop?.assistantTurn
            ? { providerContent: stop.assistantTurn }
            : {}),
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
              const errorMsg = this.t("aiToolError.unknownTool", {
                name: tc.name,
              });
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

            const result = await executor.execute(args, this.t);

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
          error instanceof Error
            ? error.message
            : this.t("aiRuntime.providerError");
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

  /**
   * ChatMessage[] → provider 중립 메시지.
   *
   * `turnContext` 는 **마지막 user 메시지** 앞에만 붙는다 — 이전 턴은 그대로 둬야
   * 이력이 append-only 로 남는다.
   */
  private convertMessages(
    messages: ChatMessage[],
    turnContext?: string,
  ): LLMMessage[] {
    const history = messages.filter((msg) => msg.role !== "system"); // system prompt는 별도 처리
    const latestUserIndex = history.map((m) => m.role).lastIndexOf("user");

    return history.map((msg, index): LLMMessage => {
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

      if (msg.role === "assistant") {
        return { role: "assistant", content: msg.content };
      }
      const withContext =
        turnContext && index === latestUserIndex
          ? `${turnContext}\n\n${msg.content}`
          : msg.content;
      return { role: "user", content: withContext };
    });
  }
}

/**
 * 활성 프로파일(`main`)로 AgentService 를 만든다.
 *
 * 미구성이면 `null` — 키가 없어서가 아니라 **endpoint·모델이 정해지지 않아서** 다.
 * 호출자는 이 상태를 사용자에게 설정으로 안내한다 (기존 "키 없음" 분기와 같은 자리).
 */
export function createAgentService(t: PromptTranslate): AgentService | null {
  const provider = resolveProvider("main");
  if (!provider) {
    if (import.meta.env.DEV) {
      console.warn(
        "[AgentService] 에이전트 프로파일이 구성되지 않았습니다 (endpoint·모델 미설정).",
      );
    }
    return null;
  }
  return new AgentService(provider, t);
}
