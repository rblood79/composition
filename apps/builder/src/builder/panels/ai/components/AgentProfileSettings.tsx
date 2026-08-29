/**
 * 에이전트 프로파일 설정 (ADR-134 Phase 7, D8).
 *
 * 프로파일마다 provider / endpoint / 모델 / 키 이름 / 추론 강도를 정한다. **키 값은 여기
 * 저장되지 않는다** — `byokKeyStore` 가 기본적으로 세션 메모리에만 두고, 브라우저에 남기는
 * 것은 사용자가 명시로 켤 때뿐이다 (D10).
 *
 * 모델 칸을 비워 두면 그 프로파일은 **미구성**이다. 임의 기본값을 넣지 않는 이유는
 * Phase 0 실측 때문이다 — 하드코딩된 모델 id 가 만료돼 404 로 패널 전체가 조용히 멈춰
 * 있었다.
 */
import { useState } from "react";
import { Button } from "@composition/shared/components";
import {
  AGENT_PROFILE_IDS,
  RESERVED_AGENT_PROFILE_IDS,
  type AgentProfileConfig,
  type AgentProfileId,
  type AgentProfilePresetId,
} from "../../../../services/ai/providers/AgentProfileRegistry";
import {
  applyAgentProfilePreset,
  getAgentProfileRegistry,
  resetAgentProfileRegistry,
  saveAgentProfiles,
} from "../../../../services/ai/providers/agentProfiles";
import {
  isPersistOptedIn,
  setByokKey,
  setPersistOptIn,
} from "../../../../services/ai/providers/byokKeyStore";

const PROFILE_LABEL: Readonly<Record<AgentProfileId, string>> = {
  main: "기본",
  planner: "계획",
  executor: "실행",
  verifier: "검증",
  fast: "분류",
  vision: "이미지 (예약)",
};

const PRESETS: ReadonlyArray<{ id: AgentProfilePresetId; label: string }> = [
  { id: "local-ollama", label: "로컬 (Ollama)" },
  { id: "anthropic", label: "Anthropic" },
  { id: "openai", label: "OpenAI 호환" },
];

const EMPTY: AgentProfileConfig = {
  provider: "openai-compatible",
  baseUrl: "",
  model: "",
};

export function AgentProfileSettings() {
  // 저장 시마다 다시 그린다 — 레지스트리는 React 상태가 아니다.
  const [revision, setRevision] = useState(0);
  const [persist, setPersist] = useState(() => isPersistOptedIn());
  const registry = getAgentProfileRegistry();

  const editable = AGENT_PROFILE_IDS.filter(
    (id) => !RESERVED_AGENT_PROFILE_IDS.includes(id),
  );

  const update = (id: AgentProfileId, patch: Partial<AgentProfileConfig>) => {
    const current = registry.get(id) ?? EMPTY;
    registry.set(id, { ...current, ...patch });
    saveAgentProfiles();
    setRevision((r) => r + 1);
  };

  const applyPreset = (preset: AgentProfilePresetId) => {
    applyAgentProfilePreset(preset);
    resetAgentProfileRegistry();
    setRevision((r) => r + 1);
  };

  return (
    <div className="ai-profile-settings" data-revision={revision}>
      <fieldset className="properties-aria ai-profile-presets">
        <legend className="fieldset-legend">프리셋</legend>
        <div className="ai-profile-preset-row">
          {PRESETS.map((preset) => (
            <Button
              key={preset.id}
              className="control-button"
              variant="secondary"
              size="sm"
              onPress={() => applyPreset(preset.id)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <p className="ai-profile-hint">
          프리셋은 endpoint 만 채웁니다. 모델은 직접 고르세요 — 비어 있으면 그
          프로파일은 쓰이지 않습니다.
        </p>
      </fieldset>


      {editable.map((id) => {
        const config = registry.get(id) ?? EMPTY;
        return (
          <fieldset key={id} className="properties-aria ai-profile-row">
            <legend className="fieldset-legend">{PROFILE_LABEL[id]}</legend>

            <label className="ai-profile-field">
              <span>provider</span>
              <select
                value={config.provider}
                onChange={(e) =>
                  update(id, {
                    provider: e.target.value as AgentProfileConfig["provider"],
                  })
                }
              >
                <option value="openai-compatible">
                  OpenAI 호환 (Ollama · vLLM · LM Studio · 사내 gateway)
                </option>
                <option value="anthropic">Anthropic</option>
              </select>
            </label>

            <label className="ai-profile-field">
              <span>endpoint</span>
              <input
                type="text"
                value={config.baseUrl}
                placeholder="http://localhost:11434/v1"
                onChange={(e) => update(id, { baseUrl: e.target.value })}
              />
            </label>

            <label className="ai-profile-field">
              <span>모델</span>
              <input
                type="text"
                value={config.model}
                placeholder="비워 두면 미구성"
                onChange={(e) => update(id, { model: e.target.value })}
              />
            </label>

            <label className="ai-profile-field">
              <span>키 이름</span>
              <input
                type="text"
                value={config.credentialRef ?? ""}
                placeholder="로컬 endpoint 는 비워 둡니다"
                onChange={(e) =>
                  update(id, { credentialRef: e.target.value || undefined })
                }
              />
            </label>

            {config.credentialRef ? (
              <label className="ai-profile-field">
                <span>키 값</span>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder="입력 후 이 칸은 비워집니다"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!value || !config.credentialRef) return;
                    setByokKey(config.credentialRef, value);
                  }}
                />
              </label>
            ) : null}
          </fieldset>
        );
      })}

      <fieldset className="properties-aria ai-profile-secrets">
        <legend className="fieldset-legend">키 보관</legend>
        <label className="ai-profile-check">
          <input
            type="checkbox"
            checked={persist}
            onChange={(e) => {
              setPersistOptIn(e.target.checked);
              setPersist(e.target.checked);
            }}
          />
          <span>이 브라우저에 키를 저장합니다</span>
        </label>
        <p className="ai-profile-hint">
          기본은 이 세션에서만 기억합니다. 끄면 저장된 키가 즉시 삭제됩니다.
        </p>
      </fieldset>
    </div>
  );
}
