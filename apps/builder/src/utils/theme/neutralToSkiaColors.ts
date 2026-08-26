/**
 * Neutral Preset → Skia 색상 동기화
 *
 * Tailwind v4 5종 gray 팔레트에서 S2 neutral 13개 토큰을
 * lightColors/darkColors에 직접 mutation하여 Skia 렌더링에 반영.
 *
 * @see packages/specs/src/primitives/generated/tailwindPalette.ts (ADR-191 — tailwindcss/theme.css 파생, 손 복사 금지)
 * @see ADR-021 Phase B
 */

import { lightColors, darkColors, TAILWIND_PALETTE } from "@composition/specs";

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
  "neutral-subdued": 700,
  "neutral-subtle": 200,
  "neutral-hover": 300,
  "neutral-pressed": 400,
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
// 메인 함수
// ============================================================================

/**
 * Neutral 프리셋에 따라 lightColors/darkColors의 neutral 13개 토큰을 갱신.
 *
 * **Mutation 방식**: tintToSkiaColors와 동일 패턴.
 * Object.freeze() 미적용 → 직접 mutation하여 즉시 반영.
 */
export function neutralToSkiaColors(preset: NeutralPreset): void {
  const palette = NEUTRAL_PALETTES[preset];

  applyNeutralColors(
    lightColors as unknown as Record<string, string>,
    palette,
    LIGHT_MAP,
  );
  applyNeutralColors(
    darkColors as unknown as Record<string, string>,
    palette,
    DARK_MAP,
  );
}

function applyNeutralColors(
  colors: Record<string, string>,
  palette: Record<number, string>,
  map: Record<string, number | string>,
): void {
  for (const [token, stepOrHex] of Object.entries(map)) {
    if (typeof stepOrHex === "string") {
      colors[token] = stepOrHex;
    } else {
      colors[token] = palette[stepOrHex];
    }
  }
}
