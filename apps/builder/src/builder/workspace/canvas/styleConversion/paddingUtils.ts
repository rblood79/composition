/**
 * Padding Utilities
 *
 * CSS padding 값을 파싱하고 콘텐츠 영역을 계산하는 유틸리티
 *
 * @since 2025-12-14 P9: Canvas padding 시스템
 */

import { parseCSSSize } from './styleConverter';
import type { CSSStyle } from './styleConverter';

// ============================================
// Types
// ============================================

export interface PaddingValues {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ContentBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================
// Padding Parsing
// ============================================

/**
 * CSS padding shorthand 값 파싱
 *
 * 지원 형식:
 * - "8px" → 모든 방향 8px
 * - "8px 16px" → 상하 8px, 좌우 16px
 * - "8px 16px 12px" → 상 8px, 좌우 16px, 하 12px
 * - "8px 16px 12px 4px" → 상 8px, 우 16px, 하 12px, 좌 4px
 */
function parsePaddingShorthand(value: string | number | undefined): PaddingValues | null {
  if (value === undefined || value === null) return null;

  if (typeof value === 'number') {
    return { top: value, right: value, bottom: value, left: value };
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/).map((p) => parseCSSSize(p, undefined, 0));

  switch (parts.length) {
    case 1:
      return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
    case 2:
      return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
    case 3:
      return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
    case 4:
      return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
    default:
      return null;
  }
}

/**
 * CSS 스타일에서 padding 값 추출
 *
 * 우선순위:
 * 1. 개별 값 (paddingTop, paddingRight, paddingBottom, paddingLeft)
 * 2. shorthand 값 (padding)
 * 3. 기본값 (0)
 */
export function parsePadding(style: CSSStyle | undefined, defaultValue = 0): PaddingValues {
  if (!style) {
    return { top: defaultValue, right: defaultValue, bottom: defaultValue, left: defaultValue };
  }

  // shorthand 먼저 파싱
  const shorthand = parsePaddingShorthand(style.padding as string | number | undefined);
  const base = shorthand || { top: defaultValue, right: defaultValue, bottom: defaultValue, left: defaultValue };

  // 개별 값으로 오버라이드
  return {
    top: style.paddingTop !== undefined ? parseCSSSize(style.paddingTop, undefined, base.top) : base.top,
    right: style.paddingRight !== undefined ? parseCSSSize(style.paddingRight, undefined, base.right) : base.right,
    bottom: style.paddingBottom !== undefined ? parseCSSSize(style.paddingBottom, undefined, base.bottom) : base.bottom,
    left: style.paddingLeft !== undefined ? parseCSSSize(style.paddingLeft, undefined, base.left) : base.left,
  };
}

/**
 * padding을 적용한 콘텐츠 영역 계산
 */
export function getContentBounds(
  containerWidth: number,
  containerHeight: number,
  padding: PaddingValues
): ContentBounds {
  return {
    x: padding.left,
    y: padding.top,
    width: Math.max(0, containerWidth - padding.left - padding.right),
    height: Math.max(0, containerHeight - padding.top - padding.bottom),
  };
}

/**
 * padding 값의 총합 계산
 */
export function getTotalPadding(padding: PaddingValues): { horizontal: number; vertical: number } {
  return {
    horizontal: padding.left + padding.right,
    vertical: padding.top + padding.bottom,
  };
}

/**
 * padding이 있는지 확인
 */
export function hasPadding(padding: PaddingValues): boolean {
  return padding.top > 0 || padding.right > 0 || padding.bottom > 0 || padding.left > 0;
}

// ============================================
// Border Parsing
// ============================================

export interface BorderWidthValues {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * CSS borderWidth shorthand 값 파싱
 *
 * 지원 형식:
 * - "2px" → 모든 방향 2px
 * - "2px 4px" → 상하 2px, 좌우 4px
 * - "2px 4px 3px" → 상 2px, 좌우 4px, 하 3px
 * - "2px 4px 3px 1px" → 상 2px, 우 4px, 하 3px, 좌 1px
 */
function parseBorderWidthShorthand(value: string | number | undefined): BorderWidthValues | null {
  if (value === undefined || value === null) return null;

  if (typeof value === 'number') {
    return { top: value, right: value, bottom: value, left: value };
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/).map((p) => parseCSSSize(p, undefined, 0));

  switch (parts.length) {
    case 1:
      return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
    case 2:
      return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
    case 3:
      return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
    case 4:
      return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
    default:
      return null;
  }
}

/**
 * CSS 스타일에서 borderWidth 값 추출
 *
 * 우선순위:
 * 1. 개별 값 (borderTopWidth, borderRightWidth, borderBottomWidth, borderLeftWidth)
 * 2. shorthand 값 (borderWidth)
 * 3. 기본값 (0)
 */
export function parseBorderWidth(style: CSSStyle | undefined, defaultValue = 0): BorderWidthValues {
  if (!style) {
    return { top: defaultValue, right: defaultValue, bottom: defaultValue, left: defaultValue };
  }

  // shorthand 먼저 파싱
  const shorthand = parseBorderWidthShorthand(style.borderWidth as string | number | undefined);
  const base = shorthand || { top: defaultValue, right: defaultValue, bottom: defaultValue, left: defaultValue };

  // 개별 값으로 오버라이드
  return {
    top: style.borderTopWidth !== undefined ? parseCSSSize(style.borderTopWidth, undefined, base.top) : base.top,
    right: style.borderRightWidth !== undefined ? parseCSSSize(style.borderRightWidth, undefined, base.right) : base.right,
    bottom: style.borderBottomWidth !== undefined ? parseCSSSize(style.borderBottomWidth, undefined, base.bottom) : base.bottom,
    left: style.borderLeftWidth !== undefined ? parseCSSSize(style.borderLeftWidth, undefined, base.left) : base.left,
  };
}

/**
 * borderWidth가 있는지 확인
 */
export function hasBorderWidth(border: BorderWidthValues): boolean {
  return border.top > 0 || border.right > 0 || border.bottom > 0 || border.left > 0;
}
