/**
 * 프로파일별 연결 상태 (ADR-134 Phase 7, D8).
 *
 * 보여 주는 것은 "연결됐다/안 됐다" 가 아니라 **어느 작업이 어느 프로파일로 가는가** 다.
 * 조용한 내림 (planner 를 설정했다고 믿는데 main 이 계획을 세우는 상황) 이 Phase 6 의
 * 실제 문제였고, 그것을 눈에 보이게 하는 것이 이 컴포넌트의 목적이다.
 *
 * 원격 도달 불가 시 로컬 endpoint 를 안내한다 — 원격 직접 호출은 프록시가 생기기 전까지
 * 차단이라 (HC13/R12), 지금 쓸 수 있는 경로는 로컬·사설망뿐이다.
 */
import { Wifi, WifiOff } from "lucide-react";
import { getRoutingReport } from "../../../../services/ai/createAgentRunner";
import { getAgentProfileRegistry } from "../../../../services/ai/providers/agentProfiles";
import { isClosedNetworkProfile } from "../../../../services/ai/routing/AgentProfileRouter";
import type { AgentTask } from "../../../../services/ai/routing/AgentProfileRouter";
import { useI18n } from "@/i18n";

/** task → 라벨 **키** (ADR-200 어법). */
const TASK_LABEL_KEYS: Readonly<Record<AgentTask, string>> = {
  plan: "ai.taskPlan",
  execute: "ai.taskExecute",
  verify: "ai.taskVerify",
  classify: "ai.taskClassify",
};

export function ConnectionStatus() {
  const { t } = useI18n();
  const report = getRoutingReport();
  const registry = getAgentProfileRegistry();

  if (!report.ready) {
    return (
      <div className="ai-connection ai-connection-empty">
        <WifiOff size={14} />
        <div>
          <p className="ai-connection-title">{t("ai.profileMissing")}</p>
          <p className="ai-connection-hint">
            {t("ai.profileMissingHintLead")}{" "}
            <code>http://localhost:11434/v1</code>
            {t("ai.profileMissingHintTail")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-connection">
      <ul className="ai-connection-list">
        {report.decisions.map((decision) => {
          const config = decision.profileId
            ? registry.get(decision.profileId)
            : undefined;
          const closed = isClosedNetworkProfile(config);
          return (
            <li
              key={decision.task}
              className={
                decision.downgraded
                  ? "ai-connection-row ai-connection-row-downgraded"
                  : "ai-connection-row"
              }
            >
              <span className="ai-connection-task">
                {t(TASK_LABEL_KEYS[decision.task])}
              </span>
              <span className="ai-connection-profile">
                {decision.profileId ?? t("ai.profileNone")}
                {config?.model ? ` · ${config.model}` : ""}
              </span>
              {closed ? (
                <span
                  className="ai-connection-badge"
                  title={t("ai.privateNetworkHint")}
                >
                  <Wifi size={11} /> {t("ai.privateNetworkBadge")}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {report.notices.length > 0 && (
        <ul className="ai-connection-notices">
          {report.notices.map((notice) => (
            <li key={`${notice.key}|${JSON.stringify(notice.params ?? {})}`}>
              {t(
                notice.key,
                // 인자 값 자체가 라벨 키라 한 겹 더 해소한다.
                notice.params
                  ? Object.fromEntries(
                      Object.entries(notice.params).map(([k, v]) => [k, t(v)]),
                    )
                  : undefined,
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
