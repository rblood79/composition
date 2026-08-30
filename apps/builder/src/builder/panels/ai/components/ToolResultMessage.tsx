/**
 * 도구 실행 결과 한 줄 (ADR-134 Phase 8, D9).
 *
 * Phase 8 이전에는 라벨 표가 도구 7종만 알고 있어서 Phase 3/4/ADR-196 이 더한 3종이
 * "도구 실행 완료" 로 뭉뚱그려졌다 — 무엇이 바뀌었는지 읽을 수 없었다. 어휘는 이제
 * `toolLabels` 정본 하나이고 도구 전수 대조를 테스트가 지킨다.
 */
import type { ChatMessage } from "../../../../types/integrations/chat.types";
import { describeToolResult } from "./toolLabels";

interface ToolResultMessageProps {
  message: ChatMessage;
}

export function ToolResultMessage({ message }: ToolResultMessageProps) {
  const toolName = message.metadata?.toolName ?? "";
  const result = message.metadata?.toolResult as
    Record<string, unknown> | undefined;

  if (!result) return null;

  const success = result.success !== false;

  return (
    <div className="tool-result-message" data-success={success}>
      <span className="tool-result-label">
        {describeToolResult(toolName, result)}
      </span>
    </div>
  );
}
