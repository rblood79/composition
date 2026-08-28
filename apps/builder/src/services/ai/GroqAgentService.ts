/**
 * Groq Agent Service
 *
 * Tool Calling + Agent Loop 기반 AI 서비스
 * GroqService.ts의 JSON 텍스트 파싱 방식을 대체
 */

import Groq from "groq-sdk";
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

const MAX_TURNS = 10;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

type GroqMessage = Groq.Chat.Completions.ChatCompletionMessageParam;

export class GroqAgentService {
  private client: Groq;
  private toolExecutors: Map<string, ToolExecutor>;
  private abortController: AbortController | null = null;

  constructor(apiKey: string) {
    this.client = new Groq({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
    this.toolExecutors = createToolRegistry();
  }

  /**
   * Agent Loop 실행 (AsyncGenerator 패턴)
   */
  async *runAgentLoop(
    messages: ChatMessage[],
    context: BuilderContext,
  ): AsyncGenerator<AgentEvent> {
    this.abortController = new AbortController();

    // ChatMessage → Groq message 형식 변환
    const conversationMessages: GroqMessage[] = [
      { role: "system", content: buildSystemPrompt(context) },
      ...this.convertMessages(messages),
    ];

    let turn = 0;

    while (turn < MAX_TURNS) {
      if (this.abortController.signal.aborted) {
        yield { type: "aborted" };
        return;
      }

      turn++;

      try {
        // Groq API 호출 (streaming) + 429 지수 백오프
        const stream = await this.createStreamWithRetry(conversationMessages);

        let assistantContent = "";
        const toolCalls: ToolCall[] = [];

        // 스트리밍 처리
        for await (const chunk of stream) {
          if (this.abortController.signal.aborted) {
            yield { type: "aborted" };
            return;
          }

          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;

          // 텍스트 스트리밍
          if (delta.content) {
            assistantContent += delta.content;
            yield { type: "text-delta", content: delta.content };
          }

          // Tool call 스트리밍 조립
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.index === undefined) continue;

              if (!toolCalls[tc.index]) {
                toolCalls[tc.index] = {
                  id: tc.id || `call_${tc.index}`,
                  name: "",
                  arguments: "",
                };
              }

              if (tc.function?.name) {
                toolCalls[tc.index].name = tc.function.name;
              }
              if (tc.function?.arguments) {
                toolCalls[tc.index].arguments += tc.function.arguments;
              }
            }
          }
        }

        // Tool calls 없으면 → 최종 응답
        if (toolCalls.length === 0) {
          yield { type: "final", content: assistantContent };
          return;
        }

        // Assistant message를 대화에 추가
        conversationMessages.push({
          role: "assistant",
          content: assistantContent || null,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
        });

        // 각 Tool 실행
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
            const args = JSON.parse(tc.arguments);
            const executor = this.toolExecutors.get(tc.name);

            if (!executor) {
              const errorMsg = `알 수 없는 도구: ${tc.name}`;
              yield {
                type: "tool-error",
                toolName: tc.name,
                toolCallId: tc.id,
                error: errorMsg,
              };

              conversationMessages.push({
                role: "tool",
                tool_call_id: tc.id,
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

            conversationMessages.push({
              role: "tool",
              tool_call_id: tc.id,
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

            conversationMessages.push({
              role: "tool",
              tool_call_id: tc.id,
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
          error instanceof Error ? error.message : "Groq API 오류";
        yield {
          type: "tool-error",
          toolName: "groq_api",
          toolCallId: "",
          error: errorMsg,
        };
        return;
      }
    }

    yield { type: "max-turns-reached" };
  }

  /**
   * 429 Rate Limit 지수 백오프 재시도
   */
  private async createStreamWithRetry(messages: GroqMessage[]) {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.client.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages,
          tools: await getToolDefinitions(),
          tool_choice: "auto",
          stream: true,
          temperature: 0.7,
          max_tokens: 2048,
        });
      } catch (error) {
        lastError = error;
        const isRateLimit = this.isRateLimitError(error);

        if (!isRateLimit || attempt >= MAX_RETRIES) {
          throw error;
        }

        if (this.abortController?.signal.aborted) {
          throw error;
        }

        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[GroqAgent] 429 Rate limit, ${delay}ms 후 재시도 (${attempt + 1}/${MAX_RETRIES})`,
        );
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private isRateLimitError(error: unknown): boolean {
    if (error && typeof error === "object") {
      const statusCode =
        (error as { status?: number }).status ??
        (error as { statusCode?: number }).statusCode;
      if (statusCode === 429) return true;

      const message = (error as { message?: string }).message;
      if (message && message.toLowerCase().includes("rate limit")) return true;
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Agent Loop 중단
   */
  stop(): void {
    this.abortController?.abort();
  }

  /**
   * ChatMessage[] → Groq message 형식 변환
   */
  private convertMessages(messages: ChatMessage[]): GroqMessage[] {
    return messages
      .filter((msg) => msg.role !== "system") // system prompt는 별도 처리
      .map((msg): GroqMessage => {
        if (msg.role === "tool" && msg.metadata?.toolCallId) {
          return {
            role: "tool",
            tool_call_id: msg.metadata.toolCallId,
            content: msg.content,
          };
        }

        if (msg.role === "assistant" && msg.metadata?.toolCalls?.length) {
          return {
            role: "assistant",
            content: msg.content || null,
            tool_calls: msg.metadata.toolCalls.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            })),
          };
        }

        return {
          role: msg.role as "user" | "assistant",
          content: msg.content,
        };
      });
  }
}

/**
 * 환경변수에서 GroqAgentService 인스턴스 생성
 */
export function createGroqAgentService(): GroqAgentService | null {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey || apiKey === "your_groq_api_key_here") {
    if (import.meta.env.DEV) {
      console.warn("[GroqAgentService] API 키가 설정되지 않았습니다.");
    }
    return null;
  }

  return new GroqAgentService(apiKey);
}
