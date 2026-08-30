/**
 * AgentControls - 에이전트 실행 중 제어 UI
 */

import { Square } from "lucide-react";
import { ActionIconButton } from "../../../components";
import { useI18n } from "@/i18n";

interface AgentControlsProps {
  currentTurn: number;
  onStop: () => void;
}

export function AgentControls({ currentTurn, onStop }: AgentControlsProps) {
  const { t } = useI18n();

  return (
    <div className="ai-agent-controls">
      <span className="ai-agent-status">
        {t("ai.agentRunning", { turn: currentTurn })}
      </span>
      <ActionIconButton
        className="ai-agent-stop"
        onPress={onStop}
        type="button"
        aria-label={t("ai.agentStop")}
        tooltip={t("ai.agentStop")}
      >
        <Square size={12} />
      </ActionIconButton>
    </div>
  );
}
