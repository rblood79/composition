/**
 * useAgentLoop Hook
 *
 * Agent Loop를 제어하는 React Hook
 * AgentService(LLMProvider 경유) + conversation store + G.3 시각 피드백 연동
 */

import { useMemo, useCallback } from "react";
import { createAgentService } from "../../../../services/ai/AgentService";
import { intentParser } from "../../../../services/ai/IntentParser";
import { useConversationStore } from "../../../stores/conversation";
import { useStore } from "../../../stores";
import { useAIVisualFeedbackStore } from "../../../stores/aiVisualFeedback";
import type { BuilderContext } from "../../../../types/integrations/chat.types";
import type { ToolExecutionResult } from "../../../../types/integrations/ai.types";

export function useAgentLoop() {
  const {
    messages,
    isStreaming,
    isAgentRunning,
    currentTurn,
    activeToolCalls,
    currentContext,
    addUserMessage,
    addAssistantMessage,
    appendToLastMessage,
    setStreamingStatus,
    setAgentRunning,
    addToolMessage,
    updateToolCallStatus,
    incrementTurn,
  } = useConversationStore();

  // Agent 인스턴스 (한 번만 생성)
  const agent = useMemo(() => createAgentService(), []);

  /**
   * IntentParser fallback
   */
  const runFallback = useCallback(
    (message: string, context: BuilderContext) => {
      const intent = intentParser.parse(message, context);

      if (intent) {
        addAssistantMessage(
          intent.description || "요청을 처리했습니다.",
          intent,
        );
      } else {
        addAssistantMessage(
          "죄송합니다. 요청을 이해하지 못했습니다. 다시 시도해주세요.",
        );
      }
    },
    [addAssistantMessage],
  );

  /**
   * Agent Loop 실행
   */
  const runAgent = useCallback(
    async (message: string) => {
      const context = useConversationStore.getState().currentContext;
      if (!context) {
        if (import.meta.env.DEV) {
          console.warn("[useAgentLoop] No context available");
        }
        return;
      }

      // 유저 메시지 추가
      addUserMessage(message);

      // Agent 모드
      if (agent) {
        try {
          setAgentRunning(true);
          setStreamingStatus(true);

          // G.3: 선택된 요소에 generating 이펙트
          const currentSelectedId = useStore.getState().selectedElementId;
          if (currentSelectedId) {
            useAIVisualFeedbackStore
              .getState()
              .startGenerating([currentSelectedId]);
          }

          // 빈 assistant 메시지 추가 (스트리밍용)
          addAssistantMessage("");

          const allMessages = useConversationStore.getState().messages;
          const allAffectedIds: string[] = [];

          for await (const event of agent.runAgentLoop(allMessages, context)) {
            switch (event.type) {
              case "text-delta":
                appendToLastMessage(event.content);
                break;

              case "tool-use-start":
                updateToolCallStatus(event.toolCallId, "running");
                incrementTurn();
                break;

              case "tool-result": {
                const result = event.result as ToolExecutionResult;
                updateToolCallStatus(event.toolCallId, "success", result);
                addToolMessage(event.toolCallId, event.toolName, result);

                // G.3: 영향 받은 요소에 flash
                if (result?.affectedElementIds) {
                  for (const id of result.affectedElementIds) {
                    useAIVisualFeedbackStore.getState().addFlashForNode(id, {
                      scanLine: event.toolName === "create_element",
                      strokeWidth: 1,
                    });
                    allAffectedIds.push(id);
                  }
                }
                break;
              }

              case "tool-error":
                updateToolCallStatus(
                  event.toolCallId,
                  "error",
                  undefined,
                  event.error,
                );
                break;

              case "final":
                // 최종 응답은 이미 text-delta로 스트리밍됨
                break;

              case "aborted":
                if (import.meta.env.DEV) {
                  console.log("[useAgentLoop] Agent aborted");
                }
                break;

              case "max-turns-reached":
                if (import.meta.env.DEV) {
                  console.warn("[useAgentLoop] Max turns reached");
                }
                break;
            }
          }

          // G.3: generating 완료
          if (currentSelectedId) {
            useAIVisualFeedbackStore
              .getState()
              .completeGenerating(
                allAffectedIds.length > 0
                  ? allAffectedIds
                  : [currentSelectedId],
              );
          }

          setStreamingStatus(false);
          setAgentRunning(false);
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error("[useAgentLoop] Agent error:", error);
          }

          // G.3: generating 취소
          useAIVisualFeedbackStore.getState().cancelGenerating();
          setStreamingStatus(false);
          setAgentRunning(false);

          // IntentParser fallback
          runFallback(message, context);
        }
      } else {
        // Agent 없으면 바로 fallback
        runFallback(message, context);
      }
    },
    [
      agent,
      addUserMessage,
      addAssistantMessage,
      appendToLastMessage,
      setStreamingStatus,
      setAgentRunning,
      addToolMessage,
      updateToolCallStatus,
      incrementTurn,
      runFallback,
    ],
  );

  /**
   * Agent 중단
   */
  const stopAgent = useCallback(() => {
    agent?.stop();
    useAIVisualFeedbackStore.getState().cancelGenerating();
    setAgentRunning(false);
    setStreamingStatus(false);
  }, [agent, setAgentRunning, setStreamingStatus]);

  return {
    messages,
    isStreaming,
    isAgentRunning,
    currentTurn,
    activeToolCalls,
    currentContext,
    runAgent,
    stopAgent,
    hasAgent: !!agent,
  };
}
