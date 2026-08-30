/**
 * 에이전트 진행 상태 (ADR-134 Phase 8, D9).
 *
 * Phase 6 오케스트레이터는 `agent-start` / `agent-end` / `plan-ready` / `repair-attempt` 를
 * 이미 내보내고 있었지만 패널이 전부 버렸다 — 계획이 몇 단계였는지, 자기 수정이 일어났는지
 * 사용자가 알 길이 없었다. 여기서 모아 **고급 모드**가 읽는다 (기본 표면은 여전히 depth 2).
 *
 * 순수 reducer 인 이유는 이벤트 순서 규칙 (같은 역할 재실행 = 새 줄, 종료는 마지막 running
 * 줄만 닫음) 이 렌더 없이 검증 가능해야 하기 때문이다.
 */
import type { OrchestratedEvent } from "../../../../services/ai/agents/orchestrator";
import type {
  AgentPlan,
  AgentRole,
} from "../../../../services/ai/agents/types";

export interface AgentProgressRow {
  agent: AgentRole;
  /** 라벨 **키** — 해소는 표시 시점에 (ADR-200). */
  labelKey: string;
  status: "running" | "done";
  ok?: boolean;
  summary?: string;
}

export interface RepairAttempt {
  attempt: number;
  max: number;
  issues: readonly string[];
}

export interface AgentProgress {
  plan: AgentPlan | null;
  agents: AgentProgressRow[];
  repairs: RepairAttempt[];
}

export function initialProgress(): AgentProgress {
  return { plan: null, agents: [], repairs: [] };
}

export function hasProgress(progress: AgentProgress): boolean {
  return (
    progress.plan !== null ||
    progress.agents.length > 0 ||
    progress.repairs.length > 0
  );
}

export function reduceProgress(
  state: AgentProgress,
  event: OrchestratedEvent,
): AgentProgress {
  switch (event.type) {
    case "plan-ready":
      return { ...state, plan: event.plan };

    case "agent-start":
      return {
        ...state,
        agents: [
          ...state.agents,
          { agent: event.agent, labelKey: event.labelKey, status: "running" },
        ],
      };

    case "agent-end": {
      const agents = [...state.agents];
      // 같은 역할이 두 번 돈다 (실행 → 수리). 마지막 running 줄만 닫는다.
      for (let i = agents.length - 1; i >= 0; i -= 1) {
        if (agents[i].agent === event.agent && agents[i].status === "running") {
          agents[i] = {
            ...agents[i],
            status: "done",
            ok: event.ok,
            ...(event.summary ? { summary: event.summary } : {}),
          };
          break;
        }
      }
      return { ...state, agents };
    }

    case "repair-attempt":
      return {
        ...state,
        repairs: [
          ...state.repairs,
          { attempt: event.attempt, max: event.max, issues: event.issues },
        ],
      };

    default:
      return state;
  }
}
