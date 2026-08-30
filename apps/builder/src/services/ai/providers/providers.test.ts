/**
 * ADR-134 G1 — 2-way 어댑터 + 프로파일 레지스트리.
 *
 * oracle 은 **wire 포맷** 이다: 중립 메시지·도구가 각 provider 가 실제로 요구하는 형태로
 * 나가고, 각자의 스트리밍 조각이 같은 `LLMStreamEvent` 로 돌아오는지 본다. 네트워크는
 * `fetchImpl` 주입으로 대체한다 (키 0, 외부 호출 0).
 *
 * "기존 7개 도구 시그니처 보존" 은 `getToolDefinitions(tr)` 의 실제 산출물을 그대로 실어
 * 확인한다 — 도구 파일을 고치지 않고 통합 인터페이스를 지나는지가 G1 조건이다.
 */
import { describe, expect, it, vi } from "vitest";
import { getToolDefinitions } from "../tools";
import {
  isRateLimitError,
  LLMProviderError,
  type LLMMessage,
  type LLMStreamEvent,
  type LLMToolDefinition,
} from "./LLMProvider";
import { AnthropicProvider, toAnthropicMessages } from "./AnthropicProvider";
import { OpenAICompatibleProvider } from "./OpenAICompatibleProvider";
import {
  AGENT_PROFILE_IDS,
  AGENT_PROFILE_PRESETS,
  createAgentProfileRegistry,
  isProfileConfigured,
} from "./AgentProfileRegistry";
import { localizedStrings } from "@/i18n/translations";
import type { PromptTranslate } from "../promptTranslate";

function sseResponse(events: unknown[]): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

/** 요청 본문을 붙잡는 fetch 대역. */
function captureFetch(response: () => Response) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return response();
    },
  ) as unknown as typeof fetch;
  return { impl, calls, body: () => JSON.parse(String(calls[0]?.init.body)) };
}

async function collect(
  stream: AsyncGenerator<LLMStreamEvent>,
): Promise<LLMStreamEvent[]> {
  const out: LLMStreamEvent[] = [];
  for await (const event of stream) out.push(event);
  return out;
}

const MESSAGES: LLMMessage[] = [
  { role: "system", content: "you are a builder agent" },
  { role: "user", content: "버튼 3개를 왼쪽 정렬해줘" },
  {
    role: "assistant",
    content: null,
    toolCalls: [
      { id: "call_1", name: "run_command", arguments: '{"id":"alignLeft"}' },
    ],
  },
  { role: "tool", toolCallId: "call_1", content: '{"status":"ok"}' },
  { role: "tool", toolCallId: "call_2", content: '{"status":"ok"}' },
];

const TOOL: LLMToolDefinition = {
  name: "run_command",
  description: "빌더 명령 실행",
  parameters: { type: "object", properties: { id: { type: "string" } } },
};

/** ko-KR 카탈로그에 묶은 해소기 (ADR-200 후속). */
const tr: PromptTranslate = (key, params) => {
  const message = localizedStrings["ko-KR"][key];
  if (typeof message === "function") return message(params);
  return message ?? key;
};

describe("OpenAI 호환 어댑터", () => {
  it("텍스트 델타 + 여러 조각으로 오는 도구 인자를 조립한다", async () => {
    const { impl } = captureFetch(() =>
      sseResponse([
        { choices: [{ delta: { content: "정렬" } }] },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_9",
                    function: { name: "run_command", arguments: '{"id":' },
                  },
                ],
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, function: { arguments: '"alignLeft"}' } },
                ],
              },
            },
          ],
        },
        { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
      ]),
    );
    const provider = new OpenAICompatibleProvider({
      baseUrl: "http://localhost:11434/v1",
      model: "qwen3:14b",
      fetchImpl: impl,
    });

    const events = await collect(
      provider.completeWithTools(MESSAGES, { tools: [TOOL] }),
    );

    expect(events).toEqual([
      { type: "text-delta", delta: "정렬" },
      {
        type: "tool-call",
        call: {
          id: "call_9",
          name: "run_command",
          arguments: '{"id":"alignLeft"}',
        },
      },
      { type: "stop", reason: "tool-calls" },
    ]);
  });

  it("요청은 chat/completions 로 가고 system 은 메시지 배열에 남는다", async () => {
    const capture = captureFetch(() =>
      sseResponse([{ choices: [{ finish_reason: "stop" }] }]),
    );
    const provider = new OpenAICompatibleProvider({
      baseUrl: "http://localhost:11434/v1/",
      model: "qwen3:14b",
      apiKey: "sk-local",
      fetchImpl: capture.impl,
    });

    await collect(provider.completeWithTools(MESSAGES, { tools: [TOOL] }));

    expect(capture.calls[0].url).toBe(
      "http://localhost:11434/v1/chat/completions",
    );
    const body = capture.body();
    expect(body.messages[0]).toEqual({
      role: "system",
      content: "you are a builder agent",
    });
    expect(body.messages[3]).toEqual({
      role: "tool",
      content: '{"status":"ok"}',
      tool_call_id: "call_1",
    });
    expect(body.tools[0].function.name).toBe("run_command");
    expect(body.stream).toBe(true);
    const headers = capture.calls[0].init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer sk-local");
  });

  it("키 없는 로컬 endpoint 는 authorization 헤더를 붙이지 않는다", async () => {
    const capture = captureFetch(() =>
      sseResponse([{ choices: [{ finish_reason: "stop" }] }]),
    );
    const provider = new OpenAICompatibleProvider({
      baseUrl: "http://localhost:11434/v1",
      model: "qwen3:14b",
      fetchImpl: capture.impl,
    });

    await collect(provider.completeWithTools(MESSAGES));

    const headers = capture.calls[0].init.headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });

  it("429 는 status 를 보존한 LLMProviderError", async () => {
    const impl = vi.fn(
      async () => new Response("rate limit", { status: 429 }),
    ) as unknown as typeof fetch;
    const provider = new OpenAICompatibleProvider({
      baseUrl: "http://localhost:9/v1",
      model: "m",
      fetchImpl: impl,
    });

    const error = await collect(provider.completeWithTools(MESSAGES)).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(LLMProviderError);
    expect((error as LLMProviderError).status).toBe(429);
    expect(isRateLimitError(error)).toBe(true);
  });
});

describe("Anthropic 어댑터", () => {
  it("system 은 최상위로, 연속 tool 결과는 user 메시지 하나로 합친다", () => {
    const { system, messages } = toAnthropicMessages(MESSAGES);

    expect(system).toBe("you are a builder agent");
    expect(messages).toHaveLength(3);
    expect(messages[1]).toEqual({
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: "call_1",
          name: "run_command",
          input: { id: "alignLeft" },
        },
      ],
    });
    expect(messages[2].role).toBe("user");
    expect(messages[2].content).toHaveLength(2);
    expect(messages[2].content[0]).toMatchObject({
      type: "tool_result",
      tool_use_id: "call_1",
    });
  });

  it("input_json_delta 조각을 모아 같은 LLMStreamEvent 로 돌려준다", async () => {
    const capture = captureFetch(() =>
      sseResponse([
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "정렬" },
        },
        {
          type: "content_block_start",
          index: 1,
          content_block: {
            type: "tool_use",
            id: "toolu_1",
            name: "run_command",
          },
        },
        {
          type: "content_block_delta",
          index: 1,
          delta: { type: "input_json_delta", partial_json: '{"id":' },
        },
        {
          type: "content_block_delta",
          index: 1,
          delta: { type: "input_json_delta", partial_json: '"alignLeft"}' },
        },
        { type: "message_delta", delta: { stop_reason: "tool_use" } },
      ]),
    );
    const provider = new AnthropicProvider({
      baseUrl: "https://api.anthropic.com",
      model: "claude-sonnet-5",
      allowRemoteDirect: true,
      apiKey: "sk-ant-test",
      fetchImpl: capture.impl,
    });

    const events = await collect(
      provider.completeWithTools(MESSAGES, {
        tools: [TOOL],
        reasoningEffort: "low",
      }),
    );

    expect(events).toEqual([
      { type: "text-delta", delta: "정렬" },
      {
        type: "tool-call",
        call: {
          id: "toolu_1",
          name: "run_command",
          arguments: '{"id":"alignLeft"}',
        },
      },
      { type: "stop", reason: "tool-calls" },
    ]);

    expect(capture.calls[0].url).toBe("https://api.anthropic.com/v1/messages");
    const body = capture.body();
    expect(body.system).toBe("you are a builder agent");
    expect(body.tools[0]).toMatchObject({
      name: "run_command",
      input_schema: TOOL.parameters,
    });
    expect(body.thinking).toEqual({ type: "enabled", budget_tokens: 1024 });
    const headers = capture.calls[0].init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-ant-test");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
  });

  it("브라우저 우회 헤더를 스스로 붙이지 않는다 (Phase 2 D10 결정 대상)", async () => {
    const capture = captureFetch(() => sseResponse([]));
    const provider = new AnthropicProvider({
      baseUrl: "https://api.anthropic.com",
      model: "claude-sonnet-5",
      allowRemoteDirect: true,
      fetchImpl: capture.impl,
    });

    await collect(provider.completeWithTools(MESSAGES));

    const headers = capture.calls[0].init.headers as Record<string, string>;
    expect(Object.keys(headers).some((k) => k.includes("dangerous"))).toBe(
      false,
    );
  });
});

describe("기존 도구 시그니처 보존 (G1)", () => {
  it("도구 10종이 이름·스키마 그대로 두 어댑터의 요청 본문에 실린다", async () => {
    const definitions = await getToolDefinitions(tr);
    // Phase 2 부터 `getToolDefinitions(tr)` 자체가 provider 중립 형태다
    const neutral: LLMToolDefinition[] = definitions.map((d) => ({ ...d }));
    expect(neutral).toHaveLength(10);

    const openai = captureFetch(() => sseResponse([]));
    await collect(
      new OpenAICompatibleProvider({
        baseUrl: "http://localhost:11434/v1",
        model: "m",
        fetchImpl: openai.impl,
      }).completeWithTools(MESSAGES, { tools: neutral }),
    );

    const anthropic = captureFetch(() => sseResponse([]));
    await collect(
      new AnthropicProvider({
        baseUrl: "https://api.anthropic.com",
        model: "claude-sonnet-5",
        allowRemoteDirect: true,
        fetchImpl: anthropic.impl,
      }).completeWithTools(MESSAGES, { tools: neutral }),
    );

    const openaiNames = openai
      .body()
      .tools.map((t: { function: { name: string } }) => t.function.name);
    const anthropicNames = anthropic
      .body()
      .tools.map((t: { name: string }) => t.name);

    expect(openaiNames).toEqual(neutral.map((t) => t.name));
    expect(anthropicNames).toEqual(neutral.map((t) => t.name));
    expect(openaiNames).toContain("run_command");
    expect(anthropic.body().tools[0].input_schema).toEqual(
      neutral[0].parameters,
    );
  });
});

describe("에이전트 프로파일 레지스트리", () => {
  it("Ollama 는 전용 어댑터 없이 OpenAI 호환 + baseUrl 로 통과한다", () => {
    const registry = createAgentProfileRegistry();
    registry.applyPreset("local-ollama");
    registry.set("main", {
      provider: "openai-compatible",
      baseUrl: "http://localhost:11434/v1",
      model: "qwen3:14b",
    });

    const provider = registry.createProvider("main");
    expect(provider).toBeInstanceOf(OpenAICompatibleProvider);
    expect(provider?.id).toBe("openai-compatible");
    expect(provider?.model).toBe("qwen3:14b");
  });

  it("모델이 비어 있는 프로파일은 미구성 — provider 를 만들지 않는다", () => {
    const registry = createAgentProfileRegistry();
    registry.applyPreset("openai");

    expect(registry.configuredIds()).toEqual([]);
    expect(registry.createProvider("main")).toBeUndefined();
  });

  it("anthropic 프리셋은 5개 프로파일을 구성하고 vision 은 예약으로 남는다", () => {
    const registry = createAgentProfileRegistry();
    registry.applyPreset("anthropic");

    expect(registry.configuredIds()).toEqual([
      "main",
      "planner",
      "executor",
      "verifier",
      "fast",
    ]);
    expect(registry.get("vision")).toBeUndefined();
    expect(registry.createProvider("planner")).toBeInstanceOf(
      AnthropicProvider,
    );
    expect(registry.get("planner")?.reasoningEffort).toBe("high");
  });

  it("프로파일은 키 값을 담지 않는다 — credentialRef 는 이름뿐", () => {
    const registry = createAgentProfileRegistry();
    registry.applyPreset("anthropic");
    registry.createProvider("main", { apiKey: "sk-ant-secret" });

    const serialized = JSON.stringify(registry.toJSON());
    expect(serialized).not.toContain("sk-ant-secret");
    expect(registry.get("main")?.credentialRef).toBe("ANTHROPIC_API_KEY");
  });

  it("직렬화 왕복으로 사용자 설정이 보존된다", () => {
    const registry = createAgentProfileRegistry();
    registry.applyPreset("local-ollama");
    registry.set("fast", {
      provider: "openai-compatible",
      baseUrl: "http://gateway.internal/v1",
      model: "internal-small",
      credentialRef: "GATEWAY_TOKEN",
    });

    const restored = createAgentProfileRegistry();
    restored.load(JSON.parse(JSON.stringify(registry.toJSON())));

    expect(restored.get("fast")).toEqual(registry.get("fast"));
    expect(restored.createProvider("fast")?.model).toBe("internal-small");
  });

  it("프리셋 3종 전부 예약 프로파일을 채우지 않고 provider 종류가 정합", () => {
    for (const preset of ["anthropic", "openai", "local-ollama"] as const) {
      const map = AGENT_PROFILE_PRESETS[preset];
      expect(map.vision).toBeUndefined();
      for (const id of AGENT_PROFILE_IDS) {
        const config = map[id];
        if (!config) continue;
        expect(config.provider).toBe(
          preset === "anthropic" ? "anthropic" : "openai-compatible",
        );
        expect(config.baseUrl).not.toBe("");
        // 미구성 판정은 model 하나로 결정된다
        expect(isProfileConfigured(config)).toBe(config.model !== "");
      }
    }
  });
});
