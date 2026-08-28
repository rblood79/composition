/**
 * 작업 유형 → 에이전트 프로파일 라우팅 (ADR-134 Phase 7, D8).
 *
 * 오케스트레이터는 이미 역할별 provider 를 쓰지만 (Phase 6), 미구성 역할을 **조용히**
 * main 으로 내렸다. 사용자는 planner 를 설정했다고 믿는데 실제로는 main 이 계획을 세우는
 * 상황을 알 방법이 없었다. 라우터는 같은 내림을 하되 **무엇이 왜 내려갔는지 남긴다** —
 * 연결 상태 표시(`ConnectionStatus`)가 읽는 것이 이 기록이다.
 *
 * 내림 순서: 요청한 프로파일 → `main` → 구성된 아무 프로파일. 마지막까지 없으면 미구성.
 */
import {
  AGENT_PROFILE_IDS,
  isProfileConfigured,
  RESERVED_AGENT_PROFILE_IDS,
  type AgentProfileConfig,
  type AgentProfileId,
} from "../providers/AgentProfileRegistry";

/** 라우팅이 다루는 작업 유형. */
export type AgentTask = "plan" | "execute" | "verify" | "classify";

/** 작업 유형 → 1순위 프로파일. */
export const TASK_PROFILE: Readonly<Record<AgentTask, AgentProfileId>> = {
  plan: "planner",
  execute: "executor",
  verify: "verifier",
  classify: "fast",
};

export interface RoutingDecision {
  task: AgentTask;
  /** 실제로 쓰이는 프로파일. 미구성이면 null. */
  profileId: AgentProfileId | null;
  /** 1순위가 아니라 내려온 경우. */
  downgraded: boolean;
  /** 사용자에게 보여 줄 한 줄 (내림이 있을 때만). */
  notice?: string;
}

const LABEL: Readonly<Record<AgentProfileId, string>> = {
  main: "기본",
  planner: "계획",
  executor: "실행",
  verifier: "검증",
  fast: "분류",
  vision: "이미지",
};

export type ProfileLookup = (
  id: AgentProfileId,
) => AgentProfileConfig | undefined;

/** 작업 하나를 어느 프로파일로 보낼지 결정한다. */
export function routeTask(
  task: AgentTask,
  lookup: ProfileLookup,
): RoutingDecision {
  const preferred = TASK_PROFILE[task];
  if (isProfileConfigured(lookup(preferred))) {
    return { task, profileId: preferred, downgraded: false };
  }

  if (isProfileConfigured(lookup("main"))) {
    return {
      task,
      profileId: "main",
      downgraded: true,
      notice: `${LABEL[preferred]} 프로파일이 없어 기본 프로파일로 실행합니다.`,
    };
  }

  // 남은 아무 구성이라도 — 예약 프로파일(vision)은 제외.
  const fallback = AGENT_PROFILE_IDS.find(
    (id) =>
      !RESERVED_AGENT_PROFILE_IDS.includes(id) &&
      isProfileConfigured(lookup(id)),
  );
  if (fallback) {
    return {
      task,
      profileId: fallback,
      downgraded: true,
      notice: `${LABEL[preferred]} · 기본 프로파일이 없어 ${LABEL[fallback]} 프로파일로 실행합니다.`,
    };
  }

  return {
    task,
    profileId: null,
    downgraded: false,
    notice: "구성된 에이전트 프로파일이 없습니다. 설정에서 endpoint 와 모델을 지정하세요.",
  };
}

export interface RoutingReport {
  decisions: RoutingDecision[];
  /** 하나라도 실행 가능한가. */
  ready: boolean;
  /** 내림이 있는 작업들 — 상태 표시가 이것만 보여 준다. */
  notices: string[];
}

/** 네 작업이 각각 어디로 가는지 한눈에 — 연결 상태 UI 의 데이터 소스. */
export function describeRouting(lookup: ProfileLookup): RoutingReport {
  const decisions = (Object.keys(TASK_PROFILE) as AgentTask[]).map((task) =>
    routeTask(task, lookup),
  );
  return {
    decisions,
    ready: decisions.some((d) => d.profileId !== null),
    notices: [
      ...new Set(
        decisions
          .filter((d) => d.notice)
          .map((d) => d.notice as string),
      ),
    ],
  };
}

/** 로컬·사설망 endpoint 인가 — 폐쇄망 구성 여부를 상태 표시에 쓴다 (HC13 판정과 동형). */
export function isClosedNetworkProfile(
  config: AgentProfileConfig | undefined,
): boolean {
  if (!config?.baseUrl) return false;
  try {
    const host = new URL(config.baseUrl).hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local") ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    );
  } catch {
    return false;
  }
}
