/**
 * TimeField Component - Material Design 3
 *
 * M3 Variants: primary, secondary, tertiary, error, filled
 * Sizes: sm, md, lg
 */

import {
  DateInput,
  DateSegment,
  FieldError,
  Label,
  Text,
  TimeField as AriaTimeField,
  TimeFieldProps as AriaTimeFieldProps,
  TimeValue,
  ValidationResult,
  composeRenderProps,
} from "react-aria-components";
import { Time } from "@internationalized/date";
import {
  toTimeFieldRacProps,
  type TimeFieldCanonicalProps,
} from "../catalog/outputs/toRacProps";
import type { ComponentSize } from "../types";
import {
  type NecessityIndicator,
  renderNecessityIndicator,
} from "./FieldNecessityIndicator";

import "./styles/generated/TimeField.css";

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 */

export interface TimeFieldProps<T extends TimeValue> extends Omit<
  AriaTimeFieldProps<T>,
  "defaultValue" | "maxValue" | "minValue" | "placeholderValue" | "value"
> {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  /**
   * 시간 형식
   * - 12: 12시간 형식 (AM/PM)
   * - 24: 24시간 형식
   * @default 24
   */
  hourCycle?: 12 | 24;
  /**
   * 플레이스홀더 텍스트
   */
  placeholder?: string;
  // S2 props
  size?: ComponentSize;
  necessityIndicator?: NecessityIndicator;
  labelPosition?: "top" | "side";
  isQuiet?: boolean;
  hideTimeZone?: boolean;
  shouldForceLeadingZeros?: boolean;
  value?: string | T;
  defaultValue?: string | T;
  /** @example "09:00" */
  placeholderValue?: string | T;
  minValue?: string | T;
  maxValue?: string | T;
  locale?: string;
  form?: string;
  validationBehavior?: "native" | "aria";
}

export function TimeField<T extends TimeValue>({
  label,
  description,
  errorMessage,
  hourCycle,
  placeholder,
  size,
  necessityIndicator,
  labelPosition,
  isQuiet,
  hideTimeZone,
  shouldForceLeadingZeros,
  value,
  defaultValue,
  placeholderValue,
  minValue,
  maxValue,
  locale,
  form,
  validationBehavior,
  isRequired,
  isDisabled,
  isReadOnly,
  isInvalid,
  ...props
}: TimeFieldProps<T>) {
  const projectedProps = toTimeFieldRacProps({
    ...props,
    label,
    description,
    errorMessage,
    hourCycle,
    value,
    defaultValue,
    placeholderValue,
    minValue,
    maxValue,
    size,
    necessityIndicator,
    labelPosition,
    isQuiet,
    hideTimeZone,
    shouldForceLeadingZeros,
    locale,
    form,
    validationBehavior,
    isRequired,
    isDisabled,
    isReadOnly,
    isInvalid,
  } as TimeFieldCanonicalProps);
  const parsedValue = parseTimeFieldValue<T>(value ?? projectedProps.value);
  const parsedDefaultValue = parseTimeFieldValue<T>(
    defaultValue ?? projectedProps.defaultValue,
  );
  const parsedPlaceholderValue = parseTimeFieldValue<T>(
    placeholderValue ?? projectedProps.placeholderValue,
  );
  const parsedMinValue = parseTimeFieldValue<T>(
    minValue ?? projectedProps.minValue,
  );
  const parsedMaxValue = parseTimeFieldValue<T>(
    maxValue ?? projectedProps.maxValue,
  );
  const fieldLabel = label;
  const fieldDescription = description ?? projectedProps.description;
  const fieldErrorMessage = errorMessage ?? projectedProps.errorMessage;
  const fieldIsRequired = isRequired ?? projectedProps.isRequired;

  return (
    <AriaTimeField
      {...props}
      className={composeRenderProps(props.className, (className) =>
        className
          ? `react-aria-TimeField ${className}`
          : "react-aria-TimeField",
      )}
      data-size={size ?? projectedProps.size}
      data-label-position={labelPosition ?? projectedProps.labelPosition}
      data-quiet={(isQuiet ?? projectedProps.isQuiet) ? "true" : undefined}
      value={parsedValue}
      defaultValue={parsedDefaultValue}
      hourCycle={projectedProps.hourCycle}
      granularity={projectedProps.granularity}
      placeholderValue={parsedPlaceholderValue}
      hideTimeZone={hideTimeZone ?? projectedProps.hideTimeZone}
      shouldForceLeadingZeros={
        shouldForceLeadingZeros ?? projectedProps.shouldForceLeadingZeros
      }
      minValue={parsedMinValue}
      maxValue={parsedMaxValue}
      isRequired={fieldIsRequired}
      isDisabled={isDisabled ?? projectedProps.isDisabled}
      isReadOnly={isReadOnly ?? projectedProps.isReadOnly}
      isInvalid={isInvalid ?? projectedProps.isInvalid}
      form={form}
      validationBehavior={validationBehavior}
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
      <DateInput className="react-aria-DateInput inset">
        {(segment) => (
          <DateSegment
            segment={segment}
            data-placeholder={
              !segment.isPlaceholder
                ? undefined
                : (placeholder ?? projectedProps.placeholderValue)
            }
          />
        )}
      </DateInput>
      {fieldDescription && <Text slot="description">{fieldDescription}</Text>}
      <FieldError>{fieldErrorMessage}</FieldError>
    </AriaTimeField>
  );
}

function parseTimeFieldValue<T extends TimeValue>(
  value: string | TimeValue | undefined,
): T | undefined {
  if (typeof value === "string") {
    const [hours, minutes, seconds] = value.split(":");
    const hour = Number(hours);
    const minute = Number(minutes);
    const second = seconds === undefined ? 0 : Number(seconds);
    if (
      Number.isInteger(hour) &&
      Number.isInteger(minute) &&
      Number.isInteger(second)
    ) {
      return new Time(hour, minute, second) as T;
    }
    return undefined;
  }
  return value as T | undefined;
}
