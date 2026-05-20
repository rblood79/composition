"use client";
import {
  ColorField as AriaColorField,
  ColorFieldProps as AriaColorFieldProps,
  Input,
  ValidationResult,
  composeRenderProps,
} from "react-aria-components";
import { Text } from "./Content";
import { Label, FieldError } from "./Field";
import type { ComponentSize } from "../types";
import {
  type NecessityIndicator,
  renderNecessityIndicator,
} from "./FieldNecessityIndicator";
import {
  toColorFieldRacProps,
  type ColorFieldCanonicalProps,
} from "../catalog/outputs/toRacProps";

import "./styles/generated/ColorField.css";

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 */

export interface ColorFieldProps extends AriaColorFieldProps {
  /**
   * Size variant
   * @default 'md'
   */
  size?: ComponentSize;
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  necessityIndicator?: NecessityIndicator;
  labelPosition?: "top" | "side";
  labelAlign?: "start" | "center" | "end";
  isQuiet?: boolean;
  placeholder?: string;
}

/**
 * ColorField Component with Material Design 3 support
 *
 * Features:
 * - Color input with hex value display
 * - Keyboard navigation
 * - Validation support
 * - Error message display
 *
 * @example
 * <ColorField size="md" label="Background Color" />
 * <ColorField isInvalid errorMessage="Invalid color" />
 */
export function ColorField({
  size,
  label,
  description,
  errorMessage,
  necessityIndicator,
  labelPosition,
  labelAlign,
  isQuiet,
  placeholder,
  value,
  defaultValue,
  channel,
  colorSpace,
  isRequired,
  isDisabled,
  isReadOnly,
  isInvalid,
  ...props
}: ColorFieldProps) {
  const projectedProps = toColorFieldRacProps({
    ...props,
    label,
    description,
    errorMessage,
    necessityIndicator,
    labelPosition,
    labelAlign,
    isQuiet,
    placeholder,
    value,
    defaultValue,
    channel,
    colorSpace,
    isRequired,
    isDisabled,
    isReadOnly,
    isInvalid,
  } as ColorFieldCanonicalProps);
  const colorFieldClassName = composeRenderProps(
    props.className ?? projectedProps.className,
    (className) =>
      className
        ? `react-aria-ColorField ${className}`
        : "react-aria-ColorField",
  );
  const fieldLabel = label;
  const fieldDescription = description ?? projectedProps.description;
  const fieldErrorMessage = errorMessage ?? projectedProps.errorMessage;
  const fieldIsRequired = isRequired ?? projectedProps.isRequired;

  return (
    <AriaColorField
      {...props}
      className={colorFieldClassName}
      data-size={size ?? projectedProps.size}
      data-label-position={labelPosition ?? projectedProps.labelPosition}
      data-label-align={labelAlign ?? projectedProps.labelAlign}
      data-quiet={(isQuiet ?? projectedProps.isQuiet) ? "true" : undefined}
      value={value === undefined ? projectedProps.value : value}
      defaultValue={
        defaultValue === undefined ? projectedProps.defaultValue : defaultValue
      }
      channel={channel ?? projectedProps.channel}
      colorSpace={colorSpace ?? projectedProps.colorSpace}
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
      <Input placeholder={placeholder ?? projectedProps.placeholder} />
      {fieldDescription && <Text slot="description">{fieldDescription}</Text>}
      <FieldError>{fieldErrorMessage}</FieldError>
    </AriaColorField>
  );
}
