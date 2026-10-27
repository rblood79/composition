/**
 * CSS Shorthand Expander
 *
 * CSS shorthand 속성을 개별 속성으로 확장하는 유틸리티
 *
 * 지원 속성: padding / margin (1-4 값 확장)
 *
 * @example
 * expandSpacing('8px 16px') // { top: '8px', right: '16px', bottom: '8px', left: '16px' }
 *
 * @since 2025-12-20 Phase 2 - Structural Optimization
 */

// ============================================
// Types
// ============================================

export interface FourWayValues {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

// ============================================
// Padding / Margin Expansion
// ============================================

/**
 * CSS padding/margin shorthand 확장
 *
 * @param value - CSS shorthand 값 (예: "8px", "8px 16px", "8px 16px 12px", "8px 16px 12px 4px")
 * @param defaultValue - 기본값 (기본: '0px')
 * @returns 4방향 값 객체
 *
 * @example
 * expandSpacing('8px')           // 모든 방향 8px
 * expandSpacing('8px 16px')      // 상하 8px, 좌우 16px
 * expandSpacing('8px 16px 12px') // 상 8px, 좌우 16px, 하 12px
 * expandSpacing('8px 16px 12px 4px') // 상 8px, 우 16px, 하 12px, 좌 4px
 */
export function expandSpacing(
  value: string | null | undefined,
  defaultValue: string = '0px'
): FourWayValues {
  if (!value || typeof value !== 'string') {
    return {
      top: defaultValue,
      right: defaultValue,
      bottom: defaultValue,
      left: defaultValue,
    };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return {
      top: defaultValue,
      right: defaultValue,
      bottom: defaultValue,
      left: defaultValue,
    };
  }

  const parts = trimmed.split(/\s+/);

  switch (parts.length) {
    case 1:
      return {
        top: parts[0],
        right: parts[0],
        bottom: parts[0],
        left: parts[0],
      };
    case 2:
      return {
        top: parts[0],
        right: parts[1],
        bottom: parts[0],
        left: parts[1],
      };
    case 3:
      return {
        top: parts[0],
        right: parts[1],
        bottom: parts[2],
        left: parts[1],
      };
    case 4:
      return {
        top: parts[0],
        right: parts[1],
        bottom: parts[2],
        left: parts[3],
      };
    default:
      return {
        top: defaultValue,
        right: defaultValue,
        bottom: defaultValue,
        left: defaultValue,
      };
  }
}
