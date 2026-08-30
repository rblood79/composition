/**
 * 고급 모드 (ADR-134 Phase 8, D9).
 *
 * 기본 표면은 "요청하고 결과를 본다" 만 남긴다 (depth 2). 모델 구성·라우팅·계획 분해 같은
 * L4 표면은 전부 여기로 격리한다 — 1년차 신입이 첫 화면에서 프로파일 6개와 endpoint 를
 * 만나지 않도록.
 *
 * 진행 영역은 **일어난 것만** 그린다. 분해 실행이 아니면 계획도 수리도 없으므로 영역 자체가
 * 생기지 않는다 (빈 상자를 그리면 "여기 뭔가 있어야 하나" 라는 오해가 생긴다).
 */
import { CircleCheck, CircleDot, Wrench } from "lucide-react";
import { AgentProfileSettings } from "./AgentProfileSettings";
import { ConnectionStatus } from "./ConnectionStatus";
import { hasProgress, type AgentProgress } from "../hooks/agentProgress";
import { useI18n } from "@/i18n";

interface AdvancedModeProps {
  progress: AgentProgress;
}

/**
 * 요약이 역할 이름을 다시 말하면 지운다 — 오케스트레이터는 "2건 실행" / "수리 1회" 처럼
 * 문장으로 요약하는데, 역할 라벨 옆에 그대로 붙으면 "실행 2건 실행" 이 된다.
 */
export function trimLabelEcho(label: string, summary: string): string {
  const trimmed = summary.trim();
  if (trimmed === label) return "";
  if (trimmed.startsWith(`${label} `)) {
    return trimmed.slice(label.length).trim();
  }
  if (trimmed.endsWith(` ${label}`)) {
    return trimmed.slice(0, -label.length).trim();
  }
  return trimmed;
}

export function AdvancedMode({ progress }: AdvancedModeProps) {
  const { t } = useI18n();

  return (
    <div className="ai-advanced">
      <ConnectionStatus />

      {hasProgress(progress) && (
        <section
          aria-label={t("ai.agentProgress")}
          className="ai-progress"
          role="group"
        >
          {progress.agents.length > 0 && (
            <ul className="ai-progress-agents">
              {progress.agents.map((row, index) => (
                <li
                  className="ai-progress-agent"
                  data-status={row.status}
                  key={`${row.agent}-${index}`}
                >
                  {row.status === "done" ? (
                    <CircleCheck size={13} />
                  ) : (
                    <CircleDot size={13} />
                  )}
                  <span className="ai-progress-agent-label">
                    {t(row.labelKey)}
                  </span>
                  {row.summary &&
                  trimLabelEcho(t(row.labelKey), row.summary) ? (
                    <span className="ai-progress-agent-summary">
                      {trimLabelEcho(t(row.labelKey), row.summary)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {progress.plan && (
            <div className="ai-progress-plan">
              <p className="ai-progress-goal">{progress.plan.goal}</p>
              <ol className="ai-progress-steps">
                {progress.plan.steps.map((step) => (
                  <li className="ai-progress-step" key={step.index}>
                    {step.instruction}
                    {step.done ? (
                      <span className="ai-progress-step-done">
                        {` → ${step.done}`}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {progress.repairs.map((repair) => (
            <div className="ai-progress-repair" key={repair.attempt}>
              <Wrench size={13} />
              <span>
                {t("ai.agentRepair", {
                  attempt: repair.attempt,
                  max: repair.max,
                })}{" "}
                · {repair.issues.join(" · ")}
              </span>
            </div>
          ))}
        </section>
      )}

      <AgentProfileSettings />
    </div>
  );
}
