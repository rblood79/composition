/**
 * ADR-134 Phase 6 — Plan → Execute → Verify 오케스트레이션.
 *
 * 확인하는 것 세 가지:
 * 1. 역할마다 **자기 프로파일의 provider** 로 호출되는가 (분해의 목적이 이것이다).
 * 2. 단순 요청은 분해하지 않는가 (계획·검증 호출을 붙이지 않는다).
 * 3. 수리가 상한(2회)에서 멈추는가 — 무한 수리는 사용자 캔버스를 계속 바꾼다.
 */
import { describe, expect, it, vi } from "vitest";
import type { LLMProvider, LLMStreamEvent } from "../providers/LLMProvider";
import type { BuilderContext } from "../../../types/integrations/chat.types";
import { MAX_REPAIR_ATTEMPTS, Orchestrator } from "./orchestrator";
import type { AgentRole } from "./types";

vi.mock("../../../lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/db")>();
  const table = new Proxy(() => Promise.resolve([]), {
    get: (_t, prop) =>
      prop === "then" ? undefined : () => Promise.resolve([]),
    apply: () => Promise.resolve([]),
  });
  const noop = new Proxy(
    {},
    { get: (_t, p) => (p === "then" ? undefined : table) },
  );
  return { ...actual, getDB: vi.fn(async () => noop) };
});

const CONTEXT: BuilderContext = {
  currentPageId: "page-1",
  elements: [{ id: "b1", type: "Button" }],
} as BuilderContext;

/** 대본대로 응답하는 가짜 provider. 호출 횟수를 센다. */
function scripted(
  id: string,
  replies: string[],
): LLMProvider & { calls: number } {
  let turn = 0;
  const provider = {
    id: "openai-compatible" as const,
    model: id,
    calls: 0,
    async *completeWithTools(): AsyncGenerator<LLMStreamEvent> {
      provider.calls++;
      const reply = replies[Math.min(turn, replies.length - 1)] ?? "";
      turn++;
      yield { type: "text-delta", delta: reply };
      yield { type: "stop", reason: "end" };
    },
  };
  return provider;
}

const TWO_STEP_PLAN = JSON.stringify({
  goal: "대시보드 만들기",
  steps: [
    { index: 1, instruction: "frame 을 만든다", done: "frame 1개" },
    { index: 2, instruction: "Heading 을 넣는다", done: "제목 보임" },
  ],
});

function build(overrides: Partial<Record<AgentRole, LLMProvider>> = {}) {
  const planner = scripted("planner", [TWO_STEP_PLAN]);
  const executor = scripted("executor", ["했습니다."]);
  const verifier = scripted("verifier", ['{"ok": true}']);
  const map: Record<AgentRole, LLMProvider> = {
    planner: overrides.planner ?? planner,
    executor: overrides.executor ?? executor,
    verifier: overrides.verifier ?? verifier,
  };
  const orchestrator = new Orchestrator({
    resolve: (role) => map[role],
    fallback: map.executor,
  });
  return { orchestrator, planner, executor, verifier, map };
}

async function collect(gen: AsyncGenerator<unknown>) {
  const events: Array<Record<string, unknown>> = [];
  for await (const e of gen) events.push(e as Record<string, unknown>);
  return events;
}

describe("역할별 프로파일 라우팅", () => {
  it("planner / executor / verifier 가 각자 provider 로 호출된다", async () => {
    const { orchestrator, planner, executor, verifier } = build();
    const events = await collect(
      orchestrator.run("대시보드 만들어줘", CONTEXT),
    );

    expect(planner.calls).toBe(1);
    expect(executor.calls).toBeGreaterThanOrEqual(2); // 단계 2개
    expect(verifier.calls).toBe(1);

    const roles = events
      .filter((e) => e.type === "agent-start")
      .map((e) => e.agent);
    expect(roles).toEqual(["planner", "executor", "verifier"]);
  });

  it("계획이 나오면 plan-ready 로 단계를 알린다", async () => {
    const { orchestrator } = build();
    const events = await collect(
      orchestrator.run("대시보드 만들어줘", CONTEXT),
    );
    const ready = events.find((e) => e.type === "plan-ready");
    expect((ready?.plan as { steps: unknown[] })?.steps).toHaveLength(2);
  });

  it("역할 프로파일이 없으면 fallback 으로 내려간다", async () => {
    const only = scripted("main", ["했습니다."]);
    const orchestrator = new Orchestrator({
      resolve: () => undefined,
      fallback: only,
    });
    const events = await collect(orchestrator.run("버튼 만들어줘", CONTEXT));
    expect(only.calls).toBeGreaterThanOrEqual(1);
    expect(
      events.some((e) => e.type === "agent-start" && e.agent === "executor"),
    ).toBe(true);
  });
});

describe("단순 요청은 분해하지 않는다", () => {
  it("계획이 1단계면 검증을 부르지 않는다", async () => {
    const planner = scripted("planner", [
      JSON.stringify({
        goal: "색 변경",
        steps: [{ instruction: "variant 를 바꾼다" }],
      }),
    ]);
    const { orchestrator, verifier } = build({ planner });
    const events = await collect(orchestrator.run("버튼 색 바꿔줘", CONTEXT));

    expect(verifier.calls).toBe(0);
    expect(events.some((e) => e.type === "plan-ready")).toBe(false);
  });

  it("planner 가 JSON 을 못 내면 요청 그대로 실행한다", async () => {
    const planner = scripted("planner", ["음... 잘 모르겠네요"]);
    const { orchestrator, executor, verifier } = build({ planner });
    const events = await collect(orchestrator.run("버튼 만들어줘", CONTEXT));

    expect(executor.calls).toBeGreaterThanOrEqual(1);
    expect(verifier.calls).toBe(0);
    expect(
      events.find((e) => e.type === "agent-end" && e.agent === "planner")?.ok,
    ).toBe(false);
  });
});

describe("bounded repair", () => {
  it("검증이 계속 실패해도 2회에서 멈춘다", async () => {
    const verifier = scripted("verifier", [
      JSON.stringify({ ok: false, issues: ["제목이 없습니다"] }),
    ]);
    const { orchestrator } = build({ verifier });
    const events = await collect(
      orchestrator.run("대시보드 만들어줘", CONTEXT),
    );

    const repairs = events.filter((e) => e.type === "repair-attempt");
    expect(repairs).toHaveLength(MAX_REPAIR_ATTEMPTS);
    expect(repairs.map((r) => r.attempt)).toEqual([1, 2]);
    expect(verifier.calls).toBe(MAX_REPAIR_ATTEMPTS + 1);

    // 상한에 닿으면 남은 문제를 사람에게 넘긴다
    const final = events.at(-1);
    expect(final?.type).toBe("final");
    expect(String(final?.content)).toContain("제목이 없습니다");
  });

  it("검증이 통과하면 수리하지 않는다", async () => {
    const { orchestrator } = build();
    const events = await collect(
      orchestrator.run("대시보드 만들어줘", CONTEXT),
    );
    expect(events.filter((e) => e.type === "repair-attempt")).toHaveLength(0);
  });

  it("수리 지시에 지적 사항이 실려 간다", async () => {
    const seen: string[] = [];
    const executor = {
      id: "openai-compatible" as const,
      model: "executor",
      calls: 0,
      async *completeWithTools(
        messages: readonly { role: string; content?: unknown }[],
      ) {
        const user = messages.find((m) => m.role === "user");
        if (typeof user?.content === "string") seen.push(user.content);
        yield { type: "text-delta" as const, delta: "ok" };
        yield { type: "stop" as const, reason: "end" as const };
      },
    } as unknown as LLMProvider;
    const verifier = scripted("verifier", [
      JSON.stringify({ ok: false, issues: ["Heading 이 빠졌습니다"] }),
    ]);
    const { orchestrator } = build({ executor, verifier });
    await collect(orchestrator.run("대시보드 만들어줘", CONTEXT));

    expect(seen.some((s) => s.includes("Heading 이 빠졌습니다"))).toBe(true);
  });
});
