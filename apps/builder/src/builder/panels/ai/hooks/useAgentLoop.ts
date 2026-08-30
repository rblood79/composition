/**
 * useAgentLoop Hook
 *
 * Agent Loop를 제어하는 React Hook
 * AgentRunner(단일 실행 또는 Plan→Execute→Verify 분해, ADR-134 Phase 6) +
 * conversation store + G.3 시각 피드백 연동
 */

import { useMemo, useCallback, useState } from "react";
import { createAgentRunner } from "../../../../services/ai/createAgentRunner";
import { intentParser } from "../../../../services/ai/IntentParser";
import { useConversationStore } from "../../../stores/conversation";
import { useStore } from "../../../stores";
import { useAIVisualFeedbackStore } from "../../../stores/aiVisualFeedback";
import type { BuilderContext } from "../../../../types/integrations/chat.types";
import { buildBuilderContext } from "../../../../services/ai/builderContext";
import type { ToolExecutionResult } from "../../../../types/integrations/ai.types";
import { useI18n } from "@/i18n";
import {
  initialProgress,
  reduceProgress,
  type AgentProgress,
} from "./agentProgress";

/** 고급 모드가 읽는 진행 이벤트 — 나머지는 상태를 건드리지 않는다. */
const PROGRESS_EVENTS = new Set([
  "agent-start",
  "agent-end",
  "plan-ready",
  "repair-attempt",
]);

export function useAgentLoop() {
  const { t } = useI18n();
  const {
    messages,
    isStreaming,
    isAgentRunning,
    currentTurn,
    activeToolCalls,
    addUserMessage,
    addAssistantMessage,
    appendToLastMessage,
    setStreamingStatus,
    setAgentRunning,
    addToolMessage,
    updateToolCallStatus,
    incrementTurn,
  } = useConversationStore();

  // Agent 실행기 (한 번만 생성) — planner 프로파일이 있으면 Plan→Execute→Verify 분해 실행
  const agent = useMemo(() => createAgentRunner(t), [t]);

  // 계획·역할·수리 진행 (ADR-134 Phase 8) — 기본 표면은 안 읽는다, 고급 모드만 읽는다.
  const [progress, setProgress] = useState<AgentProgress>(initialProgress);
  // 지금 도는 도구 — 결과만 보여주면 그동안 화면이 멈춘 것처럼 보인다.
  const [runningTool, setRunningTool] = useState<string | null>(null);

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
      // 턴 시작 시점에 스토어에서 조립한다 — 패널 effect 의 실행 여부에 걸리지 않는다
      // (`services/ai/builderContext.ts` 주석: 감춰진 패널에서 제출이 조용히 무시되던 원인).
      const context = buildBuilderContext();

      // 유저 메시지 추가
      addUserMessage(message);

      // Agent 모드
      if (agent) {
        try {
          setAgentRunning(true);
          setStreamingStatus(true);
          setProgress(initialProgress());
          setRunningTool(null);

          // G.3: 선택된 요소에 generating 이펙트
          const currentSelectedId = useStore.getState().selectedElementId;
          if (currentSelectedId) {
            useAIVisualFeedbackStore
              .getState()
              .startGenerating([currentSelectedId]);
          }

          const allMessages = useConversationStore.getState().messages;
          const allAffectedIds: string[] = [];

          /**
           * 지금 열려 있는 assistant 말풍선이 있는가.
           *
           * 도구 결과 메시지가 들어가면 마지막 메시지가 tool 이 되고,
           * `appendToLastMessage` 는 assistant 가 아니면 delta 를 **버린다**
           * (`stores/conversation.ts`). 그래서 도구 실행 뒤에 온 설명이 통째로
           * 사라졌다 (ADR-134 Phase 2 관찰 → Phase 8 소관). 도구 결과 뒤에는
           * 말풍선을 새로 연다.
           */
          let assistantOpen = false;

          for await (const event of agent.runAgentLoop(allMessages, context)) {
            if (PROGRESS_EVENTS.has(event.type)) {
              setProgress((prev) => reduceProgress(prev, event));
            }

            switch (event.type) {
              case "text-delta":
                if (assistantOpen) {
                  appendToLastMessage(event.content);
                } else {
                  addAssistantMessage(event.content);
                  assistantOpen = true;
                }
                break;

              case "tool-use-start":
                updateToolCallStatus(event.toolCallId, "running");
                setRunningTool(event.toolName);
                incrementTurn();
                break;

              case "tool-result": {
                const result = event.result as ToolExecutionResult;
                updateToolCallStatus(event.toolCallId, "success", result);
                addToolMessage(event.toolCallId, event.toolName, result);
                assistantOpen = false;
                setRunningTool(null);

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
                setRunningTool(null);
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
          setRunningTool(null);
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error("[useAgentLoop] Agent error:", error);
          }

          // G.3: generating 취소
          useAIVisualFeedbackStore.getState().cancelGenerating();
          setStreamingStatus(false);
          setAgentRunning(false);
          setRunningTool(null);

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
    setRunningTool(null);
  }, [agent, setAgentRunning, setStreamingStatus]);

  return {
    messages,
    progress,
    runningTool,
    isStreaming,
    isAgentRunning,
    currentTurn,
    activeToolCalls,
    runAgent,
    stopAgent,
    hasAgent: !!agent,
  };
}
