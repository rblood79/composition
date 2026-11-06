import { createContext, useContext } from "react";
import type { ComponentSize, StaticColor } from "../types";

/** S2 1.8.2: 지정된 그룹 시각 값이 우선하고, 생략된 값은 자식의 값을 사용한다. */
export const ToggleButtonGroupVisualContext = createContext<{
  size?: ComponentSize;
  isEmphasized?: boolean;
  isQuiet?: boolean;
  isDisabled?: boolean;
  staticColor?: StaticColor;
  density?: "compact" | "regular";
  orientation?: "horizontal" | "vertical";
  isJustified?: boolean;
} | null>(null);
export const ToggleButtonGroupIndicatorContext = createContext(false);
export const ToggleButtonGroupMembershipContext = createContext(false);

export function useToggleButtonGroupVisual() {
  return useContext(ToggleButtonGroupVisualContext);
}

export function useToggleButtonGroupIndicator() {
  return useContext(ToggleButtonGroupIndicatorContext);
}

export function useToggleButtonGroupMembership() {
  return useContext(ToggleButtonGroupMembershipContext);
}

/** 기존 공용 hook을 유지한다. */
export function useToggleButtonGroupEmphasized() {
  return useToggleButtonGroupVisual()?.isEmphasized ?? false;
}
