/**
 * AI Service Type Definitions
 *
 * Defines types for AI integration and natural language processing
 */

import type { ChatMessage, BuilderContext } from "./chat.types";

// ─── 신규 타입 (Tool Calling + Agent Loop) ───

/**
 * Agent Loop에서 yield하는 이벤트
 */
export type AgentEvent =
  | { type: "text-delta"; content: string }
  | { type: "tool-use-start"; toolName: string; toolCallId: string }
  | {
      type: "tool-result";
      toolName: string;
      toolCallId: string;
      result: unknown;
    }
  | { type: "tool-error"; toolName: string; toolCallId: string; error: string }
  | { type: "final"; content: string }
  | { type: "aborted" }
  | { type: "max-turns-reached" };

/**
 * 스트리밍 중 조립되는 tool call 구조
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string (스트리밍 중 점진적 조립)
}

/**
 * 도구 실행 결과
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  /** G.3 시각 피드백 연동: 영향 받은 요소 ID 목록 */
  affectedElementIds?: string[];
}

/**
 * 각 도구의 실행 인터페이스
 */
export interface ToolExecutor {
  name: string;
  /**
   * 두 번째 인자는 오류 문구 해소기다 (ADR-200 후속) — 도구가 돌려주는 문장은
   * 모델이 읽고 AI 패널이 그대로 보여 준다.
   */
  execute: (
    args: Record<string, unknown>,
    t: ToolTranslate,
  ) => Promise<ToolExecutionResult>;
}

/** 도구 오류 문구 해소기. `services/ai` 는 순수 모듈이라 훅을 못 쓴다. */
export type ToolTranslate = (
  key: string,
  params?: Record<string, string | number | boolean>,
) => string;

/**
 * Agent 방식 AI 서비스 인터페이스
 */
export interface AIAgentProvider {
  runAgentLoop(
    messages: ChatMessage[],
    context: BuilderContext,
  ): AsyncGenerator<AgentEvent>;
  stop(): void;
}
