/**
 * Tint → accent 색상 토큰
 *
 * Tint 프리셋의 oklch 값에서 accent 토큰 hex 값을 파생한다 (순수 — 토큰 맵 mutation 없음,
 * 설치는 `themeMaps.ts` `installThemeMaps`).
 *
 * preview-system.css의 oklch 값과 동일한 소스를 사용하여
 * CSS Preview ↔ Skia Canvas 색상 일치를 보장.
 *
 * @see preview-system.css (oklch 프리셋 원본)
 * @see ADR-021 Phase A
 */

import {
  CHART_ACCENT_STEPS,
  CHART_ACCENT_TOKENS,
} from "@composition/rendering";

import { oklchToHex } from "./oklchToHex";

// ============================================================================
// srgb color-mix 유틸 (CSS color-mix(in srgb, color P%, black) 정합)
// ============================================================================

/**
 * CSS `color-mix(in srgb, hexColor P%, black)` 과 동일한 결과를 반환.
 * srgb 채널별 선형 혼합: result = color × (percent/100)
 * (black = 0,0,0 이므로 두 번째 항은 0)
 */
export function mixWithBlackSrgb(hex: string, percent: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const p = percent / 100;
  const mr = Math.max(0, Math.min(255, Math.round(r * p)));
  const mg = Math.max(0, Math.min(255, Math.round(g * p)));
  const mb = Math.max(0, Math.min(255, Math.round(b * p)));
  return `#${mr.toString(16).padStart(2, "0")}${mg.toString(16).padStart(2, "0")}${mb.toString(16).padStart(2, "0")}`;
}

// ============================================================================
// Tint 프리셋 정의 (preview-system.css 기준)
// ============================================================================

export type TintPreset =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "turquoise"
  | "cyan"
  | "blue"
  | "indigo"
  | "purple"
  | "pink";

interface TintValue {
  /** oklch hue (0~360) */
  h: number;
  /** oklch chroma (0~0.4) */
  c: number;
}

/** oklch(L C H) — preview-system.css와 동일한 값 */
export const TINT_PRESETS: Record<TintPreset, TintValue> = {
  red: { h: 27.0726, c: 0.181447 },
  orange: { h: 54, c: 0.150492 },
  yellow: { h: 73.8032, c: 0.128516 },
  green: { h: 155.372, c: 0.121276 },
  turquoise: { h: 205.114, c: 0.081146 },
  cyan: { h: 243.926, c: 0.142107 },
  blue: { h: 266.315, c: 0.22049 },
  indigo: { h: 284.23, c: 0.25049 },
  purple: { h: 302, c: 0.223324 },
  pink: { h: 347.813, c: 0.177717 },
};

// ============================================================================
// Lightness 스케일 (preview-system.css 기준)
// ============================================================================

/**
 * preview-system.css의 --tint-900 ~ --tint-1200 lightness 값.
 * highlight-background는 항상 55% 고정.
 */
const LIGHTNESS = {
  light: {
    highlight: 0.55, // --highlight-background: oklch(from var(--tint) 55% c h)
    900: 0.579699,
    1000: 0.519076,
    1100: 0.469058,
    1200: 0.410821,
  },
  dark: {
    highlight: 0.55,
    900: 0.623039,
    1000: 0.670121,
    1100: 0.723297,
    1200: 0.791773,
  },
};

/**
 * 색 피커 Theme 팔레트용 accent 사다리 (panel-ui 05 #1) — theme 이 실제로 쓰는 lightness 6
 * (subtle · 900 · highlight 55% · 1000 · 1100 · 1200) 를 밝은 순으로. 새 값 0.
 */
export function resolveAccentLadder(
  tint: TintPreset,
  mode: "light" | "dark",
): string[] {
  const { h, c } = TINT_PRESETS[tint];
  const ls = LIGHTNESS[mode];
  const subtleL = mode === "light" ? 0.95 : 0.25;
  const steps: Array<[number, number]> = [
    [subtleL, c * 0.3],
    [ls[900], c],
    [ls.highlight, c],
    [ls[1000], c],
    [ls[1100], c],
    [ls[1200], c],
  ];
  return steps
    .sort((a, b) => b[0] - a[0])
    .map(([l, chroma]) => oklchToHex(l, chroma, h));
}

// ============================================================================
// accent 토큰 파생
// ============================================================================

export function createAccentColorTokens(
  c: number,
  h: number,
  mode: "light" | "dark",
): AccentColorTokens {
  const ls = LIGHTNESS[mode];

  // accent: highlight-background (55% lightness 고정)
  const accentHex = oklchToHex(ls.highlight, c, h);
  const subtleL = mode === "light" ? 0.95 : 0.25;
  const subtleC = c * 0.3;
  // Chart mono 팔레트 — chartPaletteMap.ts 의 (L, chroma 계수) 표. CSS `--chart-accent-N`
  //   (`oklch(from var(--tint) L calc(c × f) h)`) 과 같은 공식이라 두 leg 가 같은 단계를 본다.
  const chart = Object.fromEntries(
    CHART_ACCENT_STEPS.map((step, i) => [
      CHART_ACCENT_TOKENS[i],
      oklchToHex(step.lightness, c * step.chromaFactor, h),
    ]),
  ) as Record<(typeof CHART_ACCENT_TOKENS)[number], string>;
  return {
    accent: accentHex,
    "accent-hover": mixWithBlackSrgb(accentHex, 85),
    "accent-pressed": mixWithBlackSrgb(accentHex, 75),
    "on-accent": mode === "light" ? "#ffffff" : "#171717",
    "accent-subtle": oklchToHex(subtleL, subtleC, h),
    ...chart,
  };
}

// ============================================================================
// Per-element accent (ADR-021 Phase E)
// ============================================================================

/** accent 5개 토큰 스냅샷 */
export interface AccentColorTokens {
  accent: string;
  "accent-hover": string;
  "accent-pressed": string;
  "on-accent": string;
  "accent-subtle": string;
  "chart-accent-1": string;
  "chart-accent-2": string;
  "chart-accent-3": string;
  "chart-accent-4": string;
}

/**
 * 요소별 tint가 바꾸는 accent token만 pure value로 계산한다.
 * 전역 토큰 맵을 mutation 하지 않는다.
 */
export function resolveAccentColorTokens(
  accentTint: TintPreset | undefined,
  mode: "light" | "dark",
): AccentColorTokens | undefined {
  if (!accentTint || !(accentTint in TINT_PRESETS)) return undefined;
  const { h, c } = TINT_PRESETS[accentTint];
  return createAccentColorTokens(c, h, mode);
}

