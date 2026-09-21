/**
 * RadiusScale → Skia radius 토큰 동기화
 *
 * RadiusScale 프리셋 변경 시 radius 토큰 객체를 직접 mutation하여
 * Skia 렌더링에 즉시 반영.
 *
 * @see ADR-021 Phase B
 */

import { radius } from "@composition/specs";
import type { RadiusScale } from "../../stores/themeConfigStore";

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
// 메인 함수
// ============================================================================

/**
 * RadiusScale에 따라 radius 토큰 객체를 갱신.
 *
 * **Mutation 방식**: tintToSkiaColors/neutralToSkiaColors와 동일 패턴.
 * Object.freeze() 미적용 → 직접 mutation하여 즉시 반영.
 */
export function radiusScaleToSkia(scale: RadiusScale): void {
  Object.assign(radius, resolveRadiusTokens(scale));
}

/**
 * ADR-227 — 순수: 스케일 → radius 토큰 맵 (mutation 없음). DOM `--radius-*` 와 같은 base 8 단계
 * (xs 2 · sm 4 · md 6 · lg 8 · xl 12 · 2xl 16 · 3xl 24 · 4xl 32) 를 같은 factor 로 — 종전 Skia 는
 * xs/2xl 을 스케일하지 않아 DOM 과 갈렸다 (Phase 0 발견, 여기서 한 표로 맞춘다).
 */
export const RADIUS_BASE_PX: Readonly<Record<string, number>> = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
  "3xl": 24,
  "4xl": 32,
  full: 9999,
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
