/**
 * AI 패널이 쓰는 실행기 하나 (ADR-134 Phase 6, D7).
 *
 * 두 경로가 있다:
 * - **분해 실행** — planner 프로파일이 구성돼 있으면 Plan → Execute → Verify 로 돈다.
 * - **단일 실행** — 아니면 기존 `AgentService` 루프 그대로.
 *
 * 패널은 어느 쪽인지 모른다. 둘 다 같은 이벤트 스트림을 내고, 분해 경로가 더하는 역할 이벤트
 * (`agent-start` 등) 는 패널이 아직 모르는 종류라 무시된다 (표시는 Phase 8).
 *
 * 분해가 항상 이득은 아니다 — 계획 호출 1회가 붙는다. 그래서 planner 가 1단계짜리 계획을
 * 내면 오케스트레이터가 검증까지 건너뛴다 (`orchestrator.ts` 의 `decomposed` 판정).
 */
import type { BuilderContext, ChatMessage } from "../../types/integrations/chat.types";
import { AgentService } from "./AgentService";
import { Orchestrator, type OrchestratedEvent } from "./agents/orchestrator";
import type { AgentRole } from "./agents/types";
import { getAgentProfileRegistry, resolveProvider } from "./providers/agentProfiles";
import {
  isProfileConfigured,
  type AgentProfileId,
} from "./providers/AgentProfileRegistry";
import {
  describeRouting,
  routeTask,
  type AgentTask,
  type RoutingReport,
} from "./routing/AgentProfileRouter";

/** 역할 → 작업 유형. 라우터는 작업 단위로 판정한다 (D8). */
const ROLE_TASK: Readonly<Record<AgentRole, AgentTask>> = {
  planner: "plan",
  executor: "execute",
  verifier: "verify",
};

const lookupProfile = (id: AgentProfileId) =>
  getAgentProfileRegistry().get(id);

/** 네 작업이 각각 어느 프로파일로 가는지 — 연결 상태 표시가 읽는다. */
export function getRoutingReport(): RoutingReport {
  return describeRouting(lookupProfile);
}

export interface AgentRunner {
  /** 분해 실행 중인지 — 패널이 안내 문구를 고를 때 쓴다. */
  readonly orchestrated: boolean;
  runAgentLoop(
    messages: ChatMessage[],
    context: BuilderContext,
  ): AsyncGenerator<OrchestratedEvent>;
  stop(): void;
}

/** 계획 담당에게 넘길 직전 대화 (최근 6줄, 도구 메시지 제외). */
function recentHistory(messages: readonly ChatMessage[]): string[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-7, -1)
    .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.content}`)
    .filter((line) => line.length > 6);
}

class OrchestratedRunner implements AgentRunner {
  readonly orchestrated = true;
  private readonly orchestrator: Orchestrator;

  constructor() {
    this.orchestrator = new Orchestrator({
      // 역할별 provider 는 라우터가 정한다 — 미구성 역할의 내림이 기록으로 남는다 (D8).
      resolve: (role) => {
        const decision = routeTask(ROLE_TASK[role], lookupProfile);
        return decision.profileId
          ? resolveProvider(decision.profileId)
          : undefined;
      },
      fallback: resolveProvider("main"),
    });
  }

  async *runAgentLoop(
    messages: ChatMessage[],
    context: BuilderContext,
  ): AsyncGenerator<OrchestratedEvent> {
    const request = [...messages].reverse().find((m) => m.role === "user");
    if (!request) return;
    yield* this.orchestrator.run(
      request.content,
      context,
      recentHistory(messages),
    );
  }

  stop(): void {
    this.orchestrator.stop();
  }
}

/** 구성된 프로파일에 맞는 실행기. 아무것도 구성되지 않았으면 `null`. */
export function createAgentRunner(): AgentRunner | null {
  const main = resolveProvider("main");
  if (!main) {
    if (import.meta.env.DEV) {
      console.warn(
        "[AgentRunner] 에이전트 프로파일이 구성되지 않았습니다 (endpoint·모델 미설정).",
      );
    }
    return null;
  }
  // 분해 여부는 planner **프로파일 자체**의 구성으로 판정한다 — 라우터의 내림 결과로 보면
  // planner 미구성인데도 main 으로 내려와 늘 분해하게 된다.
  if (isProfileConfigured(getAgentProfileRegistry().get("planner"))) {
    return new OrchestratedRunner();
  }

  const service = new AgentService(main);
  return {
    orchestrated: false,
    runAgentLoop: (messages, context) =>
      service.runAgentLoop(messages, context),
    stop: () => service.stop(),
  };
}
