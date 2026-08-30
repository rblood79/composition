/**
 * agent 가 실행한 명령 목록 (ADR-196 Phase 3, §3-5).
 *
 * 사용자가 "무엇이 바뀌었는지" 를 안다 — 호출 1건 = 한 줄, 5 status 전부 보인다
 * (거부·전제 미충족·승인 거부도 보여야 무엇이 일어나지 **않았는지** 알 수 있다).
 * 세션 메모리라 새로고침하면 비는 것이 정상 (R5).
 */
import { SHORTCUT_DEFINITIONS } from "../../../config/keyboardShortcuts";
import { formatShortcut } from "../../../hooks/useKeyboardShortcutsRegistry";
import { useAgentCommandLogStore } from "../../../stores/agentCommandLog";
import { useI18n } from "@/i18n";

/** 상태 → 라벨 **키** — 해소는 표시 시점에 한다 (ADR-200). */
const STATUS_LABEL_KEYS: Record<string, string> = {
  ok: "ai.logOk",
  denied: "ai.logDenied",
  "precondition-failed": "ai.logPreconditionFailed",
  declined: "ai.logDeclined",
  error: "ai.logError",
};

const RECENT_LIMIT = 8;

export function AgentCommandLogList() {
  const { t } = useI18n();
  const entries = useAgentCommandLogStore((state) => state.entries);
  if (entries.length === 0) return null;

  const recent = entries.slice(-RECENT_LIMIT).reverse();

  // 표기는 정의에서 파생한다 — 하드코딩하면 바인딩이 바뀔 때 조용히 어긋난다
  // (ADR-182 후속에서 실제로 3건이 어긋나 있었다).
  const undoLabel = formatShortcut(SHORTCUT_DEFINITIONS.undo);

  return (
    <section aria-label={t("ai.commandLogLabel")} className="ai-command-log">
      <h3 className="ai-command-log-title">
        {t("ai.commandLogTitle", { count: entries.length })}
      </h3>
      <ul className="ai-command-log-list">
        {recent.map((entry) => (
          <li
            className="ai-command-log-item"
            data-status={entry.status}
            key={entry.seq}
          >
            <span className="ai-command-log-id">{entry.id}</span>
            <span className="ai-command-log-status">
              {STATUS_LABEL_KEYS[entry.status]
                ? t(STATUS_LABEL_KEYS[entry.status])
                : entry.status}
              {entry.reason ? ` · ${entry.reason}` : ""}
              {entry.undoable
                ? t("ai.logRestorable", { shortcut: undoLabel })
                : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
