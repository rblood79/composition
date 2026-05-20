/**
 * Switch Component
 *
 * A toggle switch for on/off states
 * Based on React Aria Components Switch
 */

import {
  Switch as AriaSwitch,
  SwitchProps as AriaSwitchProps,
  composeRenderProps,
} from "react-aria-components";
import { useFocusRing } from "@react-aria/focus";
import { mergeProps } from "@react-aria/utils";
import {
  toSwitchRacProps,
  type SwitchCanonicalProps,
} from "../catalog/outputs/toRacProps";
import type { ComponentSizeSubset } from "../types";
import { Skeleton } from "./Skeleton";

import "./styles/Switch.css";

export interface SwitchProps extends Omit<AriaSwitchProps, "children"> {
  children?: React.ReactNode;
  /**
   * Emphasizes the switch with accent color when selected (S2)
   * @default false
   */
  isEmphasized?: boolean;
  /**
   * Size of the switch
   * @default 'md'
   */
  size?: ComponentSizeSubset;
  /**
   * Show loading skeleton instead of switch
   * @default false
   */
  isLoading?: boolean;
}

/**
 * S2 variant 전환: isEmphasized data-* 패턴
 * - data-emphasized: accent color 강조 (선택 시)
 * - data-size: 크기
 * - data-focus-visible: 포커스 링 표시
 */
export function Switch({
  children,
  isEmphasized,
  size,
  isLoading,
  isSelected,
  defaultSelected,
  isDisabled,
  isReadOnly,
  name,
  value,
  className,
  ...props
}: SwitchProps) {
  const { focusProps, isFocusVisible } = useFocusRing();
  const projectedProps = toSwitchRacProps({
    ...props,
    children,
    defaultSelected,
    isDisabled,
    isEmphasized,
    isLoading,
    isReadOnly,
    isSelected,
    name,
    size,
    value,
    className,
  } as SwitchCanonicalProps);
  const switchSize = size ?? projectedProps.size;
  const switchChildren = children ?? projectedProps.children;
  const switchIsLoading = isLoading ?? projectedProps.isLoading;
  const switchIsEmphasized = isEmphasized ?? projectedProps.isEmphasized;

  if (switchIsLoading) {
    return (
      <Skeleton
        componentVariant="switch"
        size={switchSize}
        aria-label="Loading switch..."
      />
    );
  }

  return (
    <AriaSwitch
      {...mergeProps(props, focusProps)}
      name={projectedProps.name}
      value={projectedProps.value}
      isSelected={isSelected ?? projectedProps.isSelected}
      defaultSelected={defaultSelected ?? projectedProps.defaultSelected}
      isDisabled={isDisabled ?? projectedProps.isDisabled}
      isReadOnly={isReadOnly ?? projectedProps.isReadOnly}
      data-focus-visible={isFocusVisible || undefined}
      data-emphasized={switchIsEmphasized || undefined}
      data-size={switchSize}
      className={composeRenderProps(className, (className) =>
        className ? `react-aria-Switch ${className}` : "react-aria-Switch",
      )}
    >
      <div className="indicator" />
      {switchChildren}
    </AriaSwitch>
  );
}
