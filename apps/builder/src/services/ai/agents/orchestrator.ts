/**
 * Plan → Execute → Verify 오케스트레이터 (ADR-134 Phase 6, D7).
 *
 * 세 역할을 순서대로 돌리고, 검증이 실패하면 **최대 2회**까지 실행기에게 다시 시킨다
 * (bounded repair). 상한이 있는 이유는 무한 수리가 사용자 캔버스를 계속 바꾸기 때문이다 —
 * 두 번 고쳐 안 되면 사람에게 넘긴다.
 *
 * **분해를 건너뛰는 경우**: 계획이 1단계이거나 planner 가 JSON 을 못 냈으면 그냥 실행기만
 * 돈다. "버튼 색 바꿔줘" 에 계획·검증 두 번의 모델 호출을 붙이는 것은 비용만 늘린다.
 * (breakdown 은 이 판정을 fast 프로파일 분류로 적었지만, planner 가 낸 단계 수로 같은
 * 판정을 할 수 있어 호출 1회를 아낀다.)
 */
import type { AgentEvent } from "../../../types/integrations/ai.types";
import type { BuilderContext } from "../../../types/integrations/chat.types";
import { ExecutorAgent, type ExecutionRecord } from "./ExecutorAgent";
import { PlannerAgent } from "./PlannerAgent";
import { VerifierAgent } from "./VerifierAgent";
import type {
  AgentPlan,
  OrchestratorEvent,
  ProviderResolver,
} from "./types";

/** 수리 시도 상한 — 넘으면 사람에게 넘긴다. */
export const MAX_REPAIR_ATTEMPTS = 2;

export type OrchestratedEvent = AgentEvent | OrchestratorEvent;

export interface OrchestratorOptions {
  /** 역할별 provider. 미구성 역할은 `main` 으로 내린다 (호출자가 fallback 제공). */
  resolve: ProviderResolver;
  /** 어느 역할도 구성되지 않았을 때 쓸 provider. */
  fallback: ReturnType<ProviderResolver>;
}

function builderSummary(context: BuilderContext): string {
  const types = new Set(context.elements.map((el) => el.type));
  return [
    `페이지 ID: ${context.currentPageId}`,
    `요소 ${context.elements.length}개`,
    `사용 중인 컴포넌트: ${[...types].join(", ") || "없음"}`,
    context.selectedElementId
      ? `선택된 요소: ${context.elements.find((e) => e.id === context.selectedElementId)?.type ?? "?"}`
      : "선택된 요소 없음",
  ].join("\n");
}

export class Orchestrator {
  private executor: ExecutorAgent | null = null;

  constructor(private readonly options: OrchestratorOptions) {}

  stop(): void {
    this.executor?.stop();
  }

  private provider(role: Parameters<ProviderResolver>[0]) {
    return this.options.resolve(role) ?? this.options.fallback;
  }

  /**
   * 요청 하나를 계획 → 실행 → 검증으로 처리한다.
   * 이벤트는 기존 `AgentEvent` 에 역할별 진행 이벤트를 더한 합집합으로 나온다.
   */
  async *run(
    request: string,
    context: BuilderContext,
    history: readonly string[] = [],
  ): AsyncGenerator<OrchestratedEvent> {
    const plannerProvider = this.provider("planner");
    const executorProvider = this.provider("executor");
    if (!executorProvider) {
      yield { type: "final", content: "실행할 에이전트 프로파일이 없습니다." };
      return;
    }

    // ── Plan ────────────────────────────────────────────────────────
    let plan: AgentPlan | null = null;
    if (plannerProvider) {
      yield { type: "agent-start", agent: "planner", label: "계획" };
      plan = await new PlannerAgent(plannerProvider).plan(
        request,
        builderSummary(context),
        history,
      );
      yield {
        type: "agent-end",
        agent: "planner",
        ok: Boolean(plan),
        summary: plan ? `${plan.steps.length}단계` : "계획 없음",
      };
    }

    // 단계가 1개 이하면 분해하지 않는다 — 계획·검증 호출을 붙일 이유가 없다.
    const decomposed = Boolean(plan && plan.steps.length > 1);
    const steps = decomposed
      ? plan!.steps
      : [{ index: 1, instruction: request }];

    if (decomposed) yield { type: "plan-ready", plan: plan! };

    // ── Execute ─────────────────────────────────────────────────────
    this.executor = new ExecutorAgent(executorProvider);
    const record: ExecutionRecord = {
      log: [],
      affectedElementIds: [],
      hadError: false,
    };

    yield { type: "agent-start", agent: "executor", label: "실행" };
    for (const step of steps) {
      yield* this.executor.runStep(step, context, record);
    }
    yield {
      type: "agent-end",
      agent: "executor",
      ok: !record.hadError,
      summary: `${record.log.length}건 실행`,
    };

    // 분해하지 않은 단순 요청은 검증하지 않는다.
    if (!decomposed || !plan) return;

    // ── Verify (+ bounded repair) ───────────────────────────────────
    const verifierProvider = this.provider("verifier");
    if (!verifierProvider) return;
    const verifier = new VerifierAgent(verifierProvider);

    for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
      yield { type: "agent-start", agent: "verifier", label: "검증" };
      const outcome = await verifier.verify(plan, record.log);
      yield {
        type: "agent-end",
        agent: "verifier",
        ok: outcome.ok,
        summary: outcome.ok ? "이상 없음" : `${outcome.issues.length}건 지적`,
      };

      if (outcome.ok) return;
      if (attempt === MAX_REPAIR_ATTEMPTS) {
        yield {
          type: "final",
          content: [
            `${MAX_REPAIR_ATTEMPTS}회 고쳐 봤지만 다음이 남았습니다:`,
            ...outcome.issues.map((i) => `- ${i}`),
          ].join("\n"),
        };
        return;
      }

      yield {
        type: "repair-attempt",
        attempt: attempt + 1,
        max: MAX_REPAIR_ATTEMPTS,
        issues: outcome.issues,
      };

      // 지적된 부분만 다시 시킨다 — 계획 전체를 다시 돌리면 중복 생성이 난다.
      yield { type: "agent-start", agent: "executor", label: "수리" };
      yield* this.executor.runStep(
        { index: 0, instruction: `지적된 부분을 고치세요. 목표: ${plan.goal}` },
        context,
        record,
        outcome.issues,
      );
      yield {
        type: "agent-end",
        agent: "executor",
        ok: !record.hadError,
        summary: `수리 ${attempt + 1}회`,
      };
    }
  }
}
