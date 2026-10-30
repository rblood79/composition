/**
 * ADR-295 Decision 2 — 기기 축 (시스템 토큰). S2 1.8.1 `Provider.css` 의 `--s2-scale` · `--s2-font-size-base`
 * 두 벌과 같은 값이고, 선택 조건도 S2 와 같은 `not ((hover: hover) and (pointer: fine))` 다.
 *
 * 테마가 아니라 시스템 소유 — 테마 편집기에 노출하지 않는다. Canvas 는 항상 desktop 벌로 그린다
 * (사용자 결정 7, 2026-10-30). Preview · Publish 는 미디어 쿼리로, Preview 는 「터치」 보기 토글
 * (사용자 결정 4) 로도 터치 벌을 고른다.
 */
import { S2_FONT_SIZE_BASE } from "./typography";

export type S2Device = "desktop" | "touch";

export const S2_DEVICE: Readonly<
  Record<S2Device, { readonly scale: number; readonly fontBase: number }>
> = {
  desktop: { scale: 1, fontBase: S2_FONT_SIZE_BASE },
  touch: { scale: 1.25, fontBase: 17 },
};

/** S2 가 터치 벌을 고르는 미디어 조건 (`Provider.css`). */
export const S2_TOUCH_MEDIA = "not ((hover: hover) and (pointer: fine))";

/**
 * S2 component-height 5단 (desktop px — `size(20 · 24 · 32 · 40 · 48)` = rem × `--s2-scale`). rule 의 높이
 * 리터럴은 Phase 3 에서 이 단을 참조한다 (ADR-295 Decision 4).
 */
export const S2_CONTROL_HEIGHT = {
  XS: 20,
  S: 24,
  M: 32,
  L: 40,
  XL: 48,
} as const;

export function s2ControlHeights(scale: number): Record<string, number> {
  return Object.fromEntries(
    Object.entries(S2_CONTROL_HEIGHT).map(([size, px]) => [size, px * scale]),
  );
}
