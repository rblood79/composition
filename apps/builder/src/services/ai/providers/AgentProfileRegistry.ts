/**
 * 에이전트 프로파일 레지스트리 (ADR-134 Phase 1, D1/D8).
 *
 * "어떤 작업에 어떤 모델을 쓰는가" 를 코드 상수가 아니라 **프로파일 표** 로 둔다 —
 * `main` / `planner` / `executor` / `verifier` / `fast` (+ `vision` 예약). Phase 7 의
 * 프로파일 라우팅과 폐쇄망 BYOK 는 이 표를 읽는다.
 *
 * 키를 담지 않는다 — 프로파일은 `credentialRef` (env 변수명 또는 저장소 키 **이름**) 만
 * 가지고, 실제 값은 호출 시점에 주입된다 (D10 secret isolation 은 Phase 2).
 *
 * 모델 id 를 임의로 채워 넣지 않는 이유 (Phase 0 실측): 하드코딩된 모델 id 가 provider
 * 쪽에서 만료돼 `404 model_not_found` 로 AI 패널 전체가 조용히 멈춰 있었다. 프리셋은
 * **모델이 비어 있으면 미구성** 으로 판정하고, 비어 있는 채로는 provider 를 만들지 않는다.
 */
import { AnthropicProvider } from "./AnthropicProvider";
import { OpenAICompatibleProvider } from "./OpenAICompatibleProvider";
import type {
  LLMProvider,
  LLMProviderId,
  ReasoningEffort,
} from "./LLMProvider";

/** 작업 유형별 프로파일. `vision` 은 예약 — 프리셋이 채우지 않는다. */
export const AGENT_PROFILE_IDS = [
  "main",
  "planner",
  "executor",
  "verifier",
  "fast",
  "vision",
] as const;

export type AgentProfileId = (typeof AGENT_PROFILE_IDS)[number];

/** 프리셋이 구성하지 않는 예약 프로파일. */
export const RESERVED_AGENT_PROFILE_IDS: readonly AgentProfileId[] = ["vision"];

export interface AgentProfileConfig {
  provider: LLMProviderId;
  /** 폐쇄망·로컬 endpoint 를 포함한 호출 대상. */
  baseUrl: string;
  /** 빈 문자열이면 미구성 — 사용자가 고른다. */
  model: string;
  /** 키의 **이름** (env 변수명 / 저장소 키). 값 아님. */
  credentialRef?: string;
  reasoningEffort?: ReasoningEffort;
}

export type AgentProfileMap = Partial<
  Record<AgentProfileId, AgentProfileConfig>
>;

export type AgentProfilePresetId = "anthropic" | "openai" | "local-ollama";

const ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const OPENAI_BASE_URL = "https://api.openai.com/v1";
/** Ollama 의 OpenAI 호환 endpoint — 전용 어댑터 없이 base URL 로 포섭한다. */
const OLLAMA_BASE_URL = "http://localhost:11434/v1";

/**
 * 프리셋 3종 (R2 온보딩 완화).
 *
 * `model` 이 빈 것은 "사용자가 고를 자리" 다 — 임의 기본값을 넣어 만료된 id 를 다시 만드는
 * 실패를 반복하지 않는다. Anthropic 프리셋만 세대 별칭이 안정적이라 기본값을 둔다.
 */
export const AGENT_PROFILE_PRESETS: Record<
  AgentProfilePresetId,
  AgentProfileMap
> = {
  anthropic: {
    main: {
      provider: "anthropic",
      baseUrl: ANTHROPIC_BASE_URL,
      model: "claude-sonnet-5",
      credentialRef: "ANTHROPIC_API_KEY",
    },
    planner: {
      provider: "anthropic",
      baseUrl: ANTHROPIC_BASE_URL,
      model: "claude-opus-5",
      credentialRef: "ANTHROPIC_API_KEY",
      reasoningEffort: "high",
    },
    executor: {
      provider: "anthropic",
      baseUrl: ANTHROPIC_BASE_URL,
      model: "claude-sonnet-5",
      credentialRef: "ANTHROPIC_API_KEY",
    },
    verifier: {
      provider: "anthropic",
      baseUrl: ANTHROPIC_BASE_URL,
      model: "claude-sonnet-5",
      credentialRef: "ANTHROPIC_API_KEY",
      reasoningEffort: "medium",
    },
    fast: {
      provider: "anthropic",
      baseUrl: ANTHROPIC_BASE_URL,
      model: "claude-haiku-4-5-20251001",
      credentialRef: "ANTHROPIC_API_KEY",
    },
  },
  openai: {
    main: {
      provider: "openai-compatible",
      baseUrl: OPENAI_BASE_URL,
      model: "",
      credentialRef: "OPENAI_API_KEY",
    },
    planner: {
      provider: "openai-compatible",
      baseUrl: OPENAI_BASE_URL,
      model: "",
      credentialRef: "OPENAI_API_KEY",
      reasoningEffort: "high",
    },
    executor: {
      provider: "openai-compatible",
      baseUrl: OPENAI_BASE_URL,
      model: "",
      credentialRef: "OPENAI_API_KEY",
    },
    verifier: {
      provider: "openai-compatible",
      baseUrl: OPENAI_BASE_URL,
      model: "",
      credentialRef: "OPENAI_API_KEY",
    },
    fast: {
      provider: "openai-compatible",
      baseUrl: OPENAI_BASE_URL,
      model: "",
      credentialRef: "OPENAI_API_KEY",
    },
  },
  "local-ollama": {
    main: {
      provider: "openai-compatible",
      baseUrl: OLLAMA_BASE_URL,
      model: "",
    },
    planner: {
      provider: "openai-compatible",
      baseUrl: OLLAMA_BASE_URL,
      model: "",
    },
    executor: {
      provider: "openai-compatible",
      baseUrl: OLLAMA_BASE_URL,
      model: "",
    },
    verifier: {
      provider: "openai-compatible",
      baseUrl: OLLAMA_BASE_URL,
      model: "",
    },
    fast: {
      provider: "openai-compatible",
      baseUrl: OLLAMA_BASE_URL,
      model: "",
    },
  },
};

/** 모델이 비어 있으면 미구성 — provider 를 만들지 않는다. */
export function isProfileConfigured(
  config: AgentProfileConfig | undefined,
): config is AgentProfileConfig {
  return Boolean(config && config.baseUrl && config.model);
}

export interface CreateProviderOptions {
  /** BYOK 값 — 호출 시점 주입. 레지스트리는 보관하지 않는다. */
  apiKey?: string;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

export interface AgentProfileRegistry {
  get(id: AgentProfileId): AgentProfileConfig | undefined;
  set(id: AgentProfileId, config: AgentProfileConfig): void;
  /** 프리셋 전체 적용 — 기존 구성을 덮어쓴다. */
  applyPreset(preset: AgentProfilePresetId): void;
  /** 구성된 프로파일만 (`vision` 등 미구성 제외). */
  configuredIds(): AgentProfileId[];
  /** 미구성 프로파일은 `undefined` — 호출자가 온보딩으로 유도한다. */
  createProvider(
    id: AgentProfileId,
    options?: CreateProviderOptions,
  ): LLMProvider | undefined;
  toJSON(): AgentProfileMap;
  load(map: AgentProfileMap): void;
}

export function createAgentProfileRegistry(
  initial: AgentProfileMap = {},
): AgentProfileRegistry {
  let profiles: AgentProfileMap = { ...initial };

  return {
    get: (id) => profiles[id],
    set: (id, config) => {
      profiles = { ...profiles, [id]: config };
    },
    applyPreset: (preset) => {
      profiles = { ...AGENT_PROFILE_PRESETS[preset] };
    },
    configuredIds: () =>
      AGENT_PROFILE_IDS.filter((id) => isProfileConfigured(profiles[id])),
    createProvider: (id, options = {}) => {
      const config = profiles[id];
      if (!isProfileConfigured(config)) return undefined;

      const providerConfig = {
        baseUrl: config.baseUrl,
        model: config.model,
        ...(options.apiKey ? { apiKey: options.apiKey } : {}),
        ...(options.headers ? { headers: options.headers } : {}),
        ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      };

      return config.provider === "anthropic"
        ? new AnthropicProvider(providerConfig)
        : new OpenAICompatibleProvider(providerConfig);
    },
    toJSON: () => ({ ...profiles }),
    load: (map) => {
      profiles = { ...map };
    },
  };
}
