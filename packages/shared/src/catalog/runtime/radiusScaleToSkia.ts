/**
 * RadiusScale → radius 토큰
 *
 * RadiusScale 프리셋에서 radius 토큰 값을 파생한다 (순수 — 토큰 맵 mutation 없음,
 * 설치는 `themeMaps.ts` `installThemeMaps`).
 *
 * @see ADR-021 Phase B
 */

import { radius as radiusTable } from "@composition/rendering";
import type { ThemePreset } from "../document/types";
type RadiusScale = ThemePreset["radius"];

// ============================================================================
// 기본값 (md 스케일 = 1x)
// ============================================================================

/** 스케일별 배율 */
const SCALE_FACTORS: Record<RadiusScale, number> = {
  none: 0,
  sm: 0.5,
  md: 1,
  lg: 1.5,
  xl: 2,
};

// ============================================================================
// radius 토큰 파생
// ============================================================================

/**
 * ADR-227 — 순수: 스케일 → radius 토큰 맵 (mutation 없음). DOM `--radius-*` 와 Skia 가 같은 표를 같은
 * factor 로. ADR-295: 표는 `@composition/rendering` `radius` (S2 값) 하나 — 여기서 다시 적지 않는다
 * (seed 와 preset 파생이 따로 있으면 seed 만 바꾼 값이 활성 테마에서 덮였다, R9).
 */
export const RADIUS_BASE_PX: Readonly<Record<string, number>> = {
  ...(radiusTable as unknown as Record<string, number>),
};

export function radiusScaleFactor(scale: string): number {
  return SCALE_FACTORS[scale as RadiusScale] ?? 1;
}

export function resolveRadiusTokens(scale: string): Record<string, number> {
  const factor = radiusScaleFactor(scale);
  const out: Record<string, number> = {};
  for (const [key, base] of Object.entries(RADIUS_BASE_PX)) {
    out[key] =
      key === "none" || key === "full" ? base : Math.round(base * factor);
  }
  return out;
}
