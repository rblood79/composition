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
 * ADR-295 — 사용자 컴포넌트 radius 의 **한 표**. S2 1.8.1 (`spectrum-theme.ts` radius: sm 4 · default 8 ·
 * lg 10 · xl 16 · full) + 저장소 단 xs 2 · 2xl 24 (S2 없음 — 사용자 결정 5, 3xl · 4xl 삭제).
 * theme preset 배율 (`radiusScaleToSkia.ts` `RADIUS_BASE_PX`) 은 이 표에서 파생한다.
 * `shared-tokens.css` 의 `--radius-*` 는 빌더 chrome 의 정적 값이라 이 표와 다르다 (Decision 8).
 */
export const radius: RadiusTokens = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 10,
  xl: 16,
  "2xl": 24,
  full: 9999,
};

/**
 * 둥근 모서리 토큰 값 반환
 */
export function getRadiusToken(name: keyof RadiusTokens): number {
  return radius[name];
}
