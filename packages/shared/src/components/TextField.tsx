/**
 * TextField Component - Material Design 3
 *
 * M3 Variants: primary, secondary, tertiary, error, filled
 * Sizes: sm, md, lg
 */

import {
  FieldError,
  Input,
  Label,
  Text,
  TextField as AriaTextField,
  TextFieldProps as AriaTextFieldProps,
  ValidationResult,
  composeRenderProps,
} from "react-aria-components";
import {
  toTextFieldRacProps,
  type TextFieldCanonicalProps,
} from "../catalog/outputs/toRacProps";
import type { ComponentSize } from "../types";
import {
  type NecessityIndicator,
  renderNecessityIndicator,
} from "./FieldNecessityIndicator";
import { Skeleton } from "./Skeleton";

import "./styles/generated/TextField.css";

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 */

export interface TextFieldProps extends AriaTextFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
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
  isQuiet?: boolean;
}

export function TextField({
  label,
  description,
  errorMessage,
  placeholder,
  type,
  value,
  defaultValue,
  onChange,
  isRequired,
  isDisabled,
  isReadOnly,
  isInvalid,
  size,
  necessityIndicator,
  isLoading,
  labelPosition,
  isQuiet,
  ...props
}: TextFieldProps) {
  const projectedProps = toTextFieldRacProps({
    ...props,
    label,
    description,
    errorMessage,
    placeholder,
    type,
    value,
    defaultValue,
    isRequired,
    isDisabled,
    isReadOnly,
    isInvalid,
    size,
    necessityIndicator,
    isLoading,
    labelPosition,
    isQuiet,
  } as TextFieldCanonicalProps);
  const fieldSize = size ?? projectedProps.size;
  const fieldLabel = label;
  const fieldDescription = description ?? projectedProps.description;
  const fieldErrorMessage = errorMessage ?? projectedProps.errorMessage;
  const fieldIsRequired = isRequired ?? projectedProps.isRequired;
  const fieldIsLoading = isLoading ?? projectedProps.isLoading;

  if (fieldIsLoading) {
    return (
      <Skeleton
        componentVariant="input"
        size={fieldSize}
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
      data-size={fieldSize}
      data-label-position={labelPosition ?? projectedProps.labelPosition}
      data-quiet={(isQuiet ?? projectedProps.isQuiet) ? "true" : undefined}
      value={value ?? projectedProps.value}
      defaultValue={defaultValue ?? projectedProps.defaultValue}
      onChange={onChange}
      isRequired={fieldIsRequired}
      isDisabled={isDisabled ?? projectedProps.isDisabled}
      isReadOnly={isReadOnly ?? projectedProps.isReadOnly}
      isInvalid={isInvalid ?? projectedProps.isInvalid}
    >
      {fieldLabel && (
        <Label>
          {fieldLabel}
          {renderNecessityIndicator(
            necessityIndicator ?? projectedProps.necessityIndicator,
            fieldIsRequired,
          )}
        </Label>
      )}
      <Input
        type={type ?? projectedProps.type}
        placeholder={placeholder ?? projectedProps.placeholder}
      />
      {fieldDescription && <Text slot="description">{fieldDescription}</Text>}
      <FieldError>{fieldErrorMessage}</FieldError>
    </AriaTextField>
  );
}
