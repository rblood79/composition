/**
 * Neutral Preset → neutral 색상 토큰
 *
 * Tailwind v4 5종 gray 팔레트에서 S2 neutral 13개 토큰을 파생한다 (순수 — 토큰 맵 mutation
 * 없음, 설치는 `themeMaps.ts` `installThemeMaps`).
 *
 * @see packages/rendering/src/primitives/generated/tailwindPalette.ts (ADR-191 — tailwindcss/theme.css 파생, 손 복사 금지)
 * @see ADR-021 Phase B
 */

import { TAILWIND_PALETTE } from "@composition/rendering";

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
  neutral: 900,
  "neutral-subdued": 600, // S2 #505050 에 가장 가까운 단계 (2026-09-29, 종전 700)
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
  neutral: 100,
  "neutral-subdued": 400,
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
  return neutralColorTokens(
    NEUTRAL_PALETTES[preset] ?? NEUTRAL_PALETTES.neutral,
    mode === "dark" ? DARK_MAP : LIGHT_MAP,
  );
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
