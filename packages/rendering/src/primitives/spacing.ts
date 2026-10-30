/**
 * Spacing Tokens
 *
 * 간격 토큰 정의
 *
 * @packageDocumentation
 */

import type { SpacingTokens } from "../types/token.types";

/**
 * 간격 토큰 — `{spacing.*}` 와 DOM `--spacing-*` (`theme/shared-tokens.css`, rem @ 16px) 의 한 표.
 *
 * ADR-295 Phase 3d: 값은 S2 spacing 단 (`spectrum-theme.ts` `generateSpacing` — 0 · 2 · 4 · 8 · 12 · 16 ·
 * 20 · 24 · 28 · 32 · 40 · 48 …) 안이고 이름은 저장소 것 그대로다. 그 전 이 표는 md 16 · lg 24 · xl 32 ·
 * 2xl 48 로 CSS (md 12 · lg 16 · xl 24 · 2xl 32) 와 갈려 있었다 — rule 은 2xs · xs · sm 만 읽어 화면은
 * 같았지만 Library 의 Spacing 카드가 이 표를 그려 패널 preset (CSS 값) 과 달랐다. CSS 만 있는 `--spacing-3xs`
 * (1px, chrome 시트 전용 — S2 단 밖) 은 여기 두지 않는다. 대조: `d3S2Alignment` 「spacing 한 표」.
 */
export const spacing: SpacingTokens = {
  "2xs": 2, // ← ADR-071 신설. --spacing-2xs: 0.125rem = 2px 정합
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  "4xl": 48,
};

/**
 * ADR-295 Phase 3c-3b ③ — S2 의 spacing 단 (`spectrum-theme.ts` `generateSpacing` 의 px 목록). S2 는 고정 여백 ·
 * 간격을 이 단의 px 로 쓴다 (`padding: 12`). rule 의 padding · gap 리터럴이 이 단 위면 「S2 고정 값」 으로
 * 분류한다 (`componentRulesTable.static.test.ts`). 대조: `d3S2Alignment` 「S2 spacing 단」.
 */
export const S2_SPACING_SCALE: readonly number[] = [
  0, 2, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96,
];

/**
 * 간격 토큰 값 반환
 */
export function getSpacingToken(name: keyof SpacingTokens): number {
  return spacing[name];
}

/** RSP `Breadcrumbs` / `Breadcrumb` size → spec 키 `S` | `M` | `L` */
export function normalizeBreadcrumbRspSizeKey(raw: string): "S" | "M" | "L" {
  const k = raw.trim().toLowerCase();
  if (k === "s" || k === "sm") return "S";
  if (k === "l" || k === "lg") return "L";
  return "M";
}
