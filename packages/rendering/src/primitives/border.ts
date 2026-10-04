/**
 * Border Width Tokens (ADR-227 Phase 3)
 *
 * 테마가 소유하는 border 폭 축. catalog rule 은 `{border.width.none|thin|thick}` 으로만 참조하고
 * 숫자 리터럴을 두지 않는다 (`borderWidthLiteral.static.test.ts` ratchet).
 *
 * CSS 변수 기준 (SSOT: shared-tokens.css):
 *   --border-width-none: 0px · --border-width-thin: 1px · --border-width-thick: 2px
 *
 * 이 맵은 활성 테마 설치 (`installThemeSnapshot`) 가 덮어쓴다 — `resolveToken("{border.width.thin}")`
 * 소비자는 항상 현재 테마 값을 읽는다.
 *
 * @packageDocumentation
 */

import type { BorderWidthTokens, TokenRef } from "../types/token.types";

export const borderWidth: BorderWidthTokens = {
  none: 0,
  thin: 1,
  thick: 2,
};

/** rule 이 `borderWidth` 를 생략했을 때 두 leg 가 같이 쓰는 기본 폭 토큰 (종전 리터럴 `?? 1`). */
export const DEFAULT_BORDER_WIDTH_TOKEN: TokenRef = "{border.width.thin}";

export function getBorderWidthToken(name: keyof BorderWidthTokens): number {
  return borderWidth[name];
}
