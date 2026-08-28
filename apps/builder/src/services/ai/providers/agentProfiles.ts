/**
 * 앱 단일 프로파일 레지스트리 + 설정 보존 (ADR-134 Phase 2).
 *
 * 프로파일은 **설정값** (provider · baseUrl · model · 키 이름) 이라 브라우저에 저장한다.
 * 키 **값** 은 여기 없다 — `byokKeyStore` 소관 (D10).
 *
 * 기본 프리셋은 `local-ollama` 다: 폐쇄망/로컬 endpoint 직결이 1차 축이고 (2026-08-28
 * 사용자 결정), 프리셋의 `model` 이 비어 있어 **미구성 상태로 시작**한다. 만료된 모델 id 를
 * 기본값으로 박아 두고 404 로 조용히 멈추던 이전 구조를 반복하지 않기 위한 것이다.
 */
import {
  AGENT_PROFILE_PRESETS,
  createAgentProfileRegistry,
  isProfileConfigured,
  type AgentProfileId,
  type AgentProfileMap,
  type AgentProfilePresetId,
  type AgentProfileRegistry,
} from "./AgentProfileRegistry";
import { getByokKey } from "./byokKeyStore";
import type { LLMProvider } from "./LLMProvider";

const STORAGE_KEY = "composition.ai.profiles";

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readStored(): AgentProfileMap | null {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AgentProfileMap;
  } catch {
    return null;
  }
}

let registry: AgentProfileRegistry | null = null;

/** 앱 전역 레지스트리 — 저장된 설정이 있으면 그것, 없으면 기본 프리셋. */
export function getAgentProfileRegistry(): AgentProfileRegistry {
  if (registry) return registry;
  const stored = readStored();
  registry = createAgentProfileRegistry(
    stored ?? { ...AGENT_PROFILE_PRESETS["local-ollama"] },
  );
  return registry;
}

/** 현재 구성을 브라우저에 저장 (키 값 없음). */
export function saveAgentProfiles(): void {
  storage()?.setItem(
    STORAGE_KEY,
    JSON.stringify(getAgentProfileRegistry().toJSON()),
  );
}

export function applyAgentProfilePreset(preset: AgentProfilePresetId): void {
  getAgentProfileRegistry().applyPreset(preset);
  saveAgentProfiles();
}

/** 테스트용 — 다음 조회에서 다시 만든다. */
export function resetAgentProfileRegistry(): void {
  registry = null;
}

/**
 * 프로파일로 provider 를 만든다. 키는 `credentialRef` 이름으로 조회해 **호출 인자로만**
 * 넘긴다. 미구성이면 `undefined` — 호출자가 설정으로 유도한다.
 */
export function resolveProvider(
  id: AgentProfileId = "main",
): LLMProvider | undefined {
  const profileRegistry = getAgentProfileRegistry();
  const config = profileRegistry.get(id);
  if (!isProfileConfigured(config)) return undefined;

  const apiKey = config.credentialRef
    ? getByokKey(config.credentialRef)
    : undefined;
  return profileRegistry.createProvider(id, apiKey ? { apiKey } : {});
}

/** AI 패널이 "설정 필요" 상태를 보여줄 때 쓰는 판정. */
export function isAgentProfileReady(id: AgentProfileId = "main"): boolean {
  return isProfileConfigured(getAgentProfileRegistry().get(id));
}
