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
import { useI18n } from "@/i18n";

/** 프로파일 → 라벨 **키** (ADR-200 어법). */
const PROFILE_LABEL_KEYS: Readonly<Record<AgentProfileId, string>> = {
  main: "ai.roleMain",
  planner: "ai.rolePlanner",
  executor: "ai.roleExecutor",
  verifier: "ai.roleVerifier",
  fast: "ai.roleFast",
  vision: "ai.roleVision",
};

const PRESETS: ReadonlyArray<{ id: AgentProfilePresetId; labelKey: string }> = [
  { id: "local-ollama", labelKey: "ai.presetLocalOllama" },
  { id: "anthropic", labelKey: "" },
  { id: "openai", labelKey: "ai.presetOpenAiCompatible" },
];

const EMPTY: AgentProfileConfig = {
  provider: "openai-compatible",
  baseUrl: "",
  model: "",
};

export function AgentProfileSettings() {
  const { t } = useI18n();
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
        <legend className="fieldset-legend">{t("ai.presetsLegend")}</legend>
        <div className="ai-profile-preset-row">
          {PRESETS.map((preset) => (
            <Button
              key={preset.id}
              className="control-button"
              variant="secondary"
              size="sm"
              onPress={() => applyPreset(preset.id)}
            >
              {preset.labelKey ? t(preset.labelKey) : "Anthropic"}
            </Button>
          ))}
        </div>
        <p className="ai-profile-hint">{t("ai.presetsHint")}</p>
      </fieldset>

      {editable.map((id) => {
        const config = registry.get(id) ?? EMPTY;
        return (
          <fieldset key={id} className="properties-aria ai-profile-row">
            <legend className="fieldset-legend">
              {t(PROFILE_LABEL_KEYS[id])}
            </legend>

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
                  {t("ai.openAiCompatibleHint")}
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
              <span>{t("ai.model")}</span>
              <input
                type="text"
                value={config.model}
                placeholder={t("ai.modelPlaceholder")}
                onChange={(e) => update(id, { model: e.target.value })}
              />
            </label>

            <label className="ai-profile-field">
              <span>{t("ai.keyName")}</span>
              <input
                type="text"
                value={config.credentialRef ?? ""}
                placeholder={t("ai.keyNamePlaceholder")}
                onChange={(e) =>
                  update(id, { credentialRef: e.target.value || undefined })
                }
              />
            </label>

            {config.credentialRef ? (
              <label className="ai-profile-field">
                <span>{t("ai.keyValue")}</span>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder={t("ai.keyValuePlaceholder")}
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
        <legend className="fieldset-legend">{t("ai.keyStorageLegend")}</legend>
        <label className="ai-profile-check">
          <input
            type="checkbox"
            checked={persist}
            onChange={(e) => {
              setPersistOptIn(e.target.checked);
              setPersist(e.target.checked);
            }}
          />
          <span>{t("ai.keyStorageToggle")}</span>
        </label>
        <p className="ai-profile-hint">{t("ai.keyStorageHint")}</p>
      </fieldset>
    </div>
  );
}
