/**
 * Switch Component
 *
 * A toggle switch for on/off states
 * Based on React Aria Components Switch
 */

import {
  Switch as AriaSwitch,
  SwitchProps as AriaSwitchProps,
} from "react-aria-components/Switch";
import { composeRenderProps } from "react-aria-components/composeRenderProps";
import { useFocusRing } from "@react-aria/focus";
import { mergeProps } from "@react-aria/utils";
import type { ComponentSizeSubset } from "../types";


export interface SwitchProps extends Omit<AriaSwitchProps, "children"> {
  children: React.ReactNode;
  /**
   * Emphasizes the switch with accent color when selected (S2)
   * @default false
   */
  isEmphasized?: boolean;
  /**
   * Size of the switch
   * @default 'M'
   */
  size?: ComponentSizeSubset;
}

/**
 * S2 variant 전환: isEmphasized data-* 패턴
 * - data-emphasized: accent color 강조 (선택 시)
 * - data-size: 크기
 * - data-focus-visible: 포커스 링 표시
 */
export function Switch({
  children,
  isEmphasized = false,
  size = "M",
  ...props
}: SwitchProps) {
  const { focusProps, isFocusVisible } = useFocusRing();


  return (
    <AriaSwitch
      {...mergeProps(props, focusProps)}
      data-focus-visible={isFocusVisible || undefined}
      data-emphasized={isEmphasized || undefined}
      data-size={size}
      className={composeRenderProps(props.className, (className) =>
        className ? `react-aria-Switch ${className}` : "react-aria-Switch",
      )}
    >
      <div className="indicator" />
      {children}
    </AriaSwitch>
  );
}
