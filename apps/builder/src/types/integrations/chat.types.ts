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
  elements: Array<{
    id: string;
    type: string;
    props: Record<string, unknown>;
    parent_id: string | null;
  }>;
  recentChanges: string[];
}

export interface ConversationState {
  messages: ChatMessage[];
  isStreaming: boolean;
  isAgentRunning: boolean;
  currentTurn: number;
  activeToolCalls: ToolCallInfo[];
  currentContext: BuilderContext | null;

  // 기존 액션
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string, intent?: ComponentIntent) => void;
  updateLastMessage: (content: string) => void;
  setStreamingStatus: (isStreaming: boolean) => void;
  updateContext: (context: BuilderContext) => void;
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
