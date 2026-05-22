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
  size = "md",
  label,
  description,
  errorMessage,
  necessityIndicator,
  labelPosition = "top",
  labelAlign,
  isQuiet,
  ...props
}: ColorFieldProps) {
  const colorFieldClassName = composeRenderProps(
    props.className,
    (className) =>
      className
        ? `react-aria-ColorField ${className}`
        : "react-aria-ColorField",
  );

  return (
    <AriaColorField
      {...props}
      className={colorFieldClassName}
      data-size={size}
      data-label-position={labelPosition}
      data-label-align={labelAlign}
      data-quiet={isQuiet ? "true" : undefined}
    >
      {label && (
        <Label>
          {label}
          {renderNecessityIndicator(necessityIndicator, props.isRequired)}
        </Label>
      )}
      <Input />
      {description && <Text slot="description">{description}</Text>}
      <FieldError>{errorMessage}</FieldError>
    </AriaColorField>
  );
}
