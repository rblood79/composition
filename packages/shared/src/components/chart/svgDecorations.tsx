import React from "react";
import { CHART_OTHERS_COLOR_INDEX } from "@composition/specs";
import type { Mark, TextMark, ChartScene } from "@composition/specs";
/** scene 의 series 인덱스 → CSS 변수. 1-based (shadcn `--chart-1..N` 관례). */
export function seriesVar(index: number): string {
  // ADR-211 others 범주 (`CHART_OTHERS_COLOR_INDEX` −1) — 팔레트가 아니라 `--chart-others`.
  if (index === CHART_OTHERS_COLOR_INDEX)
    return "var(--chart-others, currentColor)";
  return `var(--chart-series-${index + 1}, currentColor)`;
}

const ROLE_FILL: Record<TextMark["role"], string> = {
  tick: "var(--chart-axis, currentColor)",
  legend: "currentColor",
  empty: "var(--chart-axis, currentColor)",
  // 값 레이블은 데이터를 읽는 글자다 — 축 보조색이 아니라 본문 전경색.
  value: "currentColor",
};

const ANCHOR_MAP = {
  start: "start",
  middle: "middle",
  end: "end",
} as const;

const BASELINE_MAP = {
  top: "hanging",
  middle: "central",
  bottom: "alphabetic",
} as const;

export function renderText(mark: TextMark, key: string): React.ReactElement {
  return (
    <text
      key={key}
      x={mark.x}
      y={mark.y}
      textAnchor={ANCHOR_MAP[mark.anchor]}
      dominantBaseline={BASELINE_MAP[mark.baseline]}
      fill={ROLE_FILL[mark.role]}
      // fontScale 은 부모 svg 의 font-size 기준 배율 — em 이라야 Skia 의
      //   metrics.fontSize 곱과 같은 값이 된다.
      fontSize={mark.fontScale ? `${mark.fontScale}em` : "inherit"}
    >
      {mark.text}
    </text>
  );
}

export function renderMark(mark: Mark, key: string): React.ReactElement | null {
  switch (mark.kind) {
    case "rect":
      return (
        <rect
          key={key}
          x={mark.x}
          y={mark.y}
          width={mark.w}
          height={mark.h}
          fill={seriesVar(mark.seriesIndex)}
        />
      );
    case "path":
      return (
        <path
          key={key}
          d={mark.d}
          fill={
            // 축 토큰 채우기 (ADR-207 radial 트랙) — Skia 의 fillRole 분기와 같은 규약.
            mark.fillRole !== undefined
              ? mark.fillRole === "grid"
                ? "var(--chart-grid, currentColor)"
                : "var(--chart-axis, currentColor)"
              : mark.fillSeries !== undefined
                ? seriesVar(mark.fillSeries)
                : "none"
          }
          fillOpacity={
            mark.fillRole !== undefined
              ? 0.35
              : mark.fillSeries !== undefined
                ? 0.85
                : undefined
          }
          fillRule={mark.fillRule}
          stroke={
            // 격자·축 path (ADR-207 극좌표) 는 축 토큰 — Skia 쪽 `pushMark` 와 같은 규약.
            mark.role !== undefined
              ? mark.role === "grid"
                ? "var(--chart-grid, currentColor)"
                : "var(--chart-axis, currentColor)"
              : mark.strokeSeries !== undefined
                ? seriesVar(mark.strokeSeries)
                : "none"
          }
          strokeWidth={
            mark.role !== undefined ? (mark.strokeWidth ?? 1) : mark.strokeWidth
          }
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      );
    case "line":
      return (
        <line
          key={key}
          x1={mark.x1}
          y1={mark.y1}
          x2={mark.x2}
          y2={mark.y2}
          stroke={
            mark.role === "grid"
              ? "var(--chart-grid, currentColor)"
              : "var(--chart-axis, currentColor)"
          }
          strokeWidth={1}
        />
      );
    case "text":
      return renderText(mark, key);
    default:
      return null;
  }
}

/** scene → SVG 자식 목록. Skia primitive 와 **같은 순서** 로 그린다 (겹침 순서 대칭). */
export function renderChartScene(scene: ChartScene): React.ReactElement[] {
  const nodes: React.ReactElement[] = [];

  for (const axis of scene.axes) {
    axis.grid.forEach((line, i) => {
      const node = renderMark(line, `grid-${axis.axis}-${i}`);
      if (node) nodes.push(node);
    });
  }
  scene.marks.forEach((mark, i) => {
    const node = renderMark(mark, `mark-${i}`);
    if (node) nodes.push(node);
  });
  for (const axis of scene.axes) {
    if (axis.line) {
      const node = renderMark(axis.line, `axis-${axis.axis}`);
      if (node) nodes.push(node);
    }
    axis.ticks.forEach((tick, i) => {
      nodes.push(renderText(tick, `tick-${axis.axis}-${i}`));
    });
  }
  if (scene.legend) {
    scene.legend.items.forEach((item, i) => {
      const swatch = renderMark(item.swatch, `legend-swatch-${i}`);
      if (swatch) nodes.push(swatch);
      nodes.push(renderText(item.text, `legend-text-${i}`));
    });
  }

  return nodes;
}
