/**
 * 실행 중인 도구 한 줄 (ADR-134 Phase 8, D9).
 *
 * 결과만 보여주면 도구가 도는 동안 화면이 멈춘 것처럼 보인다. 어휘는 `toolLabels` 정본을
 * 쓴다 — 도구가 늘어도 여기서 다시 이름을 적지 않는다.
 */
import { LoaderCircle, Wrench, X } from "lucide-react";
import { describeToolCall } from "./toolLabels";
import { useI18n } from "@/i18n";

interface ToolCallMessageProps {
  name: string;
  status: "running" | "error";
  error?: string;
}

export function ToolCallMessage({ name, status, error }: ToolCallMessageProps) {
  const { t } = useI18n();

  return (
    <div className="tool-call-message" data-status={status}>
      <div className="tool-call-header">
        <Wrench size={13} />
        <span className="tool-call-label">{describeToolCall(name, t)}</span>
        {status === "running" ? (
          <LoaderCircle className="tool-call-spinner" size={13} />
        ) : (
          <X size={13} />
        )}
      </div>
      {error && <div className="tool-call-error">{error}</div>}
    </div>
  );
}
