/**
 * Conversation Store
 *
 * Manages chat messages and conversation state for the AI design assistant
 * Agent Loop 상태, tool call 추적 포함
 */

import { create } from "zustand";
import type {
  ConversationState,
  ChatMessage,
  ComponentIntent,
  ToolCallInfo,
} from "../../types/integrations/chat.types";

export const useConversationStore = create<ConversationState>((set) => ({
  messages: [],
  isStreaming: false,
  isAgentRunning: false,
  currentTurn: 0,
  activeToolCalls: [],

  /**
   * Add a user message to the conversation
   */
  addUserMessage: (content: string) => {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      status: "complete",
      timestamp: Date.now(),
    };

    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  /**
   * Add an assistant message to the conversation
   */
  addAssistantMessage: (content: string, intent?: ComponentIntent) => {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      status: "complete",
      timestamp: Date.now(),
      metadata: intent ? { componentIntent: intent } : undefined,
    };

    set((state) => ({
      messages: [...state.messages, message],
      isStreaming: false,
    }));
  },

  /**
   * Update the last message content (for streaming)
   */
  updateLastMessage: (content: string) => {
    set((state) => {
      const messages = [...state.messages];
      const lastMessage = messages[messages.length - 1];

      if (lastMessage && lastMessage.role === "assistant") {
        lastMessage.content = content;
        lastMessage.status = "streaming";
      }

      return { messages };
    });
  },

  /**
   * Append delta to last assistant message (streaming용)
   */
  appendToLastMessage: (delta: string) => {
    set((state) => {
      const messages = [...state.messages];
      const lastMessage = messages[messages.length - 1];

      if (lastMessage && lastMessage.role === "assistant") {
        lastMessage.content += delta;
        lastMessage.status = "streaming";
      }

      return { messages };
    });
  },

  /**
   * Set streaming status
   */
  setStreamingStatus: (isStreaming: boolean) => {
    set({ isStreaming });

    if (!isStreaming) {
      set((state) => {
        const messages = [...state.messages];
        const lastMessage = messages[messages.length - 1];

        if (lastMessage && lastMessage.role === "assistant") {
          lastMessage.status = "complete";
        }

        return { messages };
      });
    }
  },

  /**
   * Set agent running state
   */
  setAgentRunning: (running: boolean) => {
    set({
      isAgentRunning: running,
      ...(running ? { currentTurn: 0, activeToolCalls: [] } : {}),
    });
  },

  /**
   * Increment agent turn counter
   */
  incrementTurn: () => {
    set((state) => ({ currentTurn: state.currentTurn + 1 }));
  },

  /**
   * Add a tool result message
   */
  addToolMessage: (toolCallId: string, toolName: string, result: unknown) => {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role: "tool",
      content: JSON.stringify(result),
      status: "complete",
      timestamp: Date.now(),
      metadata: {
        toolCallId,
        toolName,
        toolResult: result,
      },
    };

    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  /**
   * Update tool call status in activeToolCalls
   */
  updateToolCallStatus: (
    toolCallId: string,
    status: ToolCallInfo["status"],
    result?: unknown,
    error?: string,
  ) => {
    set((state) => {
      const activeToolCalls = [...state.activeToolCalls];
      const index = activeToolCalls.findIndex((tc) => tc.id === toolCallId);

      if (index >= 0) {
        activeToolCalls[index] = {
          ...activeToolCalls[index],
          status,
          ...(result !== undefined ? { result } : {}),
          ...(error ? { error } : {}),
        };
      } else {
        // 새 tool call 추가
        activeToolCalls.push({
          id: toolCallId,
          name: "",
          arguments: {},
          status,
          ...(result !== undefined ? { result } : {}),
          ...(error ? { error } : {}),
        });
      }

      return { activeToolCalls };
    });
  },

  /**
   * Clear all messages and reset agent state
   */
  clearConversation: () => {
    set({
      messages: [],
      isStreaming: false,
      isAgentRunning: false,
      currentTurn: 0,
      activeToolCalls: [],
    });
  },
}));
