/**
 * Checkbox Component
 *
 * A checkbox for boolean selection
 * Based on React Aria Components Checkbox
 */

import {
  Checkbox as AriaCheckbox,
  CheckboxProps as AriaCheckboxProps,
  composeRenderProps,
} from "react-aria-components";
import { CheckIcon, Minus } from "lucide-react";
import { useFocusRing } from "@react-aria/focus";
import { mergeProps } from "@react-aria/utils";
import {
  toCheckboxRacProps,
  type CheckboxCanonicalProps,
} from "../catalog/outputs/toRacProps";
import type { ComponentSizeSubset } from "../types";
import { Skeleton } from "./Skeleton";

import "./styles/Checkbox.css";

export interface CheckboxProps extends Omit<AriaCheckboxProps, "children"> {
  children?: React.ReactNode;
  isTreeItemChild?: boolean; // TreeItem 내부에서 사용될 때를 위한 prop
  /**
   * Emphasizes the checkbox with accent color when selected (S2)
   * @default false
   */
  isEmphasized?: boolean;
  /**
   * Size of the checkbox
   * @default 'md'
   */
  size?: ComponentSizeSubset;
  /**
   * Show loading skeleton instead of checkbox
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
export function MyCheckbox(props: CheckboxProps) {
  const {
    children,
    isTreeItemChild = false,
    isEmphasized,
    size = "md",
    isLoading,
    isSelected,
    defaultSelected,
    isIndeterminate,
    isDisabled,
    isInvalid,
    isReadOnly,
    isRequired,
    name,
    value,
    form,
    className,
    ...restProps
  } = props;
  const { focusProps, isFocusVisible } = useFocusRing();
  const projectedProps = toCheckboxRacProps({
    ...restProps,
    children,
    defaultSelected,
    form,
    isDisabled,
    isEmphasized,
    isIndeterminate,
    isInvalid,
    isLoading,
    isReadOnly,
    isRequired,
    isSelected,
    name,
    size,
    value,
    className,
  } as CheckboxCanonicalProps);
  const checkboxSize = size ?? projectedProps.size;
  const checkboxChildren = children ?? projectedProps.children;
  const checkboxIsLoading = isLoading ?? projectedProps.isLoading;
  const checkboxIsEmphasized = isEmphasized ?? projectedProps.isEmphasized;

  if (checkboxIsLoading) {
    return (
      <Skeleton
        componentVariant="checkbox"
        size={checkboxSize}
        aria-label="Loading checkbox..."
      />
    );
  }

  // TreeItem 내부에서 사용될 때는 slot을 설정하지 않음
  const checkboxProps = isTreeItemChild
    ? mergeProps(restProps, focusProps)
    : mergeProps({ slot: "selection", ...restProps }, focusProps);

  return (
    <AriaCheckbox
      {...checkboxProps}
      name={projectedProps.name}
      value={projectedProps.value}
      form={projectedProps.form}
      isSelected={isSelected ?? projectedProps.isSelected}
      defaultSelected={defaultSelected ?? projectedProps.defaultSelected}
      isIndeterminate={isIndeterminate ?? projectedProps.isIndeterminate}
      isDisabled={isDisabled ?? projectedProps.isDisabled}
      isInvalid={isInvalid ?? projectedProps.isInvalid}
      isReadOnly={isReadOnly ?? projectedProps.isReadOnly}
      isRequired={isRequired ?? projectedProps.isRequired}
      data-focus-visible={isFocusVisible || undefined}
      data-emphasized={checkboxIsEmphasized || undefined}
      data-size={checkboxSize}
      className={composeRenderProps(className, (className) =>
        className ? `react-aria-Checkbox ${className}` : "react-aria-Checkbox",
      )}
    >
      {({ isSelected, isIndeterminate }) => (
        <>
          <div className="checkbox">
            {isIndeterminate ? (
              <Minus size={16} strokeWidth={4} />
            ) : (
              isSelected && <CheckIcon size={16} strokeWidth={4} />
            )}
          </div>
          {checkboxChildren}
        </>
      )}
    </AriaCheckbox>
  );
}

// 기존 Checkbox export도 유지
export function Checkbox(props: CheckboxProps) {
  return <MyCheckbox {...props} />;
}
