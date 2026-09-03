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

/**
 * 추론 강도 — provider 별 대응 필드로 변환된다 (없으면 무시).
 *
 * Claude 5 계열의 `effort` 5단계 (`xhigh` · `max` 포함, 기본 `high`) 와 OpenAI
 * `reasoning_effort` 를 같은 이름으로 받는다. effort 파라미터가 없는 모델 (Haiku 4.5 등)
 * 은 프로파일에서 비워 둔다 — 보내면 400 이다.
 */
export type ReasoningEffort = "low" | "medium" | "high" | "xhigh" | "max";

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

/**
 * provider 가 돌려준 assistant 턴 **원문** — 같은 provider 로 다음 요청을 보낼 때 그대로
 * replay 한다.
 *
 * 필요한 이유: Claude 5 계열은 thinking 이 항상 켜져 있고, 도구 결과를 돌려보내는 턴에는
 * 직전 assistant 턴의 thinking 블록 (signature 포함, 빈 블록도) 이 변경 없이 실려야 한다 —
 * 중립 필드 (text + toolCalls) 로 재조립하면 thinking 이 빠져 400 이다. 다른 provider 의
 * 원문은 무시하고 중립 필드로 재조립한다 (`providerId` 로 판정).
 */
export interface LLMAssistantTurn {
  providerId: LLMProviderId;
  /** provider wire 형식 그대로 — 어댑터 밖에서는 열어 보지 않는다. */
  blocks: readonly unknown[];
}

/** provider 중립 대화 메시지. */
export type LLMMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      toolCalls?: LLMToolCall[];
      /** 같은 provider 로 replay 할 원문 (thinking 블록 보존). */
      providerContent?: LLMAssistantTurn;
    }
  | { role: "tool"; toolCallId: string; content: string };

/** 종료 사유. `refusal` 은 안전 분류기가 응답을 거절한 것 — 재시도 대상이 아니다. */
export type LLMStopReason =
  "end" | "tool-calls" | "max-tokens" | "refusal" | "aborted" | "other";

/** 스트리밍 이벤트 — 텍스트 조각, 완성된 도구 호출, 종료. */
export type LLMStreamEvent =
  | { type: "text-delta"; delta: string }
  | { type: "tool-call"; call: LLMToolCall }
  | {
      type: "stop";
      reason: LLMStopReason;
      /** `refusal` 의 `stop_details.category` 같은 부가 정보. */
      detail?: string;
      /** 이 턴의 원문 — 호출자가 assistant 메시지에 실어 다음 요청에 replay 한다. */
      assistantTurn?: LLMAssistantTurn;
    };

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
  /**
   * 원격 endpoint 직접 호출 허용 (개발 빌드 한정 — HC13/R12).
   *
   * 프로덕션에서는 무시된다. 원격 provider 의 정식 경로는 프록시이고 (D10), 프록시는
   * 아직 없다 — 2026-08-28 사용자 결정으로 1차 축은 폐쇄망/로컬 endpoint 직결이다.
   */
  allowRemoteDirect?: boolean;
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

/** 프록시 없이 원격 provider 를 부르려 할 때 (HC13/R12). */
export const REMOTE_DIRECT_BLOCKED = "remote-provider-requires-proxy";

/**
 * 사용자 머신 안에서 끝나는 endpoint 인가 — 로컬/사설망은 HC13 의 명시 예외다.
 *
 * 판정은 host 만 본다 (scheme·port 무관). 사내 gateway 를 쓰는 배포는 사설 대역
 * (10./172.16-31./192.168./*.local) 안에 있으므로 여기서 함께 허용된다.
 */
export function isLocalEndpoint(baseUrl: string): boolean {
  let host: string;
  try {
    host = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]"
  ) {
    return true;
  }
  if (host.endsWith(".local") || host.endsWith(".localhost")) return true;
  if (host.startsWith("10.") || host.startsWith("192.168.")) return true;
  const match = /^172\.(\d{1,2})\./.exec(host);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

/**
 * 브라우저에서 이 endpoint 를 직접 불러도 되는지 (HC13 / D10 / R12).
 *
 * 로컬·사설망은 허용, 원격은 프록시가 생기기 전까지 **차단**한다. 개발 빌드에서만
 * `allowRemoteDirect` 로 뚫을 수 있다 — 프로덕션 번들에는 우회 경로가 없다.
 * Groq 시절 `dangerouslyAllowBrowser: true` 로 키가 번들에 실리던 구조의 재발 차단이다.
 */
export function assertBrowserCallAllowed(
  config: LLMProviderConfig,
  providerId: LLMProviderId,
): void {
  if (isLocalEndpoint(config.baseUrl)) return;
  if (config.allowRemoteDirect && import.meta.env.DEV) return;
  throw new LLMProviderError(
    `${REMOTE_DIRECT_BLOCKED}: ${config.baseUrl} 는 원격 endpoint 라 브라우저에서 직접 부를 수 없습니다 (HC13). ` +
      `로컬/사내 endpoint 를 쓰거나 프록시 경로를 기다려 주세요.`,
    undefined,
    providerId,
  );
}

/**
 * OpenAI 호환 어댑터의 기본값 — 기존 `GroqAgentService` 값을 그대로 승계한다.
 * Anthropic 어댑터는 쓰지 않는다: Claude 5 계열은 비기본 `temperature` 가 400 이고,
 * adaptive thinking 이 `max_tokens` 안에서 돌아 2048 로는 모자란다
 * (`ANTHROPIC_DEFAULT_MAX_TOKENS`).
 */
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
  assertBrowserCallAllowed(config, providerId);

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
