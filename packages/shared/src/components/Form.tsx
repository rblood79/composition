import { Form as RACForm, FormProps } from "react-aria-components";
import { FocusScope } from "@react-aria/focus";
import {
  toFormRacProps,
  type FormCanonicalProps,
} from "../catalog/outputs/toRacProps";
import type { ComponentSize } from "../types";
import "./styles/generated/Form.css";

export interface ExtendedFormProps extends FormProps {
  /**
   * 자동 포커스
   * 폼이 렌더링될 때 첫 번째 필드로 자동 이동
   * @default false
   */
  autoFocus?: boolean;
  /**
   * 포커스 복원
   * 폼 제출 후 포커스 복원 여부
   * @default false
   */
  restoreFocus?: boolean;
  labelPosition?: "top" | "side";
  labelAlign?: "start" | "center" | "end";
  necessityIndicator?: "icon" | "label";
  size?: ComponentSize;
  variant?: "default" | "outlined";
  isDisabled?: boolean;
}

/**
 * Form Component with Focus Management
 *
 * Features:
 * - Auto-focus first field on render
 * - Focus restoration after form submission
 * - Keyboard navigation (Tab, Shift+Tab)
 * - Proper form validation flow
 *
 * @example
 * <Form autoFocus>
 *   <TextField label="Name" />
 *   <TextField label="Email" />
 *   <Button type="submit">Submit</Button>
 * </Form>
 */
export function Form({
  autoFocus = false,
  restoreFocus = false,
  labelPosition: inputLabelPosition,
  labelAlign: inputLabelAlign,
  necessityIndicator: inputNecessityIndicator,
  size: inputSize,
  variant: inputVariant,
  isDisabled: inputIsDisabled,
  children,
  className,
  style,
  ...props
}: ExtendedFormProps) {
  const projectedProps = toFormRacProps({
    ...props,
    autoFocus,
    restoreFocus,
    labelPosition: inputLabelPosition,
    labelAlign: inputLabelAlign,
    necessityIndicator: inputNecessityIndicator,
    size: inputSize,
    variant: inputVariant,
    isDisabled: inputIsDisabled,
  } as FormCanonicalProps);
  const {
    action,
    method,
    encType,
    target,
    validationBehavior,
    labelPosition,
    labelAlign,
    necessityIndicator,
    size,
    variant,
    isDisabled,
    autoFocus: _projectedAutoFocus,
    restoreFocus: _projectedRestoreFocus,
    ...restProjectedProps
  } = projectedProps;

  return (
    <RACForm
      {...props}
      {...restProjectedProps}
      action={action}
      method={method}
      encType={encType}
      target={target}
      validationBehavior={validationBehavior}
      aria-disabled={isDisabled || undefined}
      data-disabled={isDisabled || undefined}
      data-size={size}
      data-variant={variant}
      data-label-position={labelPosition}
      data-label-align={labelAlign}
      data-necessity-indicator={necessityIndicator}
      className={
        typeof className === "string" && className.length > 0
          ? `react-aria-Form ${className}`
          : "react-aria-Form"
      }
      style={style}
    >
      <FocusScope autoFocus={autoFocus} restoreFocus={restoreFocus}>
        {children}
      </FocusScope>
    </RACForm>
  );
}
