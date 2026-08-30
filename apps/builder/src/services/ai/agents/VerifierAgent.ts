/**
 * Verify 서브에이전트 (ADR-134 Phase 6, D7) — verifier 프로파일.
 *
 * 실행 결과가 원래 요청대로인지 본다. 도구는 주지 않는다 — 검증기가 캔버스를 고치기
 * 시작하면 실행기와 구분이 사라지고, 수리 횟수 상한도 의미를 잃는다. 고치는 것은
 * 오케스트레이터가 실행기에게 다시 시킨다 (bounded repair).
 */
import type { LLMMessage, LLMProvider } from "../providers/LLMProvider";
import type { AgentPlan, VerifyOutcome } from "./types";

const VERIFIER_SYSTEM = `당신은 composition 웹 빌더의 검증 담당입니다.
계획과 실행 기록을 보고 요청이 실제로 이행됐는지 판정하고 **JSON 만** 출력합니다.

형식: {"ok": true} 또는 {"ok": false, "issues": ["무엇이 어긋났는지", "..."]}

규칙:
- 계획의 done 조건을 기준으로 봅니다.
- issues 는 실행 담당이 바로 고칠 수 있게 구체적으로 씁니다 (무엇을 어떻게).
- 확신이 없으면 ok: true 로 둡니다 — 불필요한 재시도가 사용자 작업을 되돌릴 수 있습니다.
- 설명이나 코드 블록 없이 JSON 만 출력하세요.`;

export function parseVerdict(raw: string): VerifyOutcome {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return { ok: true, issues: [] };

  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as {
      ok?: unknown;
      issues?: unknown;
    };
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.filter((i): i is string => typeof i === "string")
      : [];
    // ok 가 명시적으로 false 일 때만 실패로 본다 — 판정 불명은 통과 (위 규칙과 동형).
    return {
      ok: parsed.ok !== false,
      issues: parsed.ok === false ? issues : [],
    };
  } catch {
    return { ok: true, issues: [] };
  }
}

export class VerifierAgent {
  constructor(private readonly provider: LLMProvider) {}

  async verify(
    plan: AgentPlan,
    executionLog: readonly string[],
    signal?: AbortSignal,
  ): Promise<VerifyOutcome> {
    const messages: LLMMessage[] = [
      { role: "system", content: VERIFIER_SYSTEM },
      {
        role: "user",
        content: [
          `목표: ${plan.goal}`,
          "",
          "계획:",
          ...plan.steps.map(
            (s) =>
              `${s.index}. ${s.instruction}${s.done ? ` (완료 조건: ${s.done})` : ""}`,
          ),
          "",
          "실행 기록:",
          ...executionLog,
        ].join("\n"),
      },
    ];

    let text = "";
    for await (const event of this.provider.completeWithTools(messages, {
      toolChoice: "none",
      signal,
    })) {
      if (event.type === "text-delta") text += event.delta;
    }
    return parseVerdict(text);
  }
}
