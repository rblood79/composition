/**
 * AgentControls - 에이전트 실행 중 제어 UI
 */

import { Square } from "lucide-react";
import { ActionIconButton } from "../../../components";

interface AgentControlsProps {
  currentTurn: number;
  onStop: () => void;
}

export function AgentControls({ currentTurn, onStop }: AgentControlsProps) {
  return (
    <div className="ai-agent-controls">
      <span className="ai-agent-status">도구 실행 중 ({currentTurn}/10)</span>
      <ActionIconButton
        className="ai-agent-stop"
        onPress={onStop}
        type="button"
        aria-label="에이전트 중단"
        tooltip="에이전트 중단"
      >
        <Square size={12} />
      </ActionIconButton>
    </div>
  );
}
