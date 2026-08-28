/**
 * ADR-134 Phase 7 (D8) — 작업 유형 → 프로파일 라우팅.
 *
 * 요점은 "내려가는가" 가 아니라 **내려간 것이 기록에 남는가** 다. Phase 6 의 조용한 내림은
 * 사용자가 planner 를 설정했다고 믿는데 main 이 계획을 세우는 상황을 만들었다.
 */
import { describe, expect, it } from "vitest";
import type { AgentProfileConfig } from "../providers/AgentProfileRegistry";
import {
  describeRouting,
  isClosedNetworkProfile,
  routeTask,
  TASK_PROFILE,
  type AgentTask,
} from "./AgentProfileRouter";

const local = (model = "m"): AgentProfileConfig => ({
  provider: "openai-compatible",
  baseUrl: "http://localhost:11434/v1",
  model,
});

function lookupFrom(map: Record<string, AgentProfileConfig | undefined>) {
  return (id: string) => map[id];
}

describe("1순위 프로파일", () => {
  it.each(Object.entries(TASK_PROFILE) as Array<[AgentTask, string]>)(
    "%s → %s 프로파일",
    (task, profileId) => {
      const decision = routeTask(
        task,
        lookupFrom({ [profileId]: local() }) as never,
      );
      expect(decision.profileId).toBe(profileId);
      expect(decision.downgraded).toBe(false);
      expect(decision.notice).toBeUndefined();
    },
  );
});

describe("내림", () => {
  it("1순위가 없으면 main 으로 내려가고 사유를 남긴다", () => {
    const decision = routeTask("plan", lookupFrom({ main: local() }) as never);
    expect(decision.profileId).toBe("main");
    expect(decision.downgraded).toBe(true);
    expect(decision.notice).toContain("계획");
  });

  it("main 도 없으면 구성된 아무 프로파일로 내려간다", () => {
    const decision = routeTask(
      "plan",
      lookupFrom({ executor: local() }) as never,
    );
    expect(decision.profileId).toBe("executor");
    expect(decision.downgraded).toBe(true);
    expect(decision.notice).toContain("실행");
  });

  it("예약 프로파일(vision)로는 내려가지 않는다", () => {
    const decision = routeTask(
      "plan",
      lookupFrom({ vision: local() }) as never,
    );
    expect(decision.profileId).toBeNull();
  });

  it("모델이 비면 미구성으로 본다 (만료 id 하드코딩 재발 차단)", () => {
    const decision = routeTask(
      "plan",
      lookupFrom({ planner: local(""), main: local() }) as never,
    );
    expect(decision.profileId).toBe("main");
    expect(decision.downgraded).toBe(true);
  });

  it("아무것도 없으면 profileId 는 null + 설정 안내", () => {
    const decision = routeTask("execute", lookupFrom({}) as never);
    expect(decision.profileId).toBeNull();
    expect(decision.notice).toContain("설정");
  });
});

describe("라우팅 보고", () => {
  it("네 작업을 모두 담고 중복 안내는 한 번만 싣는다", () => {
    const report = describeRouting(lookupFrom({ main: local() }) as never);
    expect(report.decisions).toHaveLength(4);
    expect(report.ready).toBe(true);
    // plan/execute/verify/classify 가 전부 같은 사유로 내려가지만 문구는 작업마다 다르다
    expect(report.notices.length).toBe(4);
  });

  it("전부 구성돼 있으면 안내가 없다", () => {
    const report = describeRouting(
      lookupFrom({
        planner: local(),
        executor: local(),
        verifier: local(),
        fast: local(),
      }) as never,
    );
    expect(report.notices).toEqual([]);
    expect(report.ready).toBe(true);
  });

  it("아무 구성도 없으면 ready=false", () => {
    expect(describeRouting(lookupFrom({}) as never).ready).toBe(false);
  });
});

describe("폐쇄망 판정", () => {
  it.each([
    ["http://localhost:11434/v1", true],
    ["http://127.0.0.1:8080", true],
    ["http://192.168.0.10:11434/v1", true],
    ["http://10.1.2.3/v1", true],
    ["http://172.16.0.1/v1", true],
    ["http://gpu.local:11434/v1", true],
    ["https://api.openai.com/v1", false],
    ["https://api.anthropic.com", false],
    ["not a url", false],
  ])("%s → %s", (baseUrl, expected) => {
    expect(
      isClosedNetworkProfile({
        provider: "openai-compatible",
        baseUrl,
        model: "m",
      }),
    ).toBe(expected);
  });

  it("미구성은 폐쇄망이 아니다", () => {
    expect(isClosedNetworkProfile(undefined)).toBe(false);
  });
});
