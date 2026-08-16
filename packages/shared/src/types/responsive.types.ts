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
 * ADR-154 개정 1 (2026-07-23) — Style 패널이 편집하는 responsive-eligible 키.
 *
 * breakpoint 별 override(토글 opt-in)를 허용하는 style prop 중 **사용자가 직접 편집하는 축**.
 * Layout·Transform 섹션이 편집하는 키 전수(Style 패널 `LAYOUT_PROPS` ∪ `TRANSFORM_PROPS` 미러).
 *
 * eligibility 판정의 SSOT 는 이 집합이 아니라 {@link RESPONSIVE_ELIGIBLE_STYLE_PROPS} 다 —
 * ADR-168 이 프리셋 authoring 축({@link PRESET_AUTHORED_RESPONSIVE_STYLE_PROPS})을 두 번째
 * write 주체로 추가하면서 "편집 UI 가 있는가" 와 "eligible 인가" 가 분리됐다.
 *
 * ## 개정 모델
 *
 * 어느 breakpoint 화면에서 편집하든 기본은 base(`props.style`) 저장 = 전 breakpoint 적용.
 * eligible 속성만 속성 단위 토글 ON 시 해당 tier override 로 저장한다. eligible 이 **아닌**
 * 모든 style prop(배경 fills·border·radius·typography·overflow·boxShadow 등)은 "전역"
 * — 어느 breakpoint 에서든 base 로 저장되어 전 breakpoint 에 적용된다.
 *
 * ## Why (개정 계기)
 *
 * 원안은 비-desktop 편집을 자동으로 tier override 로 저장(암묵 tier write)했는데, 화면 전환만으로
 * 편집 적용 범위가 바뀌어 예측이 어려웠다("왜 여기서 이게 이렇게 나오지?"). desktop↔mobile 차이는
 * 대부분 Layout·Transform(크기/배치) 축이라는 실사용 정신 모델에 맞춰, 그 축만 명시적 opt-in
 * override 로 좁히고 나머지는 전역으로 통일한다.
 *
 * ## 드리프트 가드 (R9)
 *
 * `LAYOUT_PROPS`/`TRANSFORM_PROPS`(builder 섹션)와의 합집합 일치를 정적 테스트가 확증한다
 * (`responsiveEligible.static.test.ts`). 섹션에 편집 필드 추가 시 이 집합도 동반 갱신.
 *
 * `ResponsiveStyles` 인터페이스(아래)는 저장 형태 힌트일 뿐 런타임 게이트가 아니다 — eligibility
 * 판정의 SSOT 는 {@link RESPONSIVE_ELIGIBLE_STYLE_PROPS}. (resolve/CSS 경로는 `Object.keys` 로
 * generic 처리하므로 여기 담긴 어떤 키든 처리된다.)
 */
export const SECTION_EDITABLE_RESPONSIVE_PROPS: ReadonlySet<string> = new Set([
  // ── Layout 섹션 (LAYOUT_PROPS 미러) ──
  "display",
  "flexDirection",
  "flexWrap",
  "alignItems",
  "justifyContent",
  "gap",
  "rowGap",
  "columnGap",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  // ── Transform 섹션 (TRANSFORM_PROPS 미러) ──
  "width",
  "height",
  "position",
  "top",
  "left",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "justifySelf",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "aspectRatio",
]);

/**
 * ADR-168 — 프리셋만 authoring 하는 breakpoint-가변 키. **편집 UI 없음.**
 *
 * ## Why (ADR-154 개정 1 의 전제 개정)
 *
 * ADR-154 는 eligible 집합을 "Style 패널이 편집하는 키 전수" 와 정확히 일치시켰다. 이는
 * breakpoint override 의 **write 주체가 Style 패널 하나뿐** 이라는 당시 조건의 부산물이다.
 * Frame preset 이 두 번째 write 주체가 되면서 "편집 UI 가 있는가" 와 "breakpoint 별로
 * 달라져야 하는가" 가 분리됐다 — grid 트랙은 편집 UI 가 없지만 mobile 에서 반드시 달라져야
 * 한다(사이드바 250px 고정이 390px 뷰포트에서 콘텐츠를 140px 로 만든다).
 *
 * 이 집합의 키는 `ResponsiveSection` 의 "Add override" picker 에 노출되지 않는다 — picker 는
 * eligible 집합을 순회하지 않고 자체 목록을 쓴다(`ResponsiveSection.tsx`). 즉 사용자가 이
 * 키들을 직접 토글할 수는 없고, 프리셋 정의가 유일한 write 주체다.
 *
 * ## gridArea shorthand 제외 (리뷰 round 1 M3)
 *
 * `responsiveCss` 는 `Object.keys` 순서로 emit 하고 모든 선언이 `!important` 동일 특정도라
 * **source order 가 승자를 정한다.** 같은 breakpoint 에서 shorthand 와 longhand 를 함께
 * override 하면 뒤에 온 shorthand 가 longhand 를 리셋한다. 대칭 목적으로 넣으면 도달 가능한
 * 결함 경로만 여는 셈이라 배제한다 — 필요해지면 emit 순서 계약과 함께 도입한다.
 */
export const PRESET_AUTHORED_RESPONSIVE_STYLE_PROPS: ReadonlySet<string> =
  new Set([
    // 컨테이너 트랙 정의
    "gridTemplateColumns",
    "gridTemplateRows",
    "gridTemplateAreas",
    // 슬롯 배치 line (숫자 line 병기 — layout-engine.md §"Grid area 이름 해석")
    "gridColumnStart",
    "gridColumnEnd",
    "gridRowStart",
    "gridRowEnd",
  ]);

/**
 * breakpoint 별 override 가 허용되는 style prop 전수 (판정 SSOT).
 *
 * 두 write 주체의 합집합이다 — {@link SECTION_EDITABLE_RESPONSIVE_PROPS}(Style 패널 편집) ∪
 * {@link PRESET_AUTHORED_RESPONSIVE_STYLE_PROPS}(프리셋 authoring). 어느 키도 두 집합 중
 * 하나에 **명시 선언되지 않고는** eligible 이 될 수 없으며, 정적 테스트가 이를 확증한다
 * (`responsiveEligible.static.test.ts` — 섹션 일치 + 차집합 일치 2단언).
 */
export const RESPONSIVE_ELIGIBLE_STYLE_PROPS: ReadonlySet<string> = new Set([
  ...SECTION_EDITABLE_RESPONSIVE_PROPS,
  ...PRESET_AUTHORED_RESPONSIVE_STYLE_PROPS,
]);

/**
 * ADR-154 개정 1 — style prop 이 breakpoint 별 override(토글 opt-in) 대상인지 판정.
 * `false` = 전역 속성(어느 breakpoint 에서든 base 저장). SSOT: {@link RESPONSIVE_ELIGIBLE_STYLE_PROPS}.
 */
export function isResponsiveEligibleStyleProp(property: string): boolean {
  return RESPONSIVE_ELIGIBLE_STYLE_PROPS.has(property);
}

/**
 * Element의 Responsive 스타일 속성 (저장 형태 힌트).
 *
 * NOTE (ADR-154 개정 1): eligibility 판정의 런타임 SSOT 는 {@link RESPONSIVE_ELIGIBLE_STYLE_PROPS}
 * 다. 이 인터페이스에 나열된 fontSize/textAlign 등은 개정 후 eligible 이 아니며(전역), 반대로
 * Transform 축 일부(minWidth 등)는 여기 미선언이지만 eligible 이다 — resolve/CSS 경로가 generic
 * `Object.keys` 처리라 저장·resolve 는 정상 동작한다. 정확한 게이트는 위 allowlist 를 볼 것.
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
  /**
   * Grid 템플릿 영역 + 슬롯 배치 line (ADR-168 — 프리셋 authoring 축).
   *
   * 편집 UI 는 없고 Frame preset 정의가 유일한 write 주체다
   * ({@link PRESET_AUTHORED_RESPONSIVE_STYLE_PROPS}). line 은 length 가 아니라 번호라
   * publish `@media` emit 시 px 가 붙으면 안 된다 (`responsiveCss.ts` UNITLESS_PROPS).
   */
  gridTemplateAreas?: ResponsiveStyleValue;
  gridColumnStart?: ResponsiveStyleValue;
  gridColumnEnd?: ResponsiveStyleValue;
  gridRowStart?: ResponsiveStyleValue;
  gridRowEnd?: ResponsiveStyleValue;
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
  /** Flex grow/shrink (unitless — Transform 섹션 미러, eligible) */
  flexGrow?: ResponsiveValue<number>;
  flexShrink?: ResponsiveValue<number>;
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
