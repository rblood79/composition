/**
 * Spacing Tokens
 *
 * 간격 토큰 정의
 *
 * @packageDocumentation
 */

import type { SpacingTokens } from "../types/token.types";

/**
 * 간격 토큰
 */
export const spacing: SpacingTokens = {
  "2xs": 2, // ← ADR-071 신설. --spacing-2xs: 0.125rem = 2px 정합
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
};

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
