/**
 * ADR-306 — 상자 → 그리는 영역 (padding 을 뺀 `outer`). 시리즈 경로의 `resolveChartLayout` 과 같은
 * 식이다 — family 는 범례 · 축 자리를 스스로 정하므로 outer 만 공유한다.
 */
import { r2 } from "./scales";
import type { ChartMetrics, ChartSize, Rect } from "./types";

export interface ChartFrame {
  size: ChartSize;
  outer: Rect;
  fontSize: number;
}

export function chartFrame(size: ChartSize, metrics: ChartMetrics): ChartFrame {
  const width = Number.isFinite(size.width) ? Math.max(0, size.width) : 0;
  const height = Number.isFinite(size.height) ? Math.max(0, size.height) : 0;
  const pad =
    typeof metrics.padding === "number"
      ? {
          top: metrics.padding,
          right: metrics.padding,
          bottom: metrics.padding,
          left: metrics.padding,
        }
      : metrics.padding;
  return {
    size: { width: r2(width), height: r2(height) },
    outer: {
      x: r2(pad.left),
      y: r2(pad.top),
      w: r2(Math.max(0, width - pad.left - pad.right)),
      h: r2(Math.max(0, height - pad.top - pad.bottom)),
    },
    fontSize: metrics.fontSize,
  };
}
