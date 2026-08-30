/**
 * Plan → Execute → Verify 오케스트레이션 계약 (ADR-134 Phase 6, D7).
 *
 * 세 역할은 각자 **에이전트 프로파일**로 호출된다 (planner / executor / verifier) — 계획에는
 * 추론이 센 모델을, 실행에는 도구 호출이 정확한 모델을 쓸 수 있게 하는 것이 분해의 목적이다.
 */
import type { LLMProvider } from "../providers/LLMProvider";

export type AgentRole = "planner" | "executor" | "verifier";

/** 계획 1단계 — 실행기에게 주는 지시 한 덩어리. */
export interface PlanStep {
  /** 1부터. 실행 순서. */
  index: number;
  /** 이 단계가 무엇을 하는지 (실행기 프롬프트로 그대로 간다). */
  instruction: string;
  /** 이 단계가 끝났다고 볼 수 있는 조건 — 검증기가 읽는다. */
  done?: string;
}

export interface AgentPlan {
  /** 요청 재진술 — 검증기가 "요청대로인가" 를 볼 때의 기준. */
  goal: string;
  steps: PlanStep[];
}

/** 검증기 판정. */
export interface VerifyOutcome {
  ok: boolean;
  /** ok=false 일 때 무엇이 어긋났는지 — 수리 시도의 입력이 된다. */
  issues: string[];
}

/** 오케스트레이션이 추가로 내보내는 진행 이벤트 (기존 AgentEvent 와 합집합). */
export type OrchestratorEvent =
  | { type: "agent-start"; agent: AgentRole; labelKey: string }
  | { type: "agent-end"; agent: AgentRole; ok: boolean; summary?: string }
  | { type: "plan-ready"; plan: AgentPlan }
  | {
      type: "repair-attempt";
      attempt: number;
      max: number;
      issues: readonly string[];
    };

/** 역할 → provider 해석기. 미구성 역할은 호출자가 main 으로 내린다. */
export type ProviderResolver = (role: AgentRole) => LLMProvider | undefined;
