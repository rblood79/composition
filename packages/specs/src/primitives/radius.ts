/**
 * Radius Tokens
 *
 * 둥근 모서리 토큰 정의
 *
 * @packageDocumentation
 */

import type { RadiusTokens } from "../types/token.types";

/**
 * 둥근 모서리 토큰
 */
/**
 * CSS 변수 기준 (SSOT: shared-tokens.css):
 * --radius-xs:  0.125rem = 2px   ← ADR-913 slice 5 추가 (catalog {radius.xs} 10회 참조)
 * --radius-sm:  0.25rem  = 4px
 * --radius-md:  0.375rem = 6px
 * --radius-lg:  0.5rem   = 8px
 * --radius-xl:  0.75rem  = 12px
 * --radius-2xl: 1rem     = 16px  ← ADR-913 slice 5 추가 (catalog {radius.2xl} 3회 참조)
 *
 * 3xl(1.5rem)/4xl(2rem)는 shared-tokens.css 에 정의돼 있으나 catalog 미사용 → 미추가(0 drift).
 */
export const radius: RadiusTokens = {
  none: 0,
  // ADR-913 slice 5 (2026-06-19): catalog {radius.xs}(10회 — Dialog/Form/ComboBox/DatePicker/
  //   Table/Tree/Breadcrumbs 등)가 참조하나 primitive 누락 → Skia resolveToken undefined→0px,
  //   DOM 은 var(--radius-xs)=2px → D3 대칭 위반. shared-tokens.css 값 1:1 복원.
  xs: 2, // 0.125rem
  sm: 4, // 0.25rem
  md: 6, // 0.375rem
  lg: 8, // 0.5rem
  xl: 12, // 0.75rem
  // ADR-913 slice 5 (2026-06-19): catalog {radius.2xl}(3회 — Dialog lg/xl + Form)가 참조하나
  //   primitive 누락 → Skia 0px, DOM 은 var(--radius-2xl)=16px → 대칭 위반. 값 1:1 복원.
  "2xl": 16, // 1rem
  full: 9999,
};

/**
 * 둥근 모서리 토큰 값 반환
 */
export function getRadiusToken(name: keyof RadiusTokens): number {
  return radius[name];
}
