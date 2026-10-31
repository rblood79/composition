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
 * S2 component-height 5단 (desktop px — `size(20 · 24 · 32 · 40 · 48)` = rem × `--s2-scale`). rule 은 이 단을
 * `{size.height.<S>}` 로 참조한다 (ADR-295 Decision 4 · Phase 3).
 */
export const S2_CONTROL_HEIGHT = {
  XS: 20,
  S: 24,
  M: 32,
  L: 40,
  XL: 48,
} as const;

/**
 * S2 아이콘 5단 (desktop px — `iconStyle({ size })` 의 `size` = rem × `--s2-scale`, `style/index.ts` `iconSizes`).
 * 컨트롤 안 워크플로 아이콘과 Icon 컴포넌트가 `{size.icon.<S>}` 로 참조한다 (ADR-295 Phase 3b). S2 의 ui-icon
 * (chevron · 지우기 …) 은 아이콘마다 표가 따로 있어 이 단이 아니다.
 */
export const S2_ICON_SIZE = {
  XS: 14,
  S: 16,
  M: 18,
  L: 20,
  XL: 22,
} as const;

/**
 * S2 `controlSize('sm')` (desktop px — `style-utils.ts` `controlSizeS`, rem × `--s2-scale`): Checkbox 상자 ·
 * Radio 고리 · Switch track 의 높이. rule 은 `{size.height-sm.<S>}` 로 참조한다 (ADR-295 Phase 3c-2). S2 에
 * XS 가 없고 toggle 도 XS 를 받지 않는다.
 */
export const S2_CONTROL_HEIGHT_SM = {
  S: 14,
  M: 16,
  L: 18,
  XL: 20,
} as const;

/**
 * S2 field 안 버튼 상자 (desktop px — ComboBox · DatePicker `inputButton` 의 `size` · `width`, rem × `--s2-scale`).
 * field 높이와의 여백 S 4 · M 6 · L 8 · XL 8. XS 는 S2 에 없어 XS field (20) 의 여백 3 으로 14 (ADR-295 Phase 3c-2).
 */
export const S2_FIELD_BUTTON_SIZE = {
  XS: 14,
  S: 16,
  M: 20,
  L: 24,
  XL: 32,
} as const;

/** S2 막대 (ProgressBar · Meter) 의 최소 폭 — `bar-utils.ts` `minWidth: 48` (rem × `--s2-scale`). */
export const S2_BAR_MIN_WIDTH = 48;

export function s2ControlHeights(scale: number): Record<string, number> {
  return Object.fromEntries(
    Object.entries(S2_CONTROL_HEIGHT).map(([size, px]) => [size, px * scale]),
  );
}

/**
 * `{size.height.<S>}` · `{size.icon.<S>}` 토큰 맵 (키 `height.<S>` · `icon.<S>`) — Skia · 레이아웃이 `resolveToken` 으로 읽는다. 설치 전 값은 desktop
 * 벌이고, 테마 설치 (`installThemeMaps`) 가 snapshot 의 `size` 로 바꾼다 (G2 하니스의 터치 arm 은 터치 벌).
 * DOM 은 같은 토큰을 `--catalog-token-size-height-<S>` 로 읽는다 (Preview · Publish = 기기 미디어 두 벌).
 */
export function s2SizeTokens(scale: number): Record<string, number> {
  return Object.fromEntries([
    ...Object.entries(s2ControlHeights(scale)).map(([size, px]) => [
      `height.${size}`,
      px,
    ]),
    // ADR-295 Phase 3b: `{size.icon.<S>}` — DOM `--catalog-token-size-icon-<S>`.
    ...Object.entries(S2_ICON_SIZE).map(([size, px]) => [
      `icon.${size}`,
      px * scale,
    ]),
    // ADR-295 Phase 3c-2: `{size.height-sm.<S>}` · `{size.field-button.<S>}` · `{size.bar.min-width}`.
    ...Object.entries(S2_CONTROL_HEIGHT_SM).map(([size, px]) => [
      `height-sm.${size}`,
      px * scale,
    ]),
    ...Object.entries(S2_FIELD_BUTTON_SIZE).map(([size, px]) => [
      `field-button.${size}`,
      px * scale,
    ]),
    ["bar.min-width", S2_BAR_MIN_WIDTH * scale],
    // ADR-295 Phase 3c-3: `{size.device.touch}` — 1 in the touch set (the scale above desktop's), the flag
    //   a relative length's touch coefficient reads (S2 `text-to-visual` 8/17 em). DOM
    //   `--catalog-token-size-device-touch`.
    ["device.touch", scale > S2_DEVICE.desktop.scale ? 1 : 0],
    // ADR-295 후속: `{size.unit}` — 1 px × scale, the base of a rule's fixed S2 sizing number (`scaled(n)` —
    //   S2 `size(n)` · a plain number on a sizing property = rem × `--s2-scale`). DOM `--catalog-token-size-unit`.
    ["unit", scale],
  ]);
}

export const size: Record<string, number> = s2SizeTokens(
  S2_DEVICE.desktop.scale,
);
