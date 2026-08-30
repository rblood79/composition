import { describe, expect, it } from "vitest";
import {
  initialProgress,
  reduceProgress,
  type AgentProgress,
} from "./agentProgress";
import type { OrchestratedEvent } from "../../../../services/ai/agents/orchestrator";

function run(events: OrchestratedEvent[]): AgentProgress {
  return events.reduce(reduceProgress, initialProgress());
}

describe("에이전트 진행 상태", () => {
  it("계획이 나오면 단계를 담는다", () => {
    const progress = run([
      { type: "agent-start", agent: "planner", label: "계획" },
      {
        type: "plan-ready",
        plan: {
          goal: "제목이 있는 프레임",
          steps: [
            { index: 1, instruction: "frame 생성", done: "frame 1개" },
            { index: 2, instruction: "Heading 추가", done: "Heading 1개" },
          ],
        },
      },
    ] as OrchestratedEvent[]);

    expect(progress.plan?.goal).toBe("제목이 있는 프레임");
    expect(progress.plan?.steps).toHaveLength(2);
  });

  it("역할별 진행이 시작/종료로 갱신된다", () => {
    const progress = run([
      { type: "agent-start", agent: "planner", label: "계획" },
      { type: "agent-end", agent: "planner", ok: true, summary: "2단계" },
      { type: "agent-start", agent: "executor", label: "실행" },
    ] as OrchestratedEvent[]);

    expect(progress.agents.map((a) => [a.agent, a.status])).toEqual([
      ["planner", "done"],
      ["executor", "running"],
    ]);
    expect(progress.agents[0].summary).toBe("2단계");
  });

  it("수리 시도를 셈한다 — 자기 수정이 일어났음을 보여준다", () => {
    const progress = run([
      {
        type: "repair-attempt",
        attempt: 1,
        max: 2,
        issues: ["Heading 이 비었다"],
      },
    ] as OrchestratedEvent[]);

    expect(progress.repairs).toHaveLength(1);
    expect(progress.repairs[0].issues).toEqual(["Heading 이 비었다"]);
  });

  it("분해 실행이 아니면 표시할 진행이 없다", () => {
    const progress = run([
      { type: "text-delta", content: "안녕" },
    ] as OrchestratedEvent[]);

    expect(progress.plan).toBeNull();
    expect(progress.agents).toEqual([]);
    expect(progress.repairs).toEqual([]);
  });
});
