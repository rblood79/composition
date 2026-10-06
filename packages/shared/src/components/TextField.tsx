/**
 * TextField Component - Material Design 3
 *
 * M3 Variants: primary, secondary, tertiary, error, filled
 * Sizes: sm, md, lg
 */

import { Input } from "react-aria-components/Input";
import {
  TextField as AriaTextField,
  TextFieldProps as AriaTextFieldProps,
  ValidationResult,
} from "react-aria-components/TextField";
import { composeRenderProps } from "react-aria-components/composeRenderProps";
import type { ReactNode } from "react";
import type { ComponentSize } from "../types";
import {
  type NecessityIndicator,
  renderFieldLabel,
  renderFieldInput,
  renderFieldDescription,
  renderFieldError,
} from "./FieldNecessityIndicator";
import { Skeleton } from "./Skeleton";

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 */

export interface TextFieldProps extends AriaTextFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  /** The field's Input node element (catalog runtime, ADR-253); absent = composed from props. */
  inputElement?: ReactNode;
  placeholder?: string;
  type?: "text" | "email" | "password" | "search" | "tel" | "url" | "number";
  value?: string;
  onChange?: (value: string) => void;
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  // S2 props
  size?: ComponentSize;
  /** Necessity indicator type: "icon" (*) or "label" (required/optional) */
  necessityIndicator?: NecessityIndicator;
  /** Show loading skeleton instead of input */
  isLoading?: boolean;
  labelPosition?: "top" | "side";
  /**
   * side 라벨 컬럼 안에서의 라벨 텍스트 정렬 (RSP `labelAlign`). Form 조상이 지정하면
   * 상속하고, 자신이 지정하면 그것이 우선 (renderer 의 nearest-wins).
   * @default 'start'
   */
  labelAlign?: "start" | "center" | "end";
  isQuiet?: boolean;
}

export function TextField({
  label,
  description,
  errorMessage,
  placeholder = "Enter text...",
  type = "text",
  value,
  onChange,
  isRequired,
  isDisabled,
  isReadOnly,
  size = "md",
  necessityIndicator,
  isLoading,
  labelPosition = "top",
  labelAlign,
  isQuiet,
  inputElement,
  ...props
}: TextFieldProps) {
  if (isLoading) {
    return (
      <Skeleton
        componentVariant="input"
        size={size}
        className={props.className as string}
        aria-label="Loading text field..."
      />
    );
  }

  return (
    <AriaTextField
      {...props}
      className={composeRenderProps(props.className, (className) =>
        className
          ? `react-aria-TextField ${className}`
          : "react-aria-TextField",
      )}
      data-size={size}
      data-label-position={labelPosition}
      data-label-align={labelAlign}
      data-quiet={isQuiet ? "true" : undefined}
      value={value}
      onChange={onChange}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isReadOnly={isReadOnly}
    >
      {/* ADR-253: the catalog runtime passes the field's part nodes as elements (each drawn by
          its own binding inside this field's RAC context); any other value is composed here. */}
      {renderFieldLabel(label, necessityIndicator, isRequired)}
      {renderFieldInput(
        inputElement,
        <Input type={type} placeholder={placeholder} data-size={size} />,
      )}
      {renderFieldDescription(description)}
      {renderFieldError(errorMessage)}
    </AriaTextField>
  );
}
