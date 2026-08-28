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

const PLANNER_SYSTEM = `당신은 composition 웹 빌더의 설계 담당입니다.
사용자 요청을 실행 가능한 단계로 쪼개고, **JSON 만** 출력합니다.

형식:
{"goal": "요청 재진술", "steps": [{"index": 1, "instruction": "...", "done": "..."}]}

규칙:
- 각 단계는 한 번의 작업 묶음입니다 (요소 몇 개 생성 / 스타일 조정 / 데이터 연결).
- instruction 은 실행 담당이 그대로 읽고 도구를 부를 수 있을 만큼 구체적으로 씁니다.
- done 은 그 단계가 끝났는지 눈으로 확인할 수 있는 조건을 씁니다.
- 단순한 요청 (요소 하나 만들기 / prop 하나 바꾸기) 이면 steps 는 1개입니다.
- 단계는 최대 6개입니다. 설명이나 코드 블록 없이 JSON 만 출력하세요.

자주 쓰는 골격 (요청이 맞으면 출발점으로 쓰세요):
${formatTemplateHints()}`;

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
  constructor(private readonly provider: LLMProvider) {}

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
      { role: "system", content: PLANNER_SYSTEM },
      {
        role: "user",
        content: [
          `현재 빌더 상태:\n${builderSummary}`,
          history.length ? `\n직전 대화:\n${history.join("\n")}` : "",
          `\n요청:\n${request}`,
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
