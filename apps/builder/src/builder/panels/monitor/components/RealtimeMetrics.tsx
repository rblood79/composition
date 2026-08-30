/**
 * RealtimeMetrics — 실시간 지표 5칸 그리드 (FPS + Core Web Vitals 4종).
 *
 * 종전에는 FPS 하나가 카드 하나(현재값 큰 숫자 + Avg/Min/Max + 미니 바 차트)를 통째로 쓰고
 * Web Vitals 4개가 옆 카드 안에서 2×2 로 접혀, **같은 종류의 지표 5개가 두 가지 크기·두 가지
 * 어법으로** 보였다. 다섯 개는 같은 무게의 실시간 측정값이므로 한 격자에 같은 크기로 둔다.
 *
 * 칸 하나의 어법은 패널 필드와 같다 — `fieldset.properties-aria` + `legend.fieldset-legend`
 * (지표 이름) + `.react-aria-Group`(값 상자). Stats/Browser 탭의 `MonitorStat` 과 같은 재료다.
 * 상태(good/needs-improvement/poor)는 값 상자의 `data-status` 로만 표현한다.
 */

import { Clock, Film, Gauge, Layout, MousePointer } from "lucide-react";
import type { ComponentType } from "react";
import type { FPSData } from "../hooks/useFPSMonitor";
import type { WebVitals } from "../hooks/useWebVitals";
import { iconEditProps } from "../../../../utils/ui/uiConstants";
import { translateKey, useOptionalI18n } from "../../../../i18n";

interface RealtimeMetricsProps {
  fps: FPSData;
  vitals: WebVitals;
}

type MetricStatus = "good" | "needs-improvement" | "poor" | "unknown";

/** Google 기준 (Core Web Vitals). FPS 는 60Hz 호환 최소선 기준. */
const VITAL_THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  fid: { good: 100, poor: 300 },
  cls: { good: 0.1, poor: 0.25 },
  ttfb: { good: 800, poor: 1800 },
} as const;

type VitalKey = keyof typeof VITAL_THRESHOLDS;

function vitalStatus(metric: VitalKey, value: number | null): MetricStatus {
  if (value === null) return "unknown";
  const { good, poor } = VITAL_THRESHOLDS[metric];
  if (value <= good) return "good";
  if (value <= poor) return "needs-improvement";
  return "poor";
}

/** 낮을수록 나쁜 축이라 Web Vitals 와 부등호 방향이 반대다. */
function fpsStatus(fps: number): MetricStatus {
  if (fps >= 55) return "good";
  if (fps >= 30) return "needs-improvement";
  return "poor";
}

function formatVital(metric: VitalKey, value: number | null): string {
  if (value === null) return "—";
  if (metric === "cls") return value.toFixed(3);
  return Math.round(value).toString();
}

interface MetricCell {
  key: string;
  label: string;
  description: string;
  value: string;
  unit: string;
  status: MetricStatus;
  icon: ComponentType<{
    size?: number | string;
    "aria-hidden"?: boolean | "true" | "false";
  }>;
}

export function RealtimeMetrics({ fps, vitals }: RealtimeMetricsProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `monitor.${key}`, fallback) : fallback;

  const cells: MetricCell[] = [
    {
      key: "fps",
      label: localize("fps", "FPS"),
      // Avg/Min/Max 는 칸을 키우지 않도록 툴팁·스크린리더로 옮겼다.
      description: `${localize("avg", "Avg")} ${fps.average} · ${localize("min", "Min")} ${fps.min} · ${localize("max", "Max")} ${fps.max}`,
      value: String(fps.current),
      unit: localize("fpsUnit", "fps"),
      status: fpsStatus(fps.current),
      icon: Film,
    },
    {
      key: "lcp",
      label: "LCP",
      description: "Largest Contentful Paint",
      value: formatVital("lcp", vitals.lcp),
      unit: vitals.lcp === null ? "" : "ms",
      status: vitalStatus("lcp", vitals.lcp),
      icon: Gauge,
    },
    {
      key: "cls",
      label: "CLS",
      description: "Cumulative Layout Shift",
      value: formatVital("cls", vitals.cls),
      unit: "",
      status: vitalStatus("cls", vitals.cls),
      icon: Layout,
    },
    {
      key: "fid",
      label: "FID",
      description: "First Input Delay",
      value: formatVital("fid", vitals.fid),
      unit: vitals.fid === null ? "" : "ms",
      status: vitalStatus("fid", vitals.fid),
      icon: MousePointer,
    },
    {
      key: "ttfb",
      label: "TTFB",
      description: "Time to First Byte",
      value: formatVital("ttfb", vitals.ttfb),
      unit: vitals.ttfb === null ? "" : "ms",
      status: vitalStatus("ttfb", vitals.ttfb),
      icon: Clock,
    },
  ];

  return (
    <div className="fieldset-row monitor-metrics-row">
      {cells.map(
        ({ key, label, description, value, unit, status, icon: Icon }) => (
          <fieldset
            className="properties-aria monitor-metric"
            key={key}
            title={description}
          >
            <legend className="fieldset-legend">{label}</legend>
            <div
              className="react-aria-Group monitor-metric-value"
              data-status={status}
            >
              <Icon size={iconEditProps.size} aria-hidden="true" />
              <span>
                {value}
                {unit && <span className="monitor-metric-unit">{unit}</span>}
              </span>
            </div>
            <span className="sr-only">
              {description}. {value} {unit}
            </span>
          </fieldset>
        ),
      )}
    </div>
  );
}
