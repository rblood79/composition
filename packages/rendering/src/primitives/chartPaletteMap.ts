/**
 * Chart 시리즈 팔레트 표 — categorical (Spectrum) · mono (accent 명도 사다리).
 *
 * semantic 색 (`colorAliases.ts` alias 표 × Spectrum 사다리 — ADR-302) 과 달리 이 표는 사다리 단 좌표가 아니다:
 * - categorical 은 Adobe Spectrum 데이터 시각화 팔레트 **리터럴 hex** — 가장 가까운 Tailwind
 *   단계로 옮기면 OKLab ΔE 0.02~0.05 만큼 채도가 올라가 Tailwind 무지개로 되돌아간다 (리서치
 *   `docs/explanation/research/CHART_PALETTE_RESEARCH_2026-09.md` §3). 라이트·다크 공용 1벌
 *   (Spectrum 설계 — RSC `spectrumColors.ts` light == dark).
 * - mono 는 accent 사다리의 단 (`{color.chart-accent-1..4}` = alias 표 1200 · 900 · 700 · 400 — ADR-302
 *   사용자 결정 6). 값은 테마 resolver 가 Canvas 맵과 DOM 변수에 같이 싣는다 — 여기에는 없다.
 *
 * consumer: `paletteGenerator.renderChartPaletteCss` (categorical 을 `--chart-categorical-N` 으로 emit) · alias 표
 * (`colorAliases.ts` — categorical 상수 · accent 단, seed `colors.ts`). 순번 계약 (`--chart-series-N` ⇔ 팔레트 인덱스) 은 rule
 * `chart.series` / `chart.palettes` 가 이 토큰을 배열로 나열해 만든다.
 */

/**
 * Spectrum categorical 1~8 — 출처 adobe/react-spectrum-charts
 * `packages/themes/src/spectrumColors.ts` `categorical-100..800` (Spectrum 1; RSC 의 Spectrum 2
 * theme 도 기본 `range.category` 로 이 값을 쓴다 — `spectrum2Theme.ts:87`).
 * 순서 = 인접 대비 최대 (teal · indigo · orange · pink · periwinkle · green · blue · purple).
 */
export const CHART_CATEGORICAL_HEX = [
  "#0fb5ae",
  "#4046ca",
  "#f68511",
  "#de3d82",
  "#7e84fa",
  "#72e06a",
  "#147af3",
  "#7326d3",
] as const;

export const CHART_CATEGORICAL_COUNT = CHART_CATEGORICAL_HEX.length;

/** `{color.chart-categorical-N}` 토큰 키 (1-based) */
export type ChartCategoricalToken =
  `chart-categorical-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

export const CHART_CATEGORICAL_TOKENS = CHART_CATEGORICAL_HEX.map(
  (_, i) => `chart-categorical-${i + 1}` as ChartCategoricalToken,
);

export function chartCategoricalCssVar(index: number): `--${string}` {
  return `--chart-categorical-${index + 1}`;
}

/** accent 사다리 단 4 의 토큰 — 값은 alias 표 (`colorAliases.ts` 1200 · 900 · 700 · 400, ADR-302 사용자 결정 6). */
export type ChartAccentToken = `chart-accent-${1 | 2 | 3 | 4}`;

export const CHART_ACCENT_TOKENS = ([1, 2, 3, 4] as const).map(
  (n) => `chart-accent-${n}` as ChartAccentToken,
);
