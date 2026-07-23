import { isResponsiveEligibleStyleProp } from "@composition/shared";
import type {
  BreakpointName,
  ElementResponsiveConfig,
} from "@composition/shared";

/**
 * shorthand → longhand 분배 대상 (store longhand 정책, ADR-909).
 * `responsive.styles` 에 담기는 실제 키는 longhand 이므로 override 존재 판정도 longhand 로 본다.
 */
export const SHORTHAND_TO_LONGHAND: Record<string, readonly string[]> = {
  gap: ["rowGap", "columnGap"],
  padding: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
  margin: ["marginTop", "marginRight", "marginBottom", "marginLeft"],
};

/**
 * ADR-154 개정 1: 해당 breakpoint tier 에 이 속성의 **명시 override 가 존재**하는지
 * (= 토글 ON 상태). shorthand(gap/padding/margin)는 longhand 중 하나라도 존재하면 ON.
 * cascade 상속값은 제외 — 자기 tier 의 명시 override 만 본다.
 */
export function hasOwnTierOverride(
  responsive: ElementResponsiveConfig | undefined,
  property: string,
  breakpoint: BreakpointName,
): boolean {
  const styles = responsive?.styles as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!styles) return false;
  const longhands = SHORTHAND_TO_LONGHAND[property] ?? [property];
  return longhands.some((key) => styles[key]?.[breakpoint] !== undefined);
}

/**
 * ADR-154 개정 1 — write 라우팅 단일 판정 (write 3함수 공통, R10).
 *
 * 편집을 base(전역) 대신 breakpoint tier override 로 라우팅할지 결정한다. 조건:
 * 비-desktop + eligible(Layout·Transform) + 해당 tier 토글 ON(명시 override 존재).
 * 하나라도 아니면 base 로 저장(어느 breakpoint 에서 편집하든 전역 적용 — 개정 기본 모델).
 * 토글 ON 은 `setResponsiveStyleOverrideEnabled` 로만 생성되므로, 토글 없이 편집하면
 * 항상 전역이다.
 */
export function shouldWriteBreakpointOverride(
  responsive: ElementResponsiveConfig | undefined,
  property: string,
  activeBreakpoint: BreakpointName,
): boolean {
  return (
    activeBreakpoint !== "desktop" &&
    isResponsiveEligibleStyleProp(property) &&
    hasOwnTierOverride(responsive, property, activeBreakpoint)
  );
}
