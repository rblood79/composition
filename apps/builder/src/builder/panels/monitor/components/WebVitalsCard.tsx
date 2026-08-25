/**
 * WebVitalsCard Component
 *
 * Core Web Vitals 표시 카드
 * - LCP, FID, CLS, TTFB
 * - Google 기준에 따른 상태 표시
 */

import { Gauge, MousePointer, Layout, Clock, RefreshCw } from "lucide-react";
import type { WebVitals } from "../hooks/useWebVitals";
import { iconEditProps } from "../../../../utils/ui/uiConstants";
import { ActionIconButton } from "../../../components";
import { translateKey, useOptionalI18n } from "../../../../i18n";

interface WebVitalsCardProps {
  vitals: WebVitals;
  onRefresh?: () => void;
}

// Good/Needs Improvement/Poor 기준 (Google 기준)
const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  fid: { good: 100, poor: 300 },
  cls: { good: 0.1, poor: 0.25 },
  ttfb: { good: 800, poor: 1800 },
};

function getStatus(
  metric: keyof typeof THRESHOLDS,
  value: number | null,
): "good" | "needs-improvement" | "poor" | "unknown" {
  if (value === null) return "unknown";
  const { good, poor } = THRESHOLDS[metric];
  if (value <= good) return "good";
  if (value <= poor) return "needs-improvement";
  return "poor";
}

function formatValue(
  metric: keyof typeof THRESHOLDS,
  value: number | null,
): string {
  if (value === null) return "—";
  if (metric === "cls") return value.toFixed(3);
  return Math.round(value).toString();
}

export function WebVitalsCard({ vitals, onRefresh }: WebVitalsCardProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `monitor.${key}`, fallback) : fallback;
  const metrics = [
    {
      key: "lcp" as const,
      label: "LCP",
      description: "Largest Contentful Paint",
      value: vitals.lcp,
      unit: "ms",
      icon: Gauge,
    },
    {
      key: "fid" as const,
      label: "FID",
      description: "First Input Delay",
      value: vitals.fid,
      unit: "ms",
      icon: MousePointer,
    },
    {
      key: "cls" as const,
      label: "CLS",
      description: "Cumulative Layout Shift",
      value: vitals.cls,
      unit: "",
      icon: Layout,
    },
    {
      key: "ttfb" as const,
      label: "TTFB",
      description: "Time to First Byte",
      value: vitals.ttfb,
      unit: "ms",
      icon: Clock,
    },
  ];

  return (
    <div className="web-vitals-card">
      <div className="web-vitals-header">
        <h4 className="web-vitals-title">
          {localize("coreWebVitals", "Core Web Vitals")}
        </h4>
        {onRefresh && (
          <ActionIconButton
            className="web-vitals-refresh"
            onPress={onRefresh}
            aria-label={localize("refreshWebVitals", "Refresh Web Vitals")}
            tooltip={localize("refreshWebVitals", "Refresh Web Vitals")}
          >
            <RefreshCw size={iconEditProps.size} aria-hidden="true" />
          </ActionIconButton>
        )}
      </div>
      <div className="web-vitals-grid">
        {metrics.map(({ key, label, description, value, unit, icon: Icon }) => (
          <div
            key={key}
            className="web-vital-item"
            data-status={getStatus(key, value)}
            title={description}
          >
            <Icon size={iconEditProps.size} aria-hidden="true" />
            <span className="web-vital-label">{label}</span>
            <span className="web-vital-value">
              {formatValue(key, value)}
              {value !== null && unit && (
                <span className="web-vital-unit">{unit}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
