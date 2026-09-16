/**
 * useAgentLoop Hook
 *
 * Agent Loop를 제어하는 React Hook
 * AgentRunner(단일 실행 또는 Plan→Execute→Verify 분해, ADR-134 Phase 6) +
 * conversation store + G.3 시각 피드백 연동
 */

import { useCallback, useRef, useState } from "react";
import {
  createAgentRunner,
  type AgentRunner,
} from "../../../../services/ai/createAgentRunner";
import { isAgentProfileReady } from "../../../../services/ai/providers/agentProfiles";
import type { CompilerProposal } from "../../../../services/ai/compiler/contracts";
import { runCompilerRequest } from "../../../../services/ai/compiler/runtime";
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

  /**
   * 지금 도는 실행기 — `stopAgent` 가 잡는다.
   *
   * 실행기는 **턴 시작 시점에** 만든다 (planner 프로파일이 있으면 Plan→Execute→Verify
   * 분해 실행). mount 때 한 번 memo 하면 설정 패널에서 프로파일을 채운 뒤에도 null 실행기가
   * 남아 새로고침 전까지 fallback 만 나왔다 (2026-09-03 live 실측 — LLM 호출 0).
   * 프로파일·BYOK 키도 그 시점에 조회한다 (D10 — 키는 호출 인자로만).
   */
  const runnerRef = useRef<AgentRunner | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  // 계획·역할·수리 진행 (ADR-134 Phase 8) — 기본 표면은 안 읽는다, 고급 모드만 읽는다.
  const [progress, setProgress] = useState<AgentProgress>(initialProgress);
  // 지금 도는 도구 — 결과만 보여주면 그동안 화면이 멈춘 것처럼 보인다.
  const [runningTool, setRunningTool] = useState<string | null>(null);

  /**
   * IntentParser fallback
   */
  const runFallback = useCallback(
    (message: string, context: BuilderContext) => {
      const intent = intentParser.parse(message, t, context);

      if (intent) {
        addAssistantMessage(intent.description || t("aiIntent.done"), intent);
      } else {
        addAssistantMessage(t("ai.notUnderstood"));
      }
    },
    [addAssistantMessage, t],
  );

  /**
   * Agent Loop 실행
   */
  const runAgent = useCallback(
    async (message: string, proposal?: CompilerProposal) => {
      if (requestRef.current) return;
      const request = new AbortController();
      requestRef.current = request;
      const initialSelection = useStore.getState();
      const requestPageId = initialSelection.currentPageId;
      const requestSelectedId = initialSelection.selectedElementId;
      try {
        // 턴 시작 시점에 스토어에서 조립한다 — 패널 effect 의 실행 여부에 걸리지 않는다
        // (`services/ai/builderContext.ts` 주석: 감춰진 패널에서 제출이 조용히 무시되던 원인).
        const context = buildBuilderContext();

        // 유저 메시지 추가
        addUserMessage(message);

        // ADR-202: direct는 provider 구성/Agent 생성보다 먼저 실행한다.
        // 한 릴리스 동안 session-local rollback 표면을 보존한다.
        const disabled =
          sessionStorage.getItem("composition.ai.compiler.disabled") === "true";
        if (proposal && disabled) {
          addAssistantMessage(t("ai.localActionFailed"));
          return;
        }
        if (!disabled) {
          setStreamingStatus(true);
          const currentSelection = useStore.getState();
          if (
            request.signal.aborted ||
            currentSelection.currentPageId !== requestPageId ||
            currentSelection.selectedElementId !== requestSelectedId
          )
            return;
          const compiled = await runCompilerRequest(
            message,
            t,
            request.signal,
            proposal,
          );
          if (request.signal.aborted) return;
          if (compiled.handled) {
            if (compiled.result?.success) {
              addToolMessage(
                crypto.randomUUID(),
                proposal?.program.operations[0].op ?? "builder_command",
                compiled.result,
              );
              addAssistantMessage(
                proposal
                  ? t("ai.localActionDone", { goal: message })
                  : t("aiIntent.done"),
              );
            } else {
              addAssistantMessage(
                t(proposal ? "ai.localActionFailed" : "ai.notUnderstood"),
              );
            }
            return;
          }
        }
        if (proposal) {
          addAssistantMessage(t("ai.localActionFailed"));
          return;
        }
        if (request.signal.aborted) return;
        // Agent 모드 — 실행기는 이 턴의 프로파일로 만든다
        const agent = createAgentRunner(t);
        runnerRef.current = agent;
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

            for await (const event of agent.runAgentLoop(
              allMessages,
              context,
            )) {
              if (request.signal.aborted) break;
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
          // rollback/creative fallback 전용. direct 결과로 metadata-only 응답을 사용하지 않는다.
          runFallback(message, context);
        }
      } catch {
        if (!request.signal.aborted) addAssistantMessage(t("ai.notUnderstood"));
      } finally {
        if (requestRef.current === request) {
          requestRef.current = null;
          setStreamingStatus(false);
          setAgentRunning(false);
          setRunningTool(null);
        }
      }
    },
    [
      t,
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
    requestRef.current?.abort();
    // abort 된 fetch 스트림이 실제로 끝나 finally 가 돌 때까지 (Ollama 취소 28~240초 실측)
    // ref 를 들고 있으면 그 사이 제출이 무음으로 버려진다 — 지금 비운다. 늦게 도는 finally 는
    // `requestRef.current === request` 검사라 새 요청을 덮지 않는다.
    requestRef.current = null;
    runnerRef.current?.stop();
    useAIVisualFeedbackStore.getState().cancelGenerating();
    setAgentRunning(false);
    setStreamingStatus(false);
    setRunningTool(null);
  }, [setAgentRunning, setStreamingStatus]);

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
    // 렌더 시점 판정 — 설정 패널에서 돌아오는 재렌더에서 바로 갱신된다
    hasAgent: isAgentProfileReady("main"),
  };
}
