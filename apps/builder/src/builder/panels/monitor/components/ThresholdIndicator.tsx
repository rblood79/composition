/**
 * ThresholdIndicator Component
 *
 * 메모리 사용량 임계값 표시기
 * - 60% 이상: 경고 (노란색)
 * - 75% 이상: 위험 (빨간색)
 * - 60% 미만: 정상 (녹색)
 */

import { AlertTriangle, CircleAlert, CircleCheck } from "lucide-react";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { translateKey, useOptionalI18n } from "../../../../i18n";

type ThresholdLevel = "safe" | "warning" | "danger";

interface ThresholdIndicatorProps {
  /** 현재 사용량 (0-100%) */
  value: number;
  /** 경고 임계값 (기본: 60%) */
  warningThreshold?: number;
  /** 위험 임계값 (기본: 75%) */
  dangerThreshold?: number;
  /** 라벨 텍스트 */
  label?: string;
}

export function ThresholdIndicator({
  value,
  warningThreshold = 60,
  dangerThreshold = 75,
  label = "Memory Usage",
}: ThresholdIndicatorProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `monitor.${key}`, fallback) : fallback;
  const threshold: ThresholdLevel =
    value >= dangerThreshold
      ? "danger"
      : value >= warningThreshold
        ? "warning"
        : "safe";

  const Icon =
    threshold === "danger"
      ? CircleAlert
      : threshold === "warning"
        ? AlertTriangle
        : CircleCheck;

  const statusText =
    threshold === "danger"
      ? localize("danger", "Danger")
      : threshold === "warning"
        ? localize("warning", "Warning")
        : localize("safe", "Safe");

  return (
    <div className="threshold-indicator" data-threshold={threshold}>
      <Icon size={iconProps.size} aria-hidden="true" />
      <span className="sr-only">{statusText}: </span>
      <span>
        {label}: {value.toFixed(1)}%
      </span>
    </div>
  );
}
