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

const TASK_LABEL: Readonly<Record<AgentTask, string>> = {
  plan: "계획",
  execute: "실행",
  verify: "검증",
  classify: "분류",
};

export function ConnectionStatus() {
  const report = getRoutingReport();
  const registry = getAgentProfileRegistry();

  if (!report.ready) {
    return (
      <div className="ai-connection ai-connection-empty">
        <WifiOff size={14} />
        <div>
          <p className="ai-connection-title">에이전트 프로파일 미구성</p>
          <p className="ai-connection-hint">
            로컬 endpoint (예: Ollama <code>http://localhost:11434/v1</code>) 와
            모델을 지정하면 바로 쓸 수 있습니다. 원격 상용 provider 는 프록시가
            준비되기 전까지 브라우저에서 직접 호출할 수 없습니다.
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
                {TASK_LABEL[decision.task]}
              </span>
              <span className="ai-connection-profile">
                {decision.profileId ?? "없음"}
                {config?.model ? ` · ${config.model}` : ""}
              </span>
              {closed ? (
                <span className="ai-connection-badge" title="로컬·사설망 endpoint">
                  <Wifi size={11} /> 폐쇄망
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {report.notices.length > 0 && (
        <ul className="ai-connection-notices">
          {report.notices.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
