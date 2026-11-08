/**
 * Neutral Preset → neutral 색상 토큰
 *
 * Tone 의 역할 색은 ADR-302 사다리 생성 (`ladderGenerate.ts` — Tone 이름 5 는 유지, 값은 Spectrum gray 사다리
 * 모양을 각 이름의 (c, h) 로 옮긴 것) 이 만든다. 여기 남은 Tailwind 단계는 DOM `--color-neutral-N` 과 Themes
 * 패널 견본뿐이다 (Phase 3 에서 생성 사다리로).
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
// neutral 단계 (DOM `--color-neutral-N` · Themes 패널 견본 — ADR-302 Phase 3 에서 생성 사다리로)
// ============================================================================

/** neutral 11 단계 hex (DOM `--color-neutral-N`). */
export function resolveNeutralSteps(
  preset: NeutralPreset,
): Record<number, string> {
  return NEUTRAL_PALETTES[preset] ?? NEUTRAL_PALETTES.neutral;
}
