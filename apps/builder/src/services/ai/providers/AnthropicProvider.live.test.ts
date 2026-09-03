/**
 * Anthropic wire live 게이트 — 실제 Claude API 에 2턴 (도구 호출 → 결과 replay) 을 보낸다.
 *
 * 단위 테스트 (`providers.test.ts`) 는 요청 본문의 **모양**만 잠근다. 이 파일은 그 모양을
 * Claude 5 계열이 실제로 받아 주는지 (400 없음 · thinking 블록 replay 수용 · `output_config.
 * effort` 수용) 를 확인한다 — 2026-09-03 Fable 5.1 레퍼런스 대조 fix 의 남은 근거.
 *
 * 키가 없으면 통째로 skip 한다. 키 출처 (우선순위): `ANTHROPIC_API_KEY` 환경변수 →
 * `apps/builder/.env` 의 같은 줄 (gitignore). 모델은 `ANTHROPIC_LIVE_MODEL` (기본
 * `claude-sonnet-5` — Claude 5 계열 중 가장 싸고 adaptive thinking 계약이 같다).
 *
 *   pnpm -F @composition/builder exec vitest run src/services/ai/providers/AnthropicProvider.live.test.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AnthropicProvider } from "./AnthropicProvider";
import type { LLMMessage, LLMStreamEvent } from "./LLMProvider";

function readKey(): string | undefined {
  const fromEnv = process.env.ANTHROPIC_API_KEY?.trim();
  if (fromEnv && !fromEnv.startsWith("your_")) return fromEnv;
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return undefined;
  const line = readFileSync(envPath, "utf8")
    .split("\n")
    .find((l) => l.startsWith("ANTHROPIC_API_KEY="));
  const value = line?.slice("ANTHROPIC_API_KEY=".length).trim();
  return value && !value.startsWith("your_") ? value : undefined;
}

const API_KEY = readKey();
const MODEL = process.env.ANTHROPIC_LIVE_MODEL ?? "claude-sonnet-5";

const TOOL = {
  name: "get_weather",
  description: "Returns the current weather for a city.",
  parameters: {
    type: "object",
    properties: { city: { type: "string" } },
    required: ["city"],
  },
};

async function collect(
  stream: AsyncGenerator<LLMStreamEvent>,
): Promise<LLMStreamEvent[]> {
  const events: LLMStreamEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

describe.skipIf(!API_KEY)(`Anthropic live (${MODEL})`, () => {
  it("도구 호출 턴의 원문 (thinking 포함) 을 replay 한 둘째 요청을 400 없이 받는다", async () => {
    const provider = new AnthropicProvider({
      baseUrl: "https://api.anthropic.com",
      model: MODEL,
      apiKey: API_KEY,
      allowRemoteDirect: true,
    });

    const history: LLMMessage[] = [
      {
        role: "system",
        content:
          "You are a test agent. When asked about weather, call the get_weather tool first, then answer in one short sentence.",
      },
      { role: "user", content: "What is the weather in Seoul right now?" },
    ];

    // 1턴 — effort 를 실어 output_config 수용 + 도구 호출 + assistantTurn 회수
    const first = await collect(
      provider.completeWithTools(history, {
        tools: [TOOL],
        toolChoice: "auto",
        reasoningEffort: "low",
        maxTokens: 4000,
      }),
    );
    const stop1 = first.at(-1);
    if (stop1?.type !== "stop") throw new Error("stop 이벤트 없음");
    expect(stop1.reason).toBe("tool-calls");
    expect(stop1.assistantTurn?.providerId).toBe("anthropic");
    expect(stop1.assistantTurn?.blocks.length).toBeGreaterThan(0);

    const call = first.find((e) => e.type === "tool-call");
    if (call?.type !== "tool-call") throw new Error("tool-call 없음");
    expect(call.call.name).toBe("get_weather");

    // 2턴 — 원문 그대로 replay + tool_result. thinking 블록이 빠졌다면 여기서 400 이다.
    history.push({
      role: "assistant",
      content: first
        .filter((e) => e.type === "text-delta")
        .map((e) => (e.type === "text-delta" ? e.delta : ""))
        .join(""),
      toolCalls: [call.call],
      providerContent: stop1.assistantTurn,
    });
    history.push({
      role: "tool",
      toolCallId: call.call.id,
      content: JSON.stringify({ city: "Seoul", condition: "sunny", tempC: 25 }),
    });

    const second = await collect(
      provider.completeWithTools(history, {
        tools: [TOOL],
        toolChoice: "auto",
        reasoningEffort: "low",
        maxTokens: 4000,
      }),
    );
    const stop2 = second.at(-1);
    if (stop2?.type !== "stop") throw new Error("stop 이벤트 없음");
    expect(stop2.reason).toBe("end");
    const answer = second
      .filter((e) => e.type === "text-delta")
      .map((e) => (e.type === "text-delta" ? e.delta : ""))
      .join("");
    expect(answer.toLowerCase()).toMatch(/sunny|25/);
  }, 120_000);
});
