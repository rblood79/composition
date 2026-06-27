import { createContext, useContext } from "react";

export const ToggleButtonGroupIndicatorContext = createContext(false);
export const ToggleButtonGroupEmphasizedContext = createContext(false);
/**
 * ToggleButton 이 ToggleButtonGroup 의 자식인지(group 멤버십) 여부.
 * group 안에서만 generated ToggleButtonGroup.css 의
 * `.react-aria-ToggleButtonGroup .react-aria-ToggleButton[data-pressed] > span { scale: 0.9 }`
 * micro-interaction selector 가 매칭하므로, span wrapper 는 group 안에서만 렌더한다.
 * standalone(기본 false)에서는 span 소비 CSS 가 없어 dead wrapper 이므로 생략.
 */
export const ToggleButtonGroupMembershipContext = createContext(false);

export function useToggleButtonGroupIndicator() {
  return useContext(ToggleButtonGroupIndicatorContext);
}

export function useToggleButtonGroupEmphasized() {
  return useContext(ToggleButtonGroupEmphasizedContext);
}

export function useToggleButtonGroupMembership() {
  return useContext(ToggleButtonGroupMembershipContext);
}
