/**
 * Border Utilities
 *
 * border-box 방식 렌더링을 위한 유틸리티
 * - border-box offset 계산
 * - borderRadius 안전 처리 (음수 방지)
 *
 * @since 2025-12-15 Canvas Border-Box v2
 */

import {
  cssColorToHex,
  cssColorToAlpha,
  parseCSSSize,
  type CSSStyle,
} from "../styleConversion/styleConverter";

// ============================================
// Types
// ============================================

export type BorderStyleType =
  | "solid"
  | "dashed"
  | "dotted"
  | "double"
  | "groove"
  | "ridge"
  | "inset"
  | "outset"
  | "none";

export interface BorderConfig {
  /** border 두께 (px) */
  width: number;
  /** border 색상 (0xRRGGBB) */
  color: number;
  /** border 투명도 (0-1) */
  alpha: number;
  /** border 스타일 */
  style: BorderStyleType;
  /** border 모서리 반경 (px) */
  radius: number;
}

export interface BorderBoxInnerBounds {
  /** stroke 시작 X 좌표 */
  x: number;
  /** stroke 시작 Y 좌표 */
  y: number;
  /** stroke 영역 너비 */
  width: number;
  /** stroke 영역 높이 */
  height: number;
  /** 조정된 borderRadius (음수 방지) */
  radius: number;
}

// ============================================
// Border Style Parsing
// ============================================

/**
 * CSS borderStyle 문자열을 BorderStyleType으로 파싱
 */
export function parseBorderStyle(style: string | undefined): BorderStyleType {
  if (!style || style === "none") return "none";

  const lower = style.toLowerCase();
  if (lower === "dashed") return "dashed";
  if (lower === "dotted") return "dotted";
  if (lower === "double") return "double";
  if (lower === "groove") return "groove";
  if (lower === "ridge") return "ridge";
  if (lower === "inset") return "inset";
  if (lower === "outset") return "outset";
  return "solid";
}

/**
 * CSS 스타일에서 BorderConfig 추출
 *
 * @returns border 정보가 없거나 width가 0이면 null
 */
export function parseBorderConfig(
  style: CSSStyle | undefined,
): BorderConfig | null {
  if (!style) return null;

  // borderWidth 또는 borderColor가 있어야 border로 인식
  if (!style.borderWidth && !style.borderColor) {
    return null;
  }

  const width = parseCSSSize(style.borderWidth, undefined, 0);
  if (width <= 0) return null;

  return {
    width,
    color: cssColorToHex(style.borderColor, 0x000000),
    alpha: cssColorToAlpha(style.borderColor),
    style: parseBorderStyle(style.borderStyle),
    radius: parseCSSSize(style.borderRadius, undefined, 0),
  };
}

// ============================================
// Border-Box Offset Calculation
// ============================================

/**
 * border-box offset 계산
 *
 * stroke는 선의 중앙에 그려지므로 width/2 만큼 안쪽으로 이동해야
 * 전체가 bounds 안에 들어감
 *
 * @example
 * getBorderBoxOffset(4) // 2
 * getBorderBoxOffset(1) // 0.5
 */
export function getBorderBoxOffset(borderWidth: number): number {
  return borderWidth / 2;
}

/**
 * border-box 적용 시 안전한 borderRadius 계산
 *
 * radius가 offset보다 작으면 0 반환 (음수 방지)
 *
 * @example
 * getSafeBorderRadius(8, 2)  // 6
 * getSafeBorderRadius(1, 2)  // 0 (음수 방지)
 */
export function getSafeBorderRadius(radius: number, offset: number): number {
  return Math.max(0, radius - offset);
}

/**
 * border-box 방식의 stroke 영역 계산
 *
 * stroke가 요소 안쪽에 그려지도록 좌표와 크기를 조정
 *
 * @param width - 요소 전체 너비
 * @param height - 요소 전체 높이
 * @param borderWidth - border 두께
 * @param borderRadius - border 모서리 반경
 *
 * @example
 * // 100x50 요소에 border 4px, radius 8px
 * getBorderBoxInnerBounds(100, 50, 4, 8)
 * // { x: 2, y: 2, width: 96, height: 46, radius: 6 }
 */
export function getBorderBoxInnerBounds(
  width: number,
  height: number,
  borderWidth: number,
  borderRadius: number,
): BorderBoxInnerBounds {
  const offset = getBorderBoxOffset(borderWidth);

  return {
    x: offset,
    y: offset,
    width: Math.max(0, width - borderWidth),
    height: Math.max(0, height - borderWidth),
    radius: getSafeBorderRadius(borderRadius, offset),
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * border가 유효한지 확인
 */
export function isValidBorder(
  border: BorderConfig | null | undefined,
): border is BorderConfig {
  return (
    border !== null &&
    border !== undefined &&
    border.width > 0 &&
    border.style !== "none"
  );
}

/**
 * border 있는 요소의 content 영역 계산
 *
 * border-box에서는 border가 width 안에 포함되므로
 * content 영역은 width - (border * 2)
 */
export function getContentBoundsWithBorder(
  width: number,
  height: number,
  borderWidth: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: borderWidth,
    y: borderWidth,
    width: Math.max(0, width - borderWidth * 2),
    height: Math.max(0, height - borderWidth * 2),
  };
}
