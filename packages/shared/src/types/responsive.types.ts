/**
 * Responsive Layout Type Definitions
 *
 * Breakpoint 기반 반응형 레이아웃을 위한 타입 정의.
 * 3단계 Breakpoint: desktop (≥1280px), tablet (768-1279px), mobile (<768px)
 *
 * ADR-154 Phase 1: `apps/builder/src/types/builder/responsive.types.ts` 에서
 * shared 로 이동 (canonical schema `CanonicalNode.responsive` 가 본 타입을
 * 참조 — package boundary: specs ← shared ← builder). builder 측 파일은
 * re-export shim 으로 유지.
 */

// ============================================
// Breakpoint Definitions
// ============================================

/**
 * Breakpoint 이름
 */
export type BreakpointName = "desktop" | "tablet" | "mobile";

/**
 * Breakpoint 설정
 */
export interface Breakpoint {
  name: BreakpointName;
  /** 최소 너비 (px) */
  minWidth: number;
  /** 최대 너비 (px, undefined면 무제한) */
  maxWidth?: number;
  /** 표시 라벨 */
  label: string;
  /** 아이콘 (lucide-react 아이콘 이름) */
  icon: string;
}

/**
 * 기본 Breakpoint 설정
 */
export const BREAKPOINTS: Record<BreakpointName, Breakpoint> = {
  desktop: {
    name: "desktop",
    minWidth: 1280,
    maxWidth: undefined,
    label: "Desktop",
    icon: "Monitor",
  },
  tablet: {
    name: "tablet",
    minWidth: 768,
    maxWidth: 1279,
    label: "Tablet",
    icon: "Tablet",
  },
  mobile: {
    name: "mobile",
    minWidth: 0,
    maxWidth: 767,
    label: "Mobile",
    icon: "Smartphone",
  },
};

/**
 * Breakpoint 배열 (넓은 순서)
 */
export const BREAKPOINT_ORDER: BreakpointName[] = [
  "desktop",
  "tablet",
  "mobile",
];

// ============================================
// Responsive Values
// ============================================

/**
 * Breakpoint별 값을 저장하는 타입
 * 예: { desktop: "row", tablet: "column", mobile: "column" }
 */
export type ResponsiveValue<T> = {
  [K in BreakpointName]?: T;
};

/**
 * 일반적인 Responsive 스타일 값
 */
export type ResponsiveStyleValue = ResponsiveValue<string | number>;

/**
 * Responsive 가시성 설정
 */
export type ResponsiveVisibility = ResponsiveValue<boolean>;

// ============================================
// Element Responsive Props
// ============================================

/**
 * Element의 Responsive 스타일 속성
 */
export interface ResponsiveStyles {
  /** Flex 방향 */
  flexDirection?: ResponsiveValue<
    "row" | "column" | "row-reverse" | "column-reverse"
  >;
  /** Grid 템플릿 컬럼 */
  gridTemplateColumns?: ResponsiveStyleValue;
  /** Grid 템플릿 로우 */
  gridTemplateRows?: ResponsiveStyleValue;
  /** Gap (shorthand) */
  gap?: ResponsiveStyleValue;
  /**
   * Gap / padding / margin longhand (ADR-909 store longhand 정책).
   * Inspector `buildResponsiveStyleOverride` 는 shorthand 편집을 longhand 로
   * 분배 저장하므로, 실제 `responsive.styles` 에 담기는 키는 아래 longhand 다
   * (shorthand 키는 legacy/직접 입력 fallback).
   */
  rowGap?: ResponsiveStyleValue;
  columnGap?: ResponsiveStyleValue;
  paddingTop?: ResponsiveStyleValue;
  paddingRight?: ResponsiveStyleValue;
  paddingBottom?: ResponsiveStyleValue;
  paddingLeft?: ResponsiveStyleValue;
  marginTop?: ResponsiveStyleValue;
  marginRight?: ResponsiveStyleValue;
  marginBottom?: ResponsiveStyleValue;
  marginLeft?: ResponsiveStyleValue;
  /** Display */
  display?: ResponsiveValue<
    | "flex"
    | "grid"
    | "block"
    | "none"
    | "inline"
    | "inline-flex"
    | "inline-block"
  >;
  /** Order (순서) */
  order?: ResponsiveValue<number>;
  /** Width */
  width?: ResponsiveStyleValue;
  /** Height */
  height?: ResponsiveStyleValue;
  /** Padding */
  padding?: ResponsiveStyleValue;
  /** Margin */
  margin?: ResponsiveStyleValue;
  /** Font Size */
  fontSize?: ResponsiveStyleValue;
  /** Text Align */
  textAlign?: ResponsiveValue<"left" | "center" | "right" | "justify">;
  /** Justify Content */
  justifyContent?: ResponsiveValue<
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly"
  >;
  /** Align Items */
  alignItems?: ResponsiveValue<
    "flex-start" | "flex-end" | "center" | "stretch" | "baseline"
  >;
}

/**
 * Element에 저장되는 Responsive 설정
 */
export interface ElementResponsiveConfig {
  /** Breakpoint별 가시성 */
  visibility?: ResponsiveVisibility;
  /** Breakpoint별 스타일 */
  styles?: ResponsiveStyles;
}

// ============================================
// Slot Responsive Props
// ============================================

/**
 * Slot의 Responsive 설정
 */
export interface SlotResponsiveConfig {
  /** Breakpoint별 가시성 (Slot 숨김/표시) */
  visibility?: ResponsiveVisibility;
  /** Breakpoint별 순서 */
  order?: ResponsiveValue<number>;
}

// ============================================
// CSS Generation
// ============================================

/**
 * 생성된 CSS 미디어 쿼리
 */
export interface GeneratedMediaQuery {
  /** Breakpoint 이름 */
  breakpoint: BreakpointName;
  /** 미디어 쿼리 조건 */
  mediaQuery: string;
  /** CSS 규칙들 */
  rules: string[];
}

/**
 * Element별 생성된 CSS
 */
export interface ElementGeneratedCSS {
  /** Element ID */
  elementId: string;
  /** 기본 CSS (모든 Breakpoint) */
  baseCSS: string;
  /** Breakpoint별 미디어 쿼리 */
  mediaQueries: GeneratedMediaQuery[];
}

// ============================================
// Breakpoint Context
// ============================================

/**
 * Breakpoint Context 상태
 */
export interface BreakpointContextState {
  /** 현재 활성 Breakpoint */
  currentBreakpoint: BreakpointName;
  /** Preview 강제 Breakpoint (테스트용) */
  forcedBreakpoint: BreakpointName | null;
  /** 현재 뷰포트 너비 */
  viewportWidth: number;
  /** Breakpoint 설정 */
  breakpoints: Record<BreakpointName, Breakpoint>;
}

/**
 * Breakpoint Context Actions
 */
export interface BreakpointContextActions {
  /** 강제 Breakpoint 설정 (테스트용) */
  setForcedBreakpoint: (breakpoint: BreakpointName | null) => void;
  /** Breakpoint가 활성 상태인지 확인 */
  isBreakpointActive: (breakpoint: BreakpointName) => boolean;
  /** 현재 Breakpoint에서 값 가져오기 */
  getResponsiveValue: <T>(
    value: ResponsiveValue<T> | undefined,
    defaultValue: T,
  ) => T;
}

/**
 * Breakpoint Context 전체
 */
export type BreakpointContext = BreakpointContextState &
  BreakpointContextActions;

// ============================================
// Utility Types
// ============================================

/**
 * Responsive 값이 설정되어 있는지 확인하는 타입 가드
 */
export function hasResponsiveValue<T>(
  value: ResponsiveValue<T> | undefined,
): value is ResponsiveValue<T> {
  if (!value) return false;
  return Object.values(value).some((v) => v !== undefined);
}

/**
 * 특정 Breakpoint에 값이 있는지 확인
 */
export function hasBreakpointValue<T>(
  value: ResponsiveValue<T> | undefined,
  breakpoint: BreakpointName,
): boolean {
  return value?.[breakpoint] !== undefined;
}

/**
 * Responsive 값에서 특정 Breakpoint 값 가져오기 (cascade)
 * desktop → tablet → mobile 순서로 폴백
 */
export function getResponsiveValueWithCascade<T>(
  value: ResponsiveValue<T> | undefined,
  breakpoint: BreakpointName,
  defaultValue: T,
): T {
  if (!value) return defaultValue;

  // 현재 Breakpoint 값이 있으면 반환
  if (value[breakpoint] !== undefined) {
    return value[breakpoint] as T;
  }

  // Cascade: 더 큰 Breakpoint에서 값 찾기
  const cascadeOrderMap: Record<BreakpointName, BreakpointName[]> = {
    desktop: [],
    tablet: ["desktop"],
    mobile: ["tablet", "desktop"],
  };
  const cascadeOrder = cascadeOrderMap[breakpoint];

  for (const fallbackBreakpoint of cascadeOrder) {
    if (value[fallbackBreakpoint] !== undefined) {
      return value[fallbackBreakpoint] as T;
    }
  }

  return defaultValue;
}

/**
 * 미디어 쿼리 문자열 생성
 */
export function generateMediaQueryString(breakpoint: Breakpoint): string {
  const { minWidth, maxWidth } = breakpoint;

  if (minWidth === 0 && maxWidth !== undefined) {
    return `@media (max-width: ${maxWidth}px)`;
  }

  if (maxWidth === undefined) {
    return `@media (min-width: ${minWidth}px)`;
  }

  return `@media (min-width: ${minWidth}px) and (max-width: ${maxWidth}px)`;
}
