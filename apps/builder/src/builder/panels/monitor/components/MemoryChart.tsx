/**
 * MemoryChart Component
 *
 * SVG 기반 시계열 메모리 사용량 차트
 * - 최대 60개 데이터 포인트 (10분)
 * - 부드러운 라인 그래프
 * - 현재 값 표시
 */

import { useMemo } from "react";
import { formatBytes } from "../hooks/useMemoryStats";
import { useResponsiveChartWidth } from "./useResponsiveChartWidth";
import { translateKey, useOptionalI18n } from "../../../../i18n";

interface MemoryChartProps {
  /** 메모리 사용량 히스토리 (bytes 배열) */
  data: number[];
  /** 차트 너비 */
  width?: number;
  /** 차트 높이 */
  height?: number;
  /** 임계값 (bytes) - 이 값 이상이면 위험 색상 */
  threshold?: number;
}

export function MemoryChart({
  data,
  width = 400,
  height = 120,
  threshold,
}: MemoryChartProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `monitor.${key}`, fallback) : fallback;
  const { chartRef, chartWidth: responsiveWidth } =
    useResponsiveChartWidth(width);
  const padding = { top: 10, right: 10, bottom: 20, left: 50 };
  const chartWidth = Math.max(
    1,
    responsiveWidth - padding.left - padding.right,
  );
  const chartHeight = height - padding.top - padding.bottom;

  // 데이터 범위 계산
  const { minValue, maxValue, yScale, xScale, pathD } = useMemo(() => {
    if (data.length === 0) {
      return {
        minValue: 0,
        maxValue: 1,
        yScale: () => 0,
        xScale: () => 0,
        pathD: "",
      };
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    // 최소 범위 보장 (데이터가 평평할 때)
    const range = max - min || max * 0.1 || 1;
    const adjustedMin = Math.max(0, min - range * 0.1);
    const adjustedMax = max + range * 0.1;

    const yScaleFn = (value: number) =>
      chartHeight -
      ((value - adjustedMin) / (adjustedMax - adjustedMin)) * chartHeight;
    const xScaleFn = (index: number) =>
      (index / (data.length - 1 || 1)) * chartWidth;

    // SVG path 생성
    const points = data.map((value, index) => ({
      x: xScaleFn(index),
      y: yScaleFn(value),
    }));

    const path = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

    return {
      minValue: adjustedMin,
      maxValue: adjustedMax,
      yScale: yScaleFn,
      xScale: xScaleFn,
      pathD: path,
    };
  }, [data, chartWidth, chartHeight]);

  // 현재 값
  const currentValue = data[data.length - 1] || 0;
  const isAboveThreshold = threshold && currentValue > threshold;

  // Y축 눈금
  const yTicks = useMemo(() => {
    const tickCount = 3;
    const range = maxValue - minValue;
    const step = range / (tickCount - 1);
    return Array.from({ length: tickCount }, (_, i) => minValue + step * i);
  }, [minValue, maxValue]);

  return (
    <div className="memory-chart">
      <svg
        ref={chartRef}
        width="100%"
        height={height}
        aria-label={localize("memoryUsageChart", "Memory usage chart")}
        role="img"
      >
        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {/* Grid lines */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={0}
                y1={yScale(tick)}
                x2={chartWidth}
                y2={yScale(tick)}
                className="chart-grid-line"
              />
              <text
                x={-8}
                y={yScale(tick)}
                className="chart-axis-label"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {formatBytes(tick)}
              </text>
            </g>
          ))}

          {/* Threshold line */}
          {threshold && (
            <line
              x1={0}
              y1={yScale(threshold)}
              x2={chartWidth}
              y2={yScale(threshold)}
              className="chart-threshold-line"
            />
          )}

          {/* Data line */}
          {data.length > 1 && (
            <path
              d={pathD}
              className={`chart-line ${isAboveThreshold ? "chart-line-danger" : ""}`}
              fill="none"
            />
          )}

          {/* Current value dot */}
          {data.length > 0 && (
            <circle
              cx={xScale(data.length - 1)}
              cy={yScale(currentValue)}
              r={4}
              className={`chart-dot ${isAboveThreshold ? "chart-dot-danger" : ""}`}
            />
          )}

          {/* X axis label */}
          <text
            x={chartWidth / 2}
            y={chartHeight + 15}
            className="chart-axis-label"
            textAnchor="middle"
          >
            Last {Math.min(data.length, 60) * 10}s
          </text>
        </g>
      </svg>

      {/* Current value display */}
      <div
        className="monitor-summary"
        data-status={isAboveThreshold ? "danger" : undefined}
      >
        <span className="monitor-summary-label">
          {localize("current", "Current:")}
        </span>
        <span className="monitor-summary-value">
          {formatBytes(currentValue)}
        </span>
      </div>
    </div>
  );
}
