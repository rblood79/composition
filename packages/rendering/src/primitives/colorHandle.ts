/**
 * S2 Color 조작기의 장식 겹 (2026-11-18 — S2 1.8.2 `ColorHandle.tsx` · `ColorArea.tsx` ·
 * `ColorSlider.tsx` · `ColorWheel.tsx`): 노드가 아니라 소유자가 그리는 것 (rendering 에 둔다 — Canvas primitive 가 shared 를 import 하지 못한다) — thumb 안쪽 고리 (`div`),
 * 표시 색 아래 체커보드 (`repeating-conic-gradient`), 조작 면의 바깥선 (`outline 1px gray-1000/10`,
 * offset −1), ColorWheel 의 안쪽 고리 (`div` inset 24), 끌기 중 Loupe (`svg`, Preview 만 — Canvas 에는
 * 끌기가 없다). 값은 여기 하나이고 Preview (`domBinding` ColorThumb · ColorWheelTrack · 조작 면 style) 와
 * Canvas (`_colorThumb` · `_colorGradient` → `skiaPrimitives` `color_thumb` · `color_*`) 가 같이 읽는다.
 * thumb 상자 자신 (크기 · 테두리 · 바깥선) 은 ColorThumb rule 이 정본이다.
 */

/** S2 `ColorHandle` 안쪽 `div` — 테두리 안 (content box) 에 꽉 찬 1px `black/42` 원. */
export const CATALOG_COLOR_HANDLE_INNER_RING = {
  width: 1,
  color: "#000000",
  alpha: 0.42,
} as const;

/** S2 체커보드 — `repeating-conic-gradient(#E1E1E1 0% 25%, white 0% 50%) 50% / 16px 16px`. */
export const CATALOG_COLOR_CHECKER = {
  light: "#ffffff",
  dark: "#e1e1e1",
  tile: 16,
} as const;
export const CATALOG_COLOR_CHECKER_CSS = `repeating-conic-gradient(${CATALOG_COLOR_CHECKER.dark} 0% 25%, ${CATALOG_COLOR_CHECKER.light} 0% 50%) 50% / ${CATALOG_COLOR_CHECKER.tile}px ${CATALOG_COLOR_CHECKER.tile}px`;

/**
 * 조작 면의 바깥선 — S2 `outline: 1px solid gray-1000/10` · `outline-offset: -1` (ColorArea · ColorSlider
 * track · ColorWheelTrack 바깥, ColorWheel 안쪽 고리는 offset 0). 비활성이면 없다 (`isDisabled: none`).
 */
export const CATALOG_COLOR_CONTROL_OUTLINE = {
  width: 1,
  token: "{color.gray-1000}",
  alpha: 0.1,
} as const;
export const CATALOG_COLOR_CONTROL_OUTLINE_CSS = `${CATALOG_COLOR_CONTROL_OUTLINE.width}px solid color-mix(in srgb, var(--gray-1000) ${CATALOG_COLOR_CONTROL_OUTLINE.alpha * 100}%, transparent)`;

/** S2 Loupe — 48 × 64 물방울, 테두리 1, thumb 위 12 (`ColorHandle.tsx` 상수 · path). */
export const CATALOG_COLOR_LOUPE = {
  width: 48,
  height: 64,
  border: 1,
  offset: 12,
  handle: 16,
  path: "M25 1a24 24 0 0124 24c0 16.255-24 40-24 40S1 41.255 1 25A24 24 0 0125 1z",
  ring: "M25 3A21.98 21.98 0 003 25c0 6.2 4 14.794 11.568 24.853A144.233 144.233 0 0025 62.132a144.085 144.085 0 0010.4-12.239C42.99 39.816 47 31.209 47 25A21.98 21.98 0 0025 3m0-2a24 24 0 0124 24c0 16.255-24 40-24 40S1 41.255 1 25A24 24 0 0125 1z",
} as const;

/**
 * 체커보드의 어두운 칸 (SVG path, 상자 로컬 px) — CSS 와 같은 자리: 타일 16 을 상자 가운데에 맞추고
 * (`background-position: 50%`), 타일 안 conic 은 12 시부터 시계 방향이라 오른쪽 위 · 왼쪽 아래 8 × 8 이
 * 어둡다. 밝은 칸은 바탕 (흰색) 이 맡는다.
 */
export function catalogColorCheckerPath(
  width: number,
  height: number,
  place: { x: number; y: number; inset: number } = { x: 0.5, y: 0.5, inset: 0 },
): string {
  const { tile } = CATALOG_COLOR_CHECKER;
  const half = tile / 2;
  // (CSS `background-position` — a fraction of the free room in the padding box, `inset` = border.)
  const start = (size: number, fraction: number) => {
    const offset = place.inset + (size - 2 * place.inset - tile) * fraction;
    return offset - Math.ceil(offset / tile) * tile;
  };
  const x0 = start(width, place.x);
  const y0 = start(height, place.y);
  const squares: string[] = [];
  for (let y = y0; y < height; y += tile)
    for (let x = x0; x < width; x += tile) {
      squares.push(`M${x + half} ${y}h${half}v${half}h${-half}z`);
      squares.push(`M${x} ${y + half}h${half}v${half}h${-half}z`);
    }
  return squares.join("");
}

/**
 * S2 `ColorSwatch` 테두리 — `border: 1px solid gray-1000/42` (`ColorSwatch.tsx`, 견본 색 위 · 모서리 = 견본
 * rounding). 견본 rule 의 테두리는 투명이고 이 값을 Canvas `color_swatch` · DOM inline 이 같이 그린다.
 */
export const CATALOG_COLOR_SWATCH_BORDER = {
  width: 1,
  token: "{color.gray-1000}",
  alpha: 0.42,
} as const;
export const CATALOG_COLOR_SWATCH_BORDER_CSS = `${CATALOG_COLOR_SWATCH_BORDER.width}px solid color-mix(in srgb, var(--gray-1000) ${CATALOG_COLOR_SWATCH_BORDER.alpha * 100}%, transparent)`;

/**
 * S2 `ColorSwatch` 바탕 (`ColorSwatch.tsx` style): 색이 있으면 체커보드 위 색 —
 * `repeating-conic-gradient(#e6e6e6 0% 25%, white 0% 50%) 0% 50% / 16px 16px` (손잡이의 `#E1E1E1 50%` 와 다르다),
 * alpha 0 이면 빨간 사선 (`red-900` 4px, `to bottom right` 의 가운데 띠) 만.
 */
export const CATALOG_COLOR_SWATCH_CHECKER = {
  light: "#ffffff",
  dark: "#e6e6e6",
  place: { x: 0, y: 0.5 },
} as const;
export const CATALOG_COLOR_SWATCH_CHECKER_CSS = `repeating-conic-gradient(${CATALOG_COLOR_SWATCH_CHECKER.dark} 0% 25%, ${CATALOG_COLOR_SWATCH_CHECKER.light} 0% 50%) 0% 50% / ${CATALOG_COLOR_CHECKER.tile}px ${CATALOG_COLOR_CHECKER.tile}px`;
// (red 900 · 900 — 같은 Tone 단의 기존 별칭 `selection-negative`; `{color.red}` 는 어두운 테마 800.)
export const CATALOG_COLOR_SWATCH_SLASH = {
  token: "{color.selection-negative}",
  width: 4,
} as const;

/**
 * S2 `ColorSwatchPicker` 선택 표시 — 선택된 항목 안 `div` (`ColorSwatchPicker.tsx` `isSelected &&`):
 * 상자를 채우고 테두리 2 `gray-900` + 바깥선 2 `gray-25` (offset −4), 모서리는 항목 (= 견본 rounding).
 * 토큰은 같은 Tone 단을 쓰는 기존 별칭 — gray-900 = `neutral-content-hover` (900 · 900), gray-25 =
 * `base` (25 · 25).
 */
export const CATALOG_COLOR_SWATCH_SELECTION = {
  border: { width: 2, token: "{color.neutral-content-hover}" },
  outline: { width: 2, token: "{color.base}", offset: -4 },
} as const;
