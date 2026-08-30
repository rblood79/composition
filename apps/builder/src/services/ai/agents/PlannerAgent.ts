/**
 * Plan 서브에이전트 (ADR-134 Phase 6, D7) — planner 프로파일.
 *
 * 자연어 요청을 **실행 가능한 단계 목록**으로 쪼갠다. 도구는 주지 않는다 — 계획 단계에서
 * 캔버스를 건드리면 실행/검증의 경계가 무너진다.
 *
 * 단계가 1개 이하로 나오면 오케스트레이터가 분해를 건너뛴다. "버튼 색 바꿔줘" 에 계획과
 * 검증을 붙이는 것은 비용만 늘린다.
 */
import type { LLMMessage, LLMProvider } from "../providers/LLMProvider";
import { formatTemplateHints } from "../templates/layoutTemplates";
import type { AgentPlan, PlanStep } from "./types";
import type { PromptTranslate } from "../promptTranslate";

const plannerSystem = (
  t: PromptTranslate,
): string => `${t("aiAgent.plannerRole")}

${t("aiAgent.plannerFormat")}
${t("aiAgent.plannerShape")}

${t("aiAgent.plannerRulesHeading")}
${t("aiAgent.plannerRule1")}
${t("aiAgent.plannerRule2")}
${t("aiAgent.plannerRule3")}
${t("aiAgent.plannerRule4")}
${t("aiAgent.plannerRule5")}

${t("aiAgent.plannerTemplates")}
${formatTemplateHints(t)}`;

/** 모델 출력에서 JSON 을 건져 낸다 — 코드 펜스·앞뒤 산문에 견딘다. */
export function parsePlan(raw: string): AgentPlan | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as { goal?: unknown; steps?: unknown };
  if (!Array.isArray(obj.steps)) return null;

  const steps: PlanStep[] = [];
  for (const [i, raw] of obj.steps.entries()) {
    if (typeof raw !== "object" || raw === null) continue;
    const step = raw as { instruction?: unknown; done?: unknown };
    if (typeof step.instruction !== "string" || !step.instruction.trim()) {
      continue;
    }
    steps.push({
      index: i + 1,
      instruction: step.instruction.trim(),
      ...(typeof step.done === "string" && step.done
        ? { done: step.done }
        : {}),
    });
  }

  if (steps.length === 0) return null;
  return {
    goal: typeof obj.goal === "string" && obj.goal ? obj.goal : "",
    steps: steps.slice(0, 6),
  };
}

export class PlannerAgent {
  constructor(
    private readonly provider: LLMProvider,
    /** 프롬프트 문장 해소기 (ADR-200 후속). */
    private readonly t: PromptTranslate,
  ) {}

  /** 계획을 세운다. 모델이 JSON 을 못 내면 `null` — 호출자가 단일 실행으로 내린다. */
  async plan(
    request: string,
    builderSummary: string,
    /**
     * 직전 대화 몇 줄. "아니 그거 말고" 같은 후속 요청은 이것 없이는 계획이 안 선다 —
     * 실행 담당은 단계 지시만 받으므로 문맥은 여기서 흡수해야 한다.
     */
    history: readonly string[] = [],
    signal?: AbortSignal,
  ): Promise<AgentPlan | null> {
    const messages: LLMMessage[] = [
      { role: "system", content: plannerSystem(this.t) },
      {
        role: "user",
        content: [
          `${this.t("aiTurn.stateHeading")}\n${builderSummary}`,
          history.length
            ? `\n${this.t("aiTurn.historyHeading")}\n${history.join("\n")}`
            : "",
          `\n${this.t("aiTurn.requestHeading")}\n${request}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ];

    let text = "";
    for await (const event of this.provider.completeWithTools(messages, {
      toolChoice: "none",
      signal,
    })) {
      if (event.type === "text-delta") text += event.delta;
    }
    return parsePlan(text);
  }
}
