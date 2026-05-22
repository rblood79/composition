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
  "minValue" | "maxValue" | "placeholderValue"
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
  // S2 props
  size?: ComponentSize;
  necessityIndicator?: NecessityIndicator;
  labelPosition?: "top" | "side";
  isQuiet?: boolean;
  hideTimeZone?: boolean;
  shouldForceLeadingZeros?: boolean;
  placeholderValue?: string;
  locale?: string;
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
  minValue,
  maxValue,
  size = "md",
  necessityIndicator,
  labelPosition = "top",
  isQuiet,
  hideTimeZone,
  shouldForceLeadingZeros,
  placeholderValue,
  locale,
  calendarSystem,
  form,
  autoComplete,
  validationBehavior,
  ...props
}: DateFieldProps<T>) {
  // 타임존 설정
  const effectiveTimezone = timezone || getLocalTimeZone();

  // minValue/maxValue 문자열 자동 파싱
  const parsedMinValue =
    typeof minValue === "string" ? safeParseDateString(minValue) : minValue;

  const parsedMaxValue =
    typeof maxValue === "string" ? safeParseDateString(maxValue) : maxValue;

  // placeholderValue 문자열 자동 파싱
  const parsedPlaceholderValue =
    typeof placeholderValue === "string"
      ? safeParseDateString(placeholderValue)
      : undefined;

  // defaultToday가 true이고 value가 없으면 오늘 날짜 설정
  const defaultValue =
    defaultToday && !props.value && !props.defaultValue
      ? (today(effectiveTimezone) as T)
      : props.defaultValue;

  return (
    <AriaDateField
      {...props}
      className={composeRenderProps(props.className, (className) =>
        className
          ? `react-aria-DateField ${className}`
          : "react-aria-DateField",
      )}
      data-size={size}
      data-label-position={labelPosition}
      data-quiet={isQuiet ? "true" : undefined}
      defaultValue={defaultValue}
      placeholderValue={parsedPlaceholderValue as T | undefined}
      minValue={parsedMinValue as T | undefined}
      maxValue={parsedMaxValue as T | undefined}
      hideTimeZone={hideTimeZone}
      shouldForceLeadingZeros={shouldForceLeadingZeros}
      form={form}
      autoComplete={autoComplete}
      validationBehavior={validationBehavior}
    >
      {label && (
        <Label>
          {label}
          {renderNecessityIndicator(necessityIndicator, props.isRequired)}
        </Label>
      )}
      <DateInput className="react-aria-DateInput inset">
        {(segment) => <DateSegment segment={segment} />}
      </DateInput>
      {description && <Text slot="description">{description}</Text>}
      <FieldError>{errorMessage}</FieldError>
    </AriaDateField>
  );
}
