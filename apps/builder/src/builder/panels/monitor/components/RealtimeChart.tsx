/**
 * RealtimeChart Component
 *
 * 실시간 시계열 차트
 * - SVG 기반 라인 차트
 * - Threshold 라인 표시
 * - 자동 스케일링
 */

import { useMemo } from "react";
import type { DataPoint } from "../hooks/useTimeSeriesData";
import { useResponsiveChartWidth } from "./useResponsiveChartWidth";

interface RealtimeChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  metric?: "memoryPercent" | "historyEntries";
  showThresholds?: boolean;
}

export function RealtimeChart({
  data,
  width = 400,
  height = 120,
  metric = "memoryPercent",
  showThresholds = true,
}: RealtimeChartProps) {
  const { chartRef, chartWidth: responsiveWidth } =
    useResponsiveChartWidth(width);
  const padding = { top: 10, right: 10, bottom: 20, left: 40 };
  const chartWidth = Math.max(
    1,
    responsiveWidth - padding.left - padding.right,
  );
  const chartHeight = height - padding.top - padding.bottom;

  // 데이터 범위 계산
  const { minValue, maxValue, pathD, points } = useMemo(() => {
    if (data.length === 0) {
      return { minValue: 0, maxValue: 100, pathD: "", points: [] };
    }

    const values = data.map((d) => d[metric]);
    const min = metric === "memoryPercent" ? 0 : Math.min(...values);
    const max = metric === "memoryPercent" ? 100 : Math.max(...values) * 1.1;
    const range = max - min || 1;

    const pts = data.map((d, i) => ({
      x: padding.left + (i / (data.length - 1 || 1)) * chartWidth,
      y: padding.top + chartHeight - ((d[metric] - min) / range) * chartHeight,
      value: d[metric],
      time: d.timestamp,
    }));

    const path = pts
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");

    return { minValue: min, maxValue: max, pathD: path, points: pts };
  }, [data, metric, chartWidth, chartHeight, padding.left, padding.top]);

  // 시간 라벨 (10초 간격) - 최신 데이터 포인트 기준 상대 시간
  const timeLabels = useMemo(() => {
    if (data.length < 2) return [];
    const labels = [];
    const latestTimestamp = data[data.length - 1].timestamp;
    for (let i = 0; i < data.length; i += 10) {
      const d = data[i];
      const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
      // 최신 데이터 포인트 대비 상대 시간 계산 (pure function)
      const timeAgo = Math.round((latestTimestamp - d.timestamp) / 1000);
      labels.push({ x, label: `-${timeAgo}s` });
    }
    return labels;
  }, [data, chartWidth, padding.left]);

  // Y축 라벨
  const yLabels = useMemo(() => {
    const labels = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const value = minValue + ((maxValue - minValue) * i) / steps;
      const y = padding.top + chartHeight - (i / steps) * chartHeight;
      labels.push({
        y,
        label:
          metric === "memoryPercent"
            ? `${Math.round(value)}%`
            : Math.round(value).toString(),
      });
    }
    return labels;
  }, [minValue, maxValue, chartHeight, padding.top, metric]);

  return (
    <svg
      ref={chartRef}
      width="100%"
      height={height}
      className="realtime-chart"
      aria-label={`Real-time ${metric} chart showing last ${data.length} seconds`}
      role="img"
    >
      {/* 배경 그리드 */}
      <g className="chart-grid" aria-hidden="true">
        {yLabels.map((label, i) => (
          <line
            key={i}
            x1={padding.left}
            y1={label.y}
            x2={responsiveWidth - padding.right}
            y2={label.y}
            className="chart-grid-line"
          />
        ))}
      </g>

      {/* Threshold 라인 */}
      {showThresholds && metric === "memoryPercent" && (
        <g className="threshold-lines" aria-hidden="true">
          {/* 60% 경고 */}
          <line
            x1={padding.left}
            y1={padding.top + chartHeight * 0.4}
            x2={responsiveWidth - padding.right}
            y2={padding.top + chartHeight * 0.4}
            className="chart-threshold-warning"
          />
          {/* 75% 위험 */}
          <line
            x1={padding.left}
            y1={padding.top + chartHeight * 0.25}
            x2={responsiveWidth - padding.right}
            y2={padding.top + chartHeight * 0.25}
            className="chart-threshold-danger"
          />
        </g>
      )}

      {/* 데이터 영역 (그라데이션 fill) */}
      {pathD && points.length > 0 && (
        <g className="chart-area">
          <defs>
            <linearGradient
              id="realtimeAreaGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
              <stop
                offset="100%"
                stopColor="var(--accent)"
                stopOpacity="0.05"
              />
            </linearGradient>
          </defs>
          <path
            d={`${pathD} L ${points[points.length - 1]?.x ?? 0} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`}
            fill="url(#realtimeAreaGradient)"
          />
          <path d={pathD} fill="none" className="chart-line" />
        </g>
      )}

      {/* 현재 값 포인트 */}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="4"
          className="chart-dot"
        />
      )}

      {/* Y축 라벨 */}
      <g className="y-axis" aria-hidden="true">
        {yLabels.map((label, i) => (
          <text
            key={i}
            x={padding.left - 5}
            y={label.y + 4}
            textAnchor="end"
            className="chart-axis-label"
          >
            {label.label}
          </text>
        ))}
      </g>

      {/* X축 라벨 */}
      <g className="x-axis" aria-hidden="true">
        {timeLabels.map((label, i) => (
          <text
            key={i}
            x={label.x}
            y={height - 5}
            textAnchor="middle"
            className="chart-axis-label"
          >
            {label.label}
          </text>
        ))}
      </g>

      {/* 스크린 리더용 현재 값 */}
      <text className="sr-only">
        Current {metric}: {points[points.length - 1]?.value.toFixed(1) ?? "N/A"}
      </text>
    </svg>
  );
}
