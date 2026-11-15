/**
 * ADR-306 — paint 역할 → 토큰 (breakdown §5.1). rule `Chart.chart.paint` 가 정본이고, 없는 키는 아래
 * 기본 토큰이다 (`others` · `reference` 의 fallback 과 같은 규약). DOM 은 생성 CSS 의
 * `--chart-paint-<role>`, Skia 는 같은 TokenRef 를 푼다 — 색 계산식 (보간 · color-mix) 은 없다.
 */
import type { ChartPaintRole } from "./types";

export const CHART_PAINT_FALLBACK_TOKENS: Readonly<
  Record<ChartPaintRole, string>
> = {
  accent: "{color.chart-accent-1}",
  neutral: "{color.neutral-subdued}",
  positive: "{color.positive}",
  negative: "{color.negative}",
  // 값 단계 (heatmap · calendar) — 빈 칸 + accent 사다리 밝은 쪽부터 (ADR-302 단 400 → 1200).
  "step-0": "{color.neutral-subtle}",
  "step-1": "{color.chart-accent-4}",
  "step-2": "{color.chart-accent-3}",
  "step-3": "{color.chart-accent-2}",
  "step-4": "{color.chart-accent-1}",
};

export function chartPaintToken(
  channel:
    { paint?: Readonly<Partial<Record<ChartPaintRole, string>>> } | undefined,
  role: ChartPaintRole,
): string {
  return channel?.paint?.[role] ?? CHART_PAINT_FALLBACK_TOKENS[role];
}

/** DOM — 생성 CSS 변수 (`CSSGenerator` 가 rule `chart.paint` 에서 낸다). */
export function chartPaintVar(role: ChartPaintRole): string {
  return `var(--chart-paint-${role}, currentColor)`;
}
