/**
 * DateField Component - Material Design 3
 *
 * M3 Variants: primary, secondary, tertiary, error, filled
 * Sizes: sm, md, lg
 */

import {
  DateField as AriaDateField,
  DateFieldProps as AriaDateFieldProps,
  DateInput,
  DateSegment,
  DateValue,
  FieldError,
  Label,
  Text,
  ValidationResult,
  composeRenderProps,
} from "react-aria-components";
import {
  toDateFieldRacProps,
  type DateFieldCanonicalProps,
} from "../catalog/outputs/toRacProps";
import type { ComponentSize } from "../types";
import { getLocalTimeZone, today } from "@internationalized/date";
import { safeParseDateString } from "../utils/core/dateUtils";
import {
  type NecessityIndicator,
  renderNecessityIndicator,
} from "./FieldNecessityIndicator";

import "./styles/generated/DateField.css";

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 */

export interface DateFieldProps<T extends DateValue> extends Omit<
  AriaDateFieldProps<T>,
  "defaultValue" | "maxValue" | "minValue" | "placeholderValue" | "value"
> {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  /**
   * 타임존 (기본값: 로컬 타임존)
   * @default getLocalTimeZone()
   */
  timezone?: string;
  /**
   * 기본값을 오늘로 설정
   * @default false
   */
  defaultToday?: boolean;
  /**
   * 최소 날짜 (문자열 또는 DateValue)
   * @example "2024-01-01"
   */
  minValue?: string | DateValue;
  /**
   * 최대 날짜 (문자열 또는 DateValue)
   * @example "2024-12-31"
   */
  maxValue?: string | DateValue;
  value?: string | T;
  defaultValue?: string | T;
  // S2 props
  size?: ComponentSize;
  necessityIndicator?: NecessityIndicator;
  labelPosition?: "top" | "side";
  isQuiet?: boolean;
  hideTimeZone?: boolean;
  shouldForceLeadingZeros?: boolean;
  placeholderValue?: string | T;
  locale?: string;
  calendar?: string;
  calendarSystem?: string;
  form?: string;
  autoComplete?: string;
  validationBehavior?: "native" | "aria";
}

export function DateField<T extends DateValue>({
  label,
  description,
  errorMessage,
  timezone,
  defaultToday = false,
  value,
  defaultValue: defaultValueProp,
  minValue,
  maxValue,
  size,
  necessityIndicator,
  labelPosition,
  isQuiet,
  hideTimeZone,
  shouldForceLeadingZeros,
  placeholderValue,
  locale,
  calendar,
  calendarSystem,
  form,
  autoComplete,
  validationBehavior,
  isRequired,
  isDisabled,
  isReadOnly,
  isInvalid,
  ...props
}: DateFieldProps<T>) {
  const projectedProps = toDateFieldRacProps({
    ...props,
    label,
    description,
    errorMessage,
    timezone,
    value,
    defaultValue: defaultValueProp,
    minValue,
    maxValue,
    size,
    necessityIndicator,
    labelPosition,
    isQuiet,
    hideTimeZone,
    shouldForceLeadingZeros,
    placeholderValue,
    locale,
    calendar: calendar ?? calendarSystem,
    form,
    autoComplete,
    validationBehavior,
    isRequired,
    isDisabled,
    isReadOnly,
    isInvalid,
  } as DateFieldCanonicalProps);
  // 타임존 설정
  const effectiveTimezone =
    timezone || projectedProps.timezone || getLocalTimeZone();

  // minValue/maxValue 문자열 자동 파싱
  const parsedMinValue = parseDateFieldValue<T>(
    minValue ?? projectedProps.minValue,
  );

  const parsedMaxValue = parseDateFieldValue<T>(
    maxValue ?? projectedProps.maxValue,
  );

  // placeholderValue 문자열 자동 파싱
  const parsedPlaceholderValue = parseDateFieldValue<T>(
    placeholderValue ?? projectedProps.placeholderValue,
  );
  const parsedValue = parseDateFieldValue<T>(value ?? projectedProps.value);
  const parsedDefaultValue = parseDateFieldValue<T>(
    defaultValueProp ?? projectedProps.defaultValue,
  );

  // defaultToday가 true이고 value가 없으면 오늘 날짜 설정
  const defaultValue =
    defaultToday && !parsedValue && !parsedDefaultValue
      ? (today(effectiveTimezone) as T)
      : parsedDefaultValue;
  const fieldSize = size ?? projectedProps.size;
  const fieldLabel = label;
  const fieldDescription = description ?? projectedProps.description;
  const fieldErrorMessage = errorMessage ?? projectedProps.errorMessage;
  const fieldIsRequired = isRequired ?? projectedProps.isRequired;

  return (
    <AriaDateField
      {...props}
      className={composeRenderProps(props.className, (className) =>
        className
          ? `react-aria-DateField ${className}`
          : "react-aria-DateField",
      )}
      data-size={fieldSize}
      data-label-position={labelPosition ?? projectedProps.labelPosition}
      data-quiet={(isQuiet ?? projectedProps.isQuiet) ? "true" : undefined}
      value={parsedValue}
      defaultValue={defaultValue}
      placeholderValue={parsedPlaceholderValue as T | undefined}
      minValue={parsedMinValue as T | undefined}
      maxValue={parsedMaxValue as T | undefined}
      granularity={projectedProps.granularity}
      hourCycle={projectedProps.hourCycle}
      hideTimeZone={hideTimeZone ?? projectedProps.hideTimeZone}
      shouldForceLeadingZeros={
        shouldForceLeadingZeros ?? projectedProps.shouldForceLeadingZeros
      }
      isRequired={fieldIsRequired}
      isDisabled={isDisabled ?? projectedProps.isDisabled}
      isReadOnly={isReadOnly ?? projectedProps.isReadOnly}
      isInvalid={isInvalid ?? projectedProps.isInvalid}
      form={form}
      autoComplete={autoComplete}
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
        {(segment) => <DateSegment segment={segment} />}
      </DateInput>
      {fieldDescription && <Text slot="description">{fieldDescription}</Text>}
      <FieldError>{fieldErrorMessage}</FieldError>
    </AriaDateField>
  );
}

function parseDateFieldValue<T extends DateValue>(
  value: string | DateValue | undefined,
): T | undefined {
  if (typeof value === "string") {
    return (safeParseDateString(value) ?? undefined) as T | undefined;
  }
  return value as T | undefined;
}
