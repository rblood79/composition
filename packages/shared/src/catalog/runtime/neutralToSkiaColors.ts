/**
 * Neutral Preset → neutral 색상 토큰
 *
 * 기본 neutral은 S2 역할값, 사용자 tone은 Tailwind v4 5종 gray 팔레트에서 파생한다 (순수 — 토큰 맵 mutation
 * 없음, 설치는 `themeMaps.ts` `installThemeMaps`).
 *
 * @see packages/rendering/src/primitives/generated/tailwindPalette.ts (ADR-191 — tailwindcss/theme.css 파생, 손 복사 금지)
 * @see ADR-021 Phase B
 */

import {
  TAILWIND_PALETTE,
  lightColors,
  darkColors,
} from "@composition/rendering";

// themeMaps가 공개 표를 갱신하기 전에 캡처한다. reset/Undo는 설치된 사용자 색을 기본값으로 읽지 않는다.
const DEFAULT_SURFACE_KEYS = [
  "base",
  "layer-1",
  "layer-2",
  "elevated",
  "border-disabled",
  "disabled",
  "disabled-content",
  "neutral-content",
  "neutral-subdued",
  "field-placeholder",
  "neutral-content-hover",
  "neutral-fill",
  "neutral-surface",
  "neutral-surface-hover",
  "neutral-outline",
  "neutral-outline-hover",
  "on-neutral",
  "neutral-fill-hover",
  "neutral-fill-pressed",
] as const;
const DEFAULT_SURFACES = {
  light: Object.fromEntries(
    DEFAULT_SURFACE_KEYS.map((key) => [key, lightColors[key]]),
  ),
  dark: Object.fromEntries(
    DEFAULT_SURFACE_KEYS.map((key) => [key, darkColors[key]]),
  ),
};

// ============================================================================
// Types
// ============================================================================

export type NeutralPreset = "slate" | "gray" | "zinc" | "neutral" | "stone";

// ============================================================================
// Tailwind v4 Gray 팔레트 — 생성 팔레트 참조 (ADR-191)
// ============================================================================

export const NEUTRAL_PALETTES: Record<NeutralPreset, Record<number, string>> = {
  slate: { ...TAILWIND_PALETTE.slate },
  gray: { ...TAILWIND_PALETTE.gray },
  zinc: { ...TAILWIND_PALETTE.zinc },
  neutral: { ...TAILWIND_PALETTE.neutral },
  stone: { ...TAILWIND_PALETTE.stone },
};

// ============================================================================
// S2 토큰 ↔ neutral step 매핑
// ============================================================================

/** Light mode: S2 토큰 → palette step (또는 고정 hex) */
const LIGHT_MAP: Record<string, number | string> = {
  "neutral-content": 900,
  "neutral-content-hover": 950,
  "neutral-fill": 900,
  "neutral-surface": 200,
  "neutral-surface-hover": 300,
  "neutral-outline": 300,
  "neutral-outline-hover": 400,
  "on-neutral": "#ffffff",

  neutral: 900,
  "neutral-subdued": 600, // S2 #505050 에 가장 가까운 단계 (2026-09-29, 종전 700)
  "field-placeholder": 500,
  "neutral-subtle": 200,
  "neutral-hover": 300,
  "neutral-pressed": 400,
  // 진한 바탕 `neutral` (900) 의 hover · pressed — S2 `nextColorStop` 한 단 (ADR-293 결정 4)
  "neutral-fill-hover": 950,
  "neutral-fill-pressed": 950,
  base: "#ffffff",
  "layer-1": 50,
  "layer-2": 50,
  elevated: "#ffffff",
  disabled: 200,
  border: 300,
  "border-hover": 400,
  "border-disabled": 100,
};

/** Dark mode: S2 토큰 → palette step (또는 고정 hex) */
const DARK_MAP: Record<string, number | string> = {
  "neutral-content": 100,
  "neutral-content-hover": 50,
  "neutral-fill": 100,
  "neutral-surface": 700,
  "neutral-surface-hover": 600,
  "neutral-outline": 700,
  "neutral-outline-hover": 600,
  "on-neutral": 900,

  neutral: 100,
  "neutral-subdued": 400,
  "field-placeholder": 500,
  "neutral-subtle": 700,
  "neutral-hover": 600,
  "neutral-pressed": 500,
  "neutral-fill-hover": 50,
  "neutral-fill-pressed": 50,
  base: 900,
  "layer-1": 800,
  "layer-2": 800,
  elevated: 800,
  disabled: 700,
  border: 700,
  "border-hover": 500,
  "border-disabled": 800,
};

// ============================================================================
// neutral 토큰 파생
// ============================================================================

/** ADR-227 — 순수: neutral 프리셋 → 토큰 맵 (mutation 없음). `installThemeMaps` 가 쓴다. */
export function resolveNeutralColorTokens(
  preset: NeutralPreset,
  mode: "light" | "dark",
): Record<string, string> {
  const colors = neutralColorTokens(
    NEUTRAL_PALETTES[preset] ?? NEUTRAL_PALETTES.neutral,
    mode === "dark" ? DARK_MAP : LIGHT_MAP,
  );
  // 기본 tone은 S2 역할값을 그대로 사용한다. 사용자 tone 선택은 기존 팔레트 파생을 따른다.
  if (preset === "neutral" || !(preset in NEUTRAL_PALETTES)) {
    const defaults = DEFAULT_SURFACES[mode];
    for (const key of DEFAULT_SURFACE_KEYS) colors[key] = defaults[key];
  }
  return colors;
}

/** neutral 11 단계 hex (DOM `--color-neutral-N`). */
export function resolveNeutralSteps(
  preset: NeutralPreset,
): Record<number, string> {
  return NEUTRAL_PALETTES[preset] ?? NEUTRAL_PALETTES.neutral;
}

function neutralColorTokens(
  palette: Record<number, string>,
  map: Record<string, number | string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [token, stepOrHex] of Object.entries(map)) {
    out[token] =
      typeof stepOrHex === "string" ? stepOrHex : palette[stepOrHex]!;
  }
  return out;
}
