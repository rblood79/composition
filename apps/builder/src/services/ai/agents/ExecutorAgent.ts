/**
 * Execute 서브에이전트 (ADR-134 Phase 6, D7) — executor 프로파일.
 *
 * 도구를 실제로 부르는 유일한 역할이다. 루프 자체는 `AgentService` 를 그대로 쓴다 —
 * 도구 실행 · 429 백오프 · abort 는 Phase 2 에서 이미 정해진 계약이고, 여기서 다시
 * 구현하면 두 벌이 갈라진다.
 *
 * 오케스트레이터에게는 이벤트를 그대로 흘려보내면서 **실행 기록**을 모은다 —
 * 검증기가 "무엇이 실제로 일어났는가" 를 보는 근거다.
 */
import type { AgentEvent } from "../../../types/integrations/ai.types";
import type {
  BuilderContext,
  ChatMessage,
} from "../../../types/integrations/chat.types";
import type { LLMProvider } from "../providers/LLMProvider";
import { AgentService } from "../AgentService";
import type { PlanStep } from "./types";

export interface ExecutionRecord {
  /** 검증기에게 넘길 사람이 읽는 기록. */
  log: string[];
  /** 실행 중 도구가 만진 요소 id. */
  affectedElementIds: string[];
  /** 도구 오류가 하나라도 있었는가. */
  hadError: boolean;
}

function userMessage(content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    content,
    status: "complete",
    timestamp: Date.now(),
  };
}

export class ExecutorAgent {
  private readonly service: AgentService;

  constructor(provider: LLMProvider) {
    this.service = new AgentService(provider);
  }

  stop(): void {
    this.service.stop();
  }

  /** 한 단계를 실행한다. 이벤트는 그대로 흘리고 기록은 `record` 에 쌓인다. */
  async *runStep(
    step: PlanStep,
    context: BuilderContext,
    record: ExecutionRecord,
    priorIssues: readonly string[] = [],
  ): AsyncGenerator<AgentEvent> {
    const instruction = priorIssues.length
      ? [
          step.instruction,
          "",
          "이전 시도에서 다음이 어긋났습니다. 그 부분만 고치세요:",
          ...priorIssues.map((issue) => `- ${issue}`),
        ].join("\n")
      : step.instruction;

    for await (const event of this.service.runAgentLoop(
      [userMessage(instruction)],
      context,
    )) {
      if (event.type === "tool-result") {
        const result = event.result as {
          success?: boolean;
          error?: string;
          affectedElementIds?: string[];
        };
        record.log.push(
          `단계 ${step.index}: ${event.toolName} → ${result?.success === false ? `실패 (${result.error ?? "사유 없음"})` : "성공"}`,
        );
        if (result?.success === false) record.hadError = true;
        for (const id of result?.affectedElementIds ?? []) {
          record.affectedElementIds.push(id);
        }
      } else if (event.type === "tool-error") {
        record.log.push(
          `단계 ${step.index}: ${event.toolName} → 오류 ${event.error}`,
        );
        record.hadError = true;
      }
      yield event;
    }
  }
}
