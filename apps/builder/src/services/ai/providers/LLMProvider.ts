/**
 * LLM Provider 인터페이스 (ADR-134 Phase 1, D1).
 *
 * 하나의 통합 시그니처 `completeWithTools(messages, options)` 로 provider 를 가린다 —
 * 도구 정의는 JSON Schema 그대로 받고 (MCP tool schema 호환, D11), wire 포맷 변환은
 * 각 어댑터가 한다. Agent Loop 은 이 인터페이스만 보고, 어느 provider 인지 모른다.
 *
 * 설계 근거 (Phase 0 실측): `types/integrations/ai.types.ts` 의 `AIAgentProvider` 는
 * 소비자 0 인 dormant 타입이었다 — Agent Loop 이 구현체 팩토리를 직접 부르고 있었다.
 * 그래서 Phase 1 은 "추상화 신설" 이 아니라 **실제로 지나가는 경계** 를 여기 하나로 세우는 것이다.
 *
 * 외부 의존 0 — SDK 대신 `fetch` + SSE 를 쓴다. 폐쇄망/로컬 OpenAI-compatible endpoint
 * (Ollama · vLLM · LM Studio · 사내 gateway) 직결이 1차 축이라 (2026-08-28 사용자 결정),
 * SDK 의 브라우저 우회 옵션에 묶이지 않는 편이 이식성이 높다.
 *
 * 키 취급 — 이 층은 `apiKey` 를 **호출 인자로만** 받는다. 저장·조회·기본값 0
 * (secret isolation 은 Phase 2 D10).
 */

/** 지원 provider 종류. 로컬/사내 endpoint 는 전부 `openai-compatible` + baseUrl 로 포섭한다. */
export type LLMProviderId = "anthropic" | "openai-compatible";

/** 추론 강도 — provider 별 대응 필드로 변환된다 (없으면 무시). */
export type ReasoningEffort = "low" | "medium" | "high";

/** 도구 정의 — JSON Schema 그대로. MCP tool schema 와 같은 형태 (ADR-134 D11). */
export interface LLMToolDefinition {
  name: string;
  description: string;
  /** JSON Schema object */
  parameters: Record<string, unknown>;
}

/** 모델이 고른 도구 호출 1건. `arguments` 는 스트리밍 중 조립되는 JSON 문자열. */
export interface LLMToolCall {
  id: string;
  name: string;
  arguments: string;
}

/** provider 중립 대화 메시지. */
export type LLMMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: LLMToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

/** 종료 사유. */
export type LLMStopReason =
  "end" | "tool-calls" | "max-tokens" | "aborted" | "other";

/** 스트리밍 이벤트 — 텍스트 조각, 완성된 도구 호출, 종료. */
export type LLMStreamEvent =
  | { type: "text-delta"; delta: string }
  | { type: "tool-call"; call: LLMToolCall }
  | { type: "stop"; reason: LLMStopReason };

export interface LLMCompletionOptions {
  tools?: readonly LLMToolDefinition[];
  toolChoice?: "auto" | "none";
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: ReasoningEffort;
  signal?: AbortSignal;
}

/** 호출 대상 endpoint 구성. `apiKey` 는 호출자가 주입 — 이 모듈은 보관하지 않는다. */
export interface LLMProviderConfig {
  /** 예: `https://api.anthropic.com` · `http://localhost:11434/v1` · 사내 gateway */
  baseUrl: string;
  model: string;
  /** BYOK. 로컬/폐쇄망 endpoint 는 없는 경우가 많다 (선택). */
  apiKey?: string;
  /** 추가 헤더 (사내 gateway 인증 · provider 별 opt-in 헤더). */
  headers?: Record<string, string>;
  /** 테스트·프록시 주입용. 기본값은 전역 `fetch`. */
  fetchImpl?: typeof fetch;
}

export interface LLMProvider {
  readonly id: LLMProviderId;
  readonly model: string;
  /** 스트리밍 실행. `options.signal` 로 중단한다 (기존 AbortController 경로 보존). */
  completeWithTools(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions,
  ): AsyncGenerator<LLMStreamEvent>;
}

/** provider 호출 실패 — HTTP status 를 보존해 429 백오프 판정에 쓴다. */
export class LLMProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly providerId?: LLMProviderId,
  ) {
    super(message);
    this.name = "LLMProviderError";
  }
}

export function isRateLimitError(error: unknown): boolean {
  return error instanceof LLMProviderError && error.status === 429;
}

/** 두 어댑터가 공유하는 기본값 — 기존 `GroqAgentService` 값을 그대로 승계한다. */
export const LLM_DEFAULTS = {
  temperature: 0.7,
  maxTokens: 2048,
} as const;

/**
 * SSE 응답을 파싱해 `data:` payload 를 순서대로 내보낸다.
 *
 * `[DONE]` 은 걸러내고, JSON 이 아닌 줄은 무시한다 (provider 마다 주석·keep-alive 형태가 다름).
 */
export async function* parseSSEStream(
  response: Response,
): AsyncGenerator<Record<string, unknown>> {
  const body = response.body;
  if (!body) return;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n");
      while (boundary !== -1) {
        const line = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 1);
        boundary = buffer.indexOf("\n");

        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          yield JSON.parse(payload) as Record<string, unknown>;
        } catch {
          // provider 가 흘리는 비-JSON 줄은 무시
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** 공통 요청 실행 — 실패를 `LLMProviderError` 로 정규화한다. */
export async function requestStream(
  config: LLMProviderConfig,
  providerId: LLMProviderId,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  const doFetch = config.fetchImpl ?? fetch;
  const response = await doFetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch {
      detail = "";
    }
    throw new LLMProviderError(
      `${providerId} ${response.status}${detail ? `: ${detail.slice(0, 400)}` : ""}`,
      response.status,
      providerId,
    );
  }
  return response;
}
