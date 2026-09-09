/**
 * PROMPT_AUDIT_2026-09 D3 — planner · verifier 의 JSON 은 provider 가 지원하면 구조화 출력이
 * 보장하고, 그때는 프롬프트의 "JSON 만 출력" 줄을 싣지 않는다. OpenAI 호환 경로 (기본
 * 프리셋 local-ollama) 는 그 줄 + 텍스트 파서가 그대로 형식을 지킨다.
 */
import { describe, expect, it } from "vitest";
import { localizedStrings } from "@/i18n/translations";
import type { PromptTranslate } from "../promptTranslate";
import type {
  LLMCompletionOptions,
  LLMMessage,
  LLMProvider,
  LLMProviderId,
  LLMStreamEvent,
} from "../providers/LLMProvider";
import { PLAN_RESPONSE_SCHEMA, PlannerAgent } from "./PlannerAgent";
import { VERDICT_RESPONSE_SCHEMA, VerifierAgent } from "./VerifierAgent";

const tr: PromptTranslate = (key, params) => {
  const message = localizedStrings["ko-KR"][key];
  if (typeof message === "function") return message(params);
  return message ?? key;
};

interface Captured {
  messages: readonly LLMMessage[];
  options?: LLMCompletionOptions;
}

function capturing(id: LLMProviderId, reply: string) {
  const calls: Captured[] = [];
  const provider: LLMProvider & { calls: Captured[] } = {
    id,
    model: "m",
    calls,
    async *completeWithTools(
      messages: readonly LLMMessage[],
      options?: LLMCompletionOptions,
    ): AsyncGenerator<LLMStreamEvent> {
      calls.push({ messages, options });
      yield { type: "text-delta", delta: reply };
      yield { type: "stop", reason: "end" };
    },
  };
  return provider;
}

function systemOf(call: Captured): string {
  const system = call.messages.find((m) => m.role === "system");
  return system && "content" in system ? String(system.content) : "";
}

const PLAN = JSON.stringify({
  goal: "G",
  steps: [{ index: 1, instruction: "A", done: "D" }],
});

describe("planner 구조화 출력", () => {
  it("anthropic provider 에는 responseSchema 를 보내고 프롬프트에 'JSON 만' 줄을 싣지 않는다", async () => {
    const provider = capturing("anthropic", PLAN);
    const plan = await new PlannerAgent(provider, tr).plan("요청", "상태");
    expect(plan?.steps).toHaveLength(1);
    expect(provider.calls[0].options?.responseSchema).toBe(PLAN_RESPONSE_SCHEMA);
    expect(provider.calls[0].options?.toolChoice).toBe("none");
    expect(systemOf(provider.calls[0])).not.toContain("JSON 만");
  });

  it("openai 호환 provider 에는 responseSchema 없이 'JSON 만' 줄을 싣는다 (파서 폴백)", async () => {
    const provider = capturing("openai-compatible", PLAN);
    const plan = await new PlannerAgent(provider, tr).plan("요청", "상태");
    expect(plan?.steps).toHaveLength(1);
    expect(provider.calls[0].options?.responseSchema).toBeUndefined();
    expect(systemOf(provider.calls[0])).toContain("JSON 만 출력하세요");
  });

  it("스키마는 구조화 출력 지원 집합 안에 있다 — 모든 객체에 additionalProperties:false", () => {
    const walk = (node: unknown): void => {
      if (typeof node !== "object" || node === null) return;
      const obj = node as Record<string, unknown>;
      if (obj.type === "object") expect(obj.additionalProperties).toBe(false);
      expect(obj).not.toHaveProperty("maxItems");
      expect(obj).not.toHaveProperty("minItems");
      for (const value of Object.values(obj)) walk(value);
    };
    walk(PLAN_RESPONSE_SCHEMA);
    walk(VERDICT_RESPONSE_SCHEMA);
  });
});

describe("verifier 구조화 출력", () => {
  it("anthropic provider 에는 responseSchema 를 보내고 'JSON 만' 줄을 싣지 않는다", async () => {
    const provider = capturing("anthropic", '{"ok":false,"issues":["x"]}');
    const outcome = await new VerifierAgent(provider, tr).verify(
      { goal: "G", steps: [{ index: 1, instruction: "A" }] },
      ["1. ok"],
    );
    expect(outcome).toEqual({ ok: false, issues: ["x"] });
    expect(provider.calls[0].options?.responseSchema).toBe(
      VERDICT_RESPONSE_SCHEMA,
    );
    expect(systemOf(provider.calls[0])).not.toContain("JSON 만");
  });

  it("openai 호환 provider 에는 'JSON 만' 줄을 싣는다", async () => {
    const provider = capturing("openai-compatible", '{"ok":true}');
    await new VerifierAgent(provider, tr).verify(
      { goal: "G", steps: [{ index: 1, instruction: "A" }] },
      [],
    );
    expect(provider.calls[0].options?.responseSchema).toBeUndefined();
    expect(systemOf(provider.calls[0])).toContain("JSON 만 출력하세요");
  });
});
