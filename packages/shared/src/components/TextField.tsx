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
  isQuiet,
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
      data-quiet={isQuiet ? "true" : undefined}
      value={value}
      onChange={onChange}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isReadOnly={isReadOnly}
    >
      {label && (
        <Label>
          {label}
          {renderNecessityIndicator(necessityIndicator, isRequired)}
        </Label>
      )}
      <Input type={type} placeholder={placeholder} />
      {description && <Text slot="description">{description}</Text>}
      <FieldError>{errorMessage}</FieldError>
    </AriaTextField>
  );
}
