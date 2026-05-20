/**
 * NumberField Component - Material Design 3
 *
 * M3 Variants: primary, secondary, tertiary, error, filled
 * Sizes: sm, md, lg
 */

import {
  Button,
  FieldError,
  Group,
  Input,
  Label,
  NumberField as AriaNumberField,
  NumberFieldProps as AriaNumberFieldProps,
  Text,
  ValidationResult,
  composeRenderProps,
} from "react-aria-components";
import {
  toNumberFieldRacProps,
  type NumberFieldCanonicalProps,
} from "../catalog/outputs/toRacProps";
import type { ComponentSize } from "../types";
import { Plus, Minus } from "lucide-react";
import {
  type NecessityIndicator,
  renderNecessityIndicator,
} from "./FieldNecessityIndicator";

import "./styles/generated/NumberField.css";

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 */

export interface NumberFieldProps extends AriaNumberFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  placeholder?: string;
  /**
   * 로케일
   */
  locale?: string;
  /**
   * Intl.NumberFormatOptions 직접 전달
   */
  formatOptions?: Intl.NumberFormatOptions;
  // S2 props
  size?: ComponentSize;
  necessityIndicator?: NecessityIndicator;
  labelPosition?: "top" | "side";
  isQuiet?: boolean;
  hideStepper?: boolean;
}

export function NumberField({
  label,
  description,
  errorMessage,
  placeholder,
  value,
  defaultValue,
  minValue,
  maxValue,
  step,
  locale,
  size = "md",
  necessityIndicator,
  labelPosition = "top",
  isQuiet,
  hideStepper,
  formatOptions,
  isRequired,
  isDisabled,
  isReadOnly,
  isInvalid,
  ...props
}: NumberFieldProps) {
  const projectedProps = toNumberFieldRacProps({
    ...props,
    label,
    description,
    errorMessage,
    placeholder,
    value,
    defaultValue,
    minValue,
    maxValue,
    step,
    locale,
    size,
    necessityIndicator,
    labelPosition,
    isQuiet,
    hideStepper,
    formatOptions,
    isRequired,
    isDisabled,
    isReadOnly,
    isInvalid,
  } as NumberFieldCanonicalProps);
  const fieldSize = size ?? projectedProps.size;
  const fieldLabel = label;
  const fieldDescription = description ?? projectedProps.description;
  const fieldErrorMessage = errorMessage ?? projectedProps.errorMessage;
  const fieldIsRequired = isRequired ?? projectedProps.isRequired;
  const fieldHideStepper = hideStepper ?? projectedProps.hideStepper;

  return (
    <AriaNumberField
      {...props}
      className={composeRenderProps(props.className, (className) =>
        className
          ? `react-aria-NumberField ${className}`
          : "react-aria-NumberField",
      )}
      data-size={fieldSize}
      data-label-position={labelPosition ?? projectedProps.labelPosition}
      data-quiet={(isQuiet ?? projectedProps.isQuiet) ? "true" : undefined}
      value={value ?? projectedProps.value}
      defaultValue={defaultValue ?? projectedProps.defaultValue}
      minValue={minValue ?? projectedProps.minValue}
      maxValue={maxValue ?? projectedProps.maxValue}
      step={step ?? projectedProps.step}
      formatOptions={formatOptions ?? projectedProps.formatOptions}
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
      <Group>
        <Input placeholder={placeholder ?? projectedProps.placeholder} />
        {!fieldHideStepper && (
          <>
            <Button slot="decrement">
              <Minus />
            </Button>
            <Button slot="increment">
              <Plus />
            </Button>
          </>
        )}
      </Group>
      {fieldDescription && <Text slot="description">{fieldDescription}</Text>}
      <FieldError>{fieldErrorMessage}</FieldError>
    </AriaNumberField>
  );
}
