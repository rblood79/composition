/**
 * Chart 시리즈 팔레트 표 — categorical (Spectrum) · mono (accent 명도 사다리).
 *
 * `semanticPaletteMap.ts` 와 달리 이 표는 Tailwind 단계 좌표가 아니다:
 * - categorical 은 Adobe Spectrum 데이터 시각화 팔레트 **리터럴 hex** — 가장 가까운 Tailwind
 *   단계로 옮기면 OKLab ΔE 0.02~0.05 만큼 채도가 올라가 Tailwind 무지개로 되돌아간다 (리서치
 *   `docs/explanation/research/CHART_PALETTE_RESEARCH_2026-09.md` §3). 라이트·다크 공용 1벌
 *   (Spectrum 설계 — RSC `spectrumColors.ts` light == dark).
 * - mono 는 `--tint` (accent) 에서 **파생**하는 명도 단계라 값이 아니라 공식이다. CSS 는
 *   `oklch(from var(--tint) L calc(c × f) h)`, Skia 는 `tintToSkiaColors` 가 같은 (L, f) 로
 *   계산한다 — 표가 하나라 두 consumer 가 같은 단계를 본다.
 *
 * 두 consumer: `paletteGenerator.renderSemanticCss` (categorical 을 `--chart-categorical-N` 으로
 * emit) · `colors.ts` (Skia 초기값). 순번 계약 (`--chart-series-N` ⇔ 팔레트 인덱스) 은 rule
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

/**
 * accent 명도 사다리 — (oklch L, chroma 계수). 1 이 가장 짙고 4 가 가장 옅다.
 * L 0.55 는 `--accent` 자체 (`preview-system.css` `oklch(from var(--tint) 55% c h)`).
 * 라이트·다크 공용 (accent 가 테마 불변인 규칙과 같다).
 */
export const CHART_ACCENT_STEPS = [
  { lightness: 0.4, chromaFactor: 1 },
  { lightness: 0.55, chromaFactor: 1 },
  { lightness: 0.7, chromaFactor: 0.85 },
  { lightness: 0.85, chromaFactor: 0.5 },
] as const;

export type ChartAccentToken = `chart-accent-${1 | 2 | 3 | 4}`;

export const CHART_ACCENT_TOKENS = CHART_ACCENT_STEPS.map(
  (_, i) => `chart-accent-${i + 1}` as ChartAccentToken,
);

/**
 * 기본 tint (blue — `TINT_PRESETS.blue` h 266.315 · c 0.22049) 에서 위 단계로 계산한 hex.
 * `tintToSkiaColors` 가 부팅 시 같은 공식으로 덮어쓰므로 여기 값은 tint 적용 전 초기값이다.
 * (`apps/builder/src/utils/theme/tintToSkiaColors.test.ts` 가 공식 == 이 값을 판정한다.)
 */
export const CHART_ACCENT_DEFAULT_HEX = [
  "#142bbb",
  "#3660f0",
  "#6896ff",
  "#acccff",
] as const;

/** `colors.ts` 스프레드용 — 테마 공용. */
export function resolveChartPaletteColors(): Record<
  ChartCategoricalToken | ChartAccentToken,
  string
> {
  const out = {} as Record<ChartCategoricalToken | ChartAccentToken, string>;
  CHART_CATEGORICAL_TOKENS.forEach((token, i) => {
    out[token] = CHART_CATEGORICAL_HEX[i];
  });
  CHART_ACCENT_TOKENS.forEach((token, i) => {
    out[token] = CHART_ACCENT_DEFAULT_HEX[i];
  });
  return out;
}
