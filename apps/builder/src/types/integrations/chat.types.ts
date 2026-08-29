/**
 * Chat and Conversation Type Definitions
 *
 * Defines types for the chat-based design interface
 */

export type MessageRole = "user" | "assistant" | "system" | "tool";

export type MessageStatus = "pending" | "streaming" | "complete" | "error";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  timestamp: number;
  metadata?: {
    componentIntent?: ComponentIntent;
    toolCalls?: ToolCallInfo[];
    toolCallId?: string;
    toolName?: string;
    toolResult?: unknown;
    error?: string;
  };
}

/**
 * Tool Call 실행 상태 추적
 */
export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: "pending" | "running" | "success" | "error";
  result?: unknown;
  error?: string;
}

export type IntentAction = "create" | "modify" | "delete" | "style" | "query";

export interface ComponentIntent {
  action: IntentAction;
  componentType?: string;
  targetElementId?: string;
  props?: Record<string, unknown>;
  styles?: Record<string, unknown>;
  fills?: unknown[];
  dataBinding?: {
    endpoint: string;
  };
  description?: string;
}

export interface BuilderContext {
  currentPageId: string;
  selectedElementId?: string;
  /**
   * 요소의 **식별 정보만** 담는다 — 소비처(`buildSystemPrompt` · `Orchestrator`)가 읽는
   * 것은 id · type · 개수뿐이다.
   *
   * props 를 싣지 않는 이유는 출처 때문이다: 이 목록은 `pageElementsSnapshot`
   * (레이어 트리용 **구조 전용** 캐시)에서 오고, props-only 변경(`updateElementProps`)
   * 에는 갱신되지 않는다. 실어 두면 낡은 props 가 조용히 읽힌다. 요소 props 가 필요한
   * 쪽은 canonical 을 읽는다 (`services/ai/tools/canonicalToolReadModel.ts`).
   */
  elements: Array<{ id: string; type: string }>;
  /**
   * 선택된 요소의 상세. **props 를 담으므로 최신 소스에서 와야 한다** — 빌더 스토어의
   * `elementsMap` 은 props-only 변경에 갱신된다 (2026-08-29 live 실측). 위 `elements`
   * 목록에서 뽑으면 안 된다: 그쪽은 구조 전용 캐시라 props 가 낡은 채로 프롬프트에 실린다.
   */
  selectedElement?: {
    id: string;
    type: string;
    props: Record<string, unknown>;
    parent_id: string | null;
  };
}

export interface ConversationState {
  messages: ChatMessage[];
  isStreaming: boolean;
  isAgentRunning: boolean;
  currentTurn: number;
  activeToolCalls: ToolCallInfo[];

  // 기존 액션
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string, intent?: ComponentIntent) => void;
  updateLastMessage: (content: string) => void;
  setStreamingStatus: (isStreaming: boolean) => void;
  clearConversation: () => void;

  // Agent Loop 액션
  setAgentRunning: (running: boolean) => void;
  addToolMessage: (
    toolCallId: string,
    toolName: string,
    result: unknown,
  ) => void;
  updateToolCallStatus: (
    toolCallId: string,
    status: ToolCallInfo["status"],
    result?: unknown,
    error?: string,
  ) => void;
  incrementTurn: () => void;
  appendToLastMessage: (delta: string) => void;
}
