/**
 * Verify 서브에이전트 (ADR-134 Phase 6, D7) — verifier 프로파일.
 *
 * 실행 결과가 원래 요청대로인지 본다. 도구는 주지 않는다 — 검증기가 캔버스를 고치기
 * 시작하면 실행기와 구분이 사라지고, 수리 횟수 상한도 의미를 잃는다. 고치는 것은
 * 오케스트레이터가 실행기에게 다시 시킨다 (bounded repair).
 */
import type { LLMMessage, LLMProvider } from "../providers/LLMProvider";
import type { AgentPlan, VerifyOutcome } from "./types";
import type { PromptTranslate } from "../promptTranslate";
import { supportsStructuredOutput } from "./PlannerAgent";

/** 구조화 출력 스키마 (PROMPT_AUDIT_2026-09 D3) — PlannerAgent 의 스키마와 같은 규약. */
export const VERDICT_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    issues: { type: "array", items: { type: "string" } },
  },
  required: ["ok", "issues"],
  additionalProperties: false,
};

const verifierSystem = (
  t: PromptTranslate,
  structured: boolean,
): string => `${t("aiVerify.role")}

${t("aiVerify.shape")}

${t("aiVerify.rulesHeading")}
${t("aiVerify.rule1")}
${t("aiVerify.rule2")}
${t("aiVerify.rule3")}${structured ? "" : `\n${t("aiVerify.rule4")}`}`;

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
  constructor(
    private readonly provider: LLMProvider,
    /** 프롬프트 문장 해소기 (ADR-200 후속). */
    private readonly t: PromptTranslate,
  ) {}

  async verify(
    plan: AgentPlan,
    executionLog: readonly string[],
    signal?: AbortSignal,
  ): Promise<VerifyOutcome> {
    const structured = supportsStructuredOutput(this.provider);
    const messages: LLMMessage[] = [
      { role: "system", content: verifierSystem(this.t, structured) },
      {
        role: "user",
        content: [
          this.t("aiVerify.goal", { goal: plan.goal }),
          "",
          this.t("aiVerify.planHeading"),
          ...plan.steps.map(
            (s) =>
              `${s.index}. ${s.instruction}${s.done ? this.t("aiVerify.stepDone", { done: s.done }) : ""}`,
          ),
          "",
          this.t("aiVerify.logHeading"),
          ...executionLog,
        ].join("\n"),
      },
    ];

    let text = "";
    for await (const event of this.provider.completeWithTools(messages, {
      toolChoice: "none",
      signal,
      ...(structured ? { responseSchema: VERDICT_RESPONSE_SCHEMA } : {}),
    })) {
      if (event.type === "text-delta") text += event.delta;
    }
    return parseVerdict(text);
  }
}
