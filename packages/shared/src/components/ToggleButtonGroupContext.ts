import { createContext, useContext } from "react";

import type { StaticColor } from "../types";

export const ToggleButtonGroupIndicatorContext = createContext(false);
export const ToggleButtonGroupEmphasizedContext = createContext(false);
/**
 * 그룹의 `staticColor` 를 자식 ToggleButton 으로 내려보내는 채널 (RSP S2
 * ActionButtonGroup 은 staticColor 를 자체 시각이 아니라 **자식 상속**으로 정의한다).
 *
 * 해석 규칙은 자식 우선: 자식이 `auto` 가 아닌 값을 직접 가지면 그것을 쓰고, `auto`
 * (기본값)일 때만 그룹 값을 받는다. `isEmphasized`(불리언 OR) 와 달리 enum 이라 OR 로
 * 합칠 수 없어 명시 우선 규칙으로 둔다. Skia 도 같은 우선순위로 주입한다
 * (buildSpecNodeData.resolveToggleGroupContext — 대칭 지점).
 */
export const ToggleButtonGroupStaticColorContext =
  createContext<StaticColor>("auto");
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

export function useToggleButtonGroupStaticColor() {
  return useContext(ToggleButtonGroupStaticColorContext);
}
