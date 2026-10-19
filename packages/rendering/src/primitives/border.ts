/**
 * Border Width Tokens (ADR-227 Phase 3)
 *
 * 테마가 소유하는 border 폭 축. catalog rule 은 `{border.width.none|thin|thick}` 으로만 참조하고
 * 숫자 리터럴을 두지 않는다 (`borderWidthLiteral.static.test.ts` ratchet).
 *
 * CSS 변수 기준 (SSOT: shared-tokens.css):
 *   --border-width-none: 0px · --border-width-thin: 1px · --border-width-thick: 2px ·
 *   --border-width-hairline: 0.5px
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
  // The RAC reference theme's 0.5px dividers (`ListBox.css` — the list, its item lines, a section
  // header — 2026-10-13).
  hairline: 0.5,
};

/** rule 이 `borderWidth` 를 생략했을 때 두 leg 가 같이 쓰는 기본 폭 토큰 (종전 리터럴 `?? 1`). */
export const DEFAULT_BORDER_WIDTH_TOKEN: TokenRef = "{border.width.thin}";

export function getBorderWidthToken(name: keyof BorderWidthTokens): number {
  return borderWidth[name];
}

/**
 * The device pixel ratio the Canvas snaps border widths to — the window the Builder draws in
 * (`setBorderSnapRatio`, the same ratio the layout engine snaps with). Unset = no snap (a realm
 * that never sets it — the Preview iframe, publish, tests — keeps the authored width).
 */
let borderSnapRatio: number | undefined;

export function setBorderSnapRatio(dpr: number | undefined): void {
  borderSnapRatio =
    dpr !== undefined && Number.isFinite(dpr) && dpr > 0 ? dpr : undefined;
}

/**
 * A border width's used value — Blink `StyleBuilderConverter::ClampLineWidth`
 * (style_builder_converter.cc:1970): in device px, 0 < w < 1 → 1, else floor. The layout engine
 * snaps the same way (`snap_line_width`), so the drawn border fills the box the engine laid out
 * (a 0.5px hairline is 1px at DPR 1 — the Preview's width). Idempotent.
 */
export function snapBorderWidth(px: number): number {
  const ratio = borderSnapRatio;
  if (ratio === undefined || !(px > 0)) return px;
  const device = px * ratio;
  // (1e-6: a width already snapped at a fractional ratio reads back a hair under its integer.)
  return Math.max(1, Math.floor(device + 1e-6)) / ratio;
}
