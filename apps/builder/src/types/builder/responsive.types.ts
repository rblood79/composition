/**
 * Responsive Layout Type Definitions — re-export shim
 *
 * ADR-154 Phase 1: 정본은 `@composition/shared` 의 `responsive.types.ts` 로 이동
 * (canonical schema `CanonicalNode.responsive` 가 참조 — package boundary:
 * specs ← shared ← builder). 기존 builder 내 import 경로 호환을 위해 전량
 * re-export 한다. 신규 코드는 `@composition/shared` 직접 import 권장.
 *
 * (기존 default export 는 소비자 0 건이라 제거 — named export 만 유지)
 */

export type {
  BreakpointName,
  Breakpoint,
  ResponsiveValue,
  ResponsiveStyleValue,
  ResponsiveVisibility,
  ResponsiveStyles,
  ElementResponsiveConfig,
  SlotResponsiveConfig,
  GeneratedMediaQuery,
  ElementGeneratedCSS,
  BreakpointContextState,
  BreakpointContextActions,
  BreakpointContext,
} from "@composition/shared";

export {
  BREAKPOINTS,
  BREAKPOINT_ORDER,
  hasResponsiveValue,
  hasBreakpointValue,
  getResponsiveValueWithCascade,
  generateMediaQueryString,
} from "@composition/shared";
