/**
 * ToolCallMessage - 도구 호출 상태 표시
 */

import type { ReactNode } from "react";
import type { ToolCallInfo } from "../../../../types/integrations/chat.types";
import { Wrench, Check, X, LoaderCircle } from "lucide-react";

interface ToolCallMessageProps {
  toolCall: ToolCallInfo;
}

const TOOL_LABELS: Record<string, string> = {
  create_element: "요소 생성",
  update_element: "요소 수정",
  delete_element: "요소 삭제",
  get_editor_state: "에디터 상태 조회",
  get_selection: "선택 요소 조회",
  search_elements: "요소 검색",
  batch_design: "일괄 변경",
};

export function ToolCallMessage({ toolCall }: ToolCallMessageProps) {
  const label = TOOL_LABELS[toolCall.name] || toolCall.name;

  let statusIcon: ReactNode;
  switch (toolCall.status) {
    case "pending":
    case "running":
      statusIcon = <LoaderCircle size={14} className="tool-call-spinner" />;
      break;
    case "success":
      statusIcon = <Check size={14} />;
      break;
    case "error":
      statusIcon = <X size={14} />;
      break;
  }

  return (
    <div className="tool-call-message" data-status={toolCall.status}>
      <div className="tool-call-header">
        <Wrench size={14} />
        <span className="tool-call-label">{label}</span>
        {statusIcon}
      </div>
      {toolCall.error && (
        <div className="tool-call-error">{toolCall.error}</div>
      )}
    </div>
  );
}
