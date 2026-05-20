import type { ReactNode } from "react";
import {
  ToggleButton as RACToggleButton,
  ToggleButtonProps,
  SelectionIndicator,
  composeRenderProps,
} from "react-aria-components";
import {
  toToggleButtonRacProps,
  type ToggleButtonCanonicalProps,
} from "../catalog/outputs/toRacProps";
import type { ComponentSizeSubset } from "../types";
import {
  useToggleButtonGroupEmphasized,
  useToggleButtonGroupIndicator,
} from "./ToggleButtonGroupContext";
import "./styles/generated/ToggleButton.css";

export interface ToggleButtonExtendedProps extends ToggleButtonProps {
  /**
   * Emphasizes the toggle button with accent color when selected (S2)
   * @default false
   */
  isEmphasized?: boolean;
  /**
   * Renders the toggle button with no visible background (S2)
   * @default false
   */
  isQuiet?: boolean;
  /**
   * Size of the toggle button
   * @default 'md'
   */
  size?: ComponentSizeSubset;
}

/**
 * S2 variant 전환: isEmphasized / isQuiet data-* 패턴
 * - data-emphasized: accent color 강조 (선택 시)
 * - data-quiet: 배경 없는 quiet 스타일
 * - data-size: 크기
 */
export function ToggleButton({
  isEmphasized: inputIsEmphasized,
  isQuiet: inputIsQuiet,
  size: _size,
  isSelected: _isSelected,
  isDisabled: _isDisabled,
  children,
  className,
  ...props
}: ToggleButtonExtendedProps) {
  const projectedProps = toToggleButtonRacProps({
    ...props,
    children,
    isDisabled: _isDisabled,
    isEmphasized: inputIsEmphasized,
    isQuiet: inputIsQuiet,
    isSelected: _isSelected,
    size: _size,
    className,
  } as ToggleButtonCanonicalProps);
  const showIndicator = useToggleButtonGroupIndicator();
  const groupEmphasized = useToggleButtonGroupEmphasized();
  const isEmphasized =
    inputIsEmphasized ?? projectedProps.isEmphasized ?? false;
  const isQuiet = inputIsQuiet ?? projectedProps.isQuiet ?? false;
  const buttonChildren = children ?? projectedProps.children;
  const effectiveEmphasized = isEmphasized || groupEmphasized;

  return (
    <RACToggleButton
      {...props}
      isDisabled={projectedProps.isDisabled}
      isSelected={projectedProps.isSelected}
      data-variant="default"
      data-emphasized={effectiveEmphasized || undefined}
      data-quiet={isQuiet || undefined}
      data-size={projectedProps.size}
      className={composeRenderProps(className, (cls) => {
        const base = showIndicator
          ? "react-aria-ToggleButton"
          : "react-aria-ToggleButton button-base";
        return cls ? `${base} ${cls}` : base;
      })}
    >
      {showIndicator && (
        <SelectionIndicator
          className="react-aria-SelectionIndicator button-base"
          data-selected
        />
      )}
      {buttonChildren as ReactNode}
    </RACToggleButton>
  );
}
