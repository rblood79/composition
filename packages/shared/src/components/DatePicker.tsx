import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  DateInput,
  DatePicker as AriaDatePicker,
  DatePickerProps as AriaDatePickerProps,
  DateSegment,
  DateValue,
  Dialog,
  FieldError,
  Group,
  Heading,
  I18nProvider,
  Label,
  Popover,
  Text,
  TimeField,
  ValidationResult,
  composeRenderProps,
} from "react-aria-components";

import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getLocalTimeZone, today, now } from "@internationalized/date";
import { safeParseDateString } from "../utils/core/dateUtils";
import type { ComponentSize } from "../types";
import {
  type NecessityIndicator,
  renderNecessityIndicator,
} from "./FieldNecessityIndicator";

import "./styles/generated/DatePicker.css";

export interface DatePickerProps<T extends DateValue> extends Omit<
  AriaDatePickerProps<T>,
  "minValue" | "maxValue" | "defaultValue"
> {
  /** @default 'md' */
  size?: ComponentSize;
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  // 추가 커스텀 프로퍼티들
  showCalendarIcon?: boolean;
  calendarIconPosition?: "left" | "right";
  placeholder?: string;
  dateFormat?: string;
  showWeekNumbers?: boolean;
  highlightToday?: boolean;
  allowClear?: boolean;
  // 새로운 time 옵션
  includeTime?: boolean;
  timeFormat?: "12h" | "24h";
  timeLabel?: string;
  // React Aria 라이브러리 활용 추가 옵션
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
  /** @example "2024-06-15" */
  defaultValue?: string | T;
  /**
   * 최소 날짜 (문자열 또는 DateValue)
   * @example "2024-01-01" or parseDate("2024-01-01")
   */
  minValue?: string | DateValue;
  /**
   * 최대 날짜 (문자열 또는 DateValue)
   * @example "2024-12-31" or parseDate("2024-12-31")
   */
  maxValue?: string | DateValue;
  necessityIndicator?: NecessityIndicator;
  labelPosition?: "top" | "side";
  isQuiet?: boolean;
  hideTimeZone?: boolean;
  pageBehavior?: "visible" | "single";
  /** 동시에 표시할 최대 월 수 (1~3) */
  maxVisibleMonths?: number;
  form?: string;
  autoComplete?: string;
  validationBehavior?: "native" | "aria";
  /** BCP 47 locale (e.g. "ko-KR", "en-US") */
  locale?: string;
  /** Unicode calendar identifier (e.g. "buddhist", "japanese") */
  calendarSystem?: string;
}

export function DatePicker<T extends DateValue>({
  size = "md",
  label,
  description,
  errorMessage,
  showCalendarIcon = true,
  calendarIconPosition = "right",
  placeholder,
  showWeekNumbers = false,
  highlightToday = true,
  allowClear = false,
  includeTime = false,
  timeFormat = "24h",
  timeLabel = "시간",
  granularity,
  timezone,
  defaultToday = false,
  minValue,
  maxValue,
  necessityIndicator,
  labelPosition = "top",
  isQuiet,
  hideTimeZone,
  pageBehavior,
  maxVisibleMonths,
  form,
  autoComplete,
  validationBehavior,
  locale,
  calendarSystem,
  ...props
}: DatePickerProps<T>) {
  // 타임존 설정 (명시하지 않으면 로컬 타임존 사용)
  const effectiveTimezone = timezone || getLocalTimeZone();

  // includeTime이 true일 때 granularity를 자동으로 설정
  const effectiveGranularity = includeTime
    ? granularity || "minute"
    : granularity || "day";

  // 시간 granularity 사용 시 placeholderValue를 CalendarDateTime으로 설정
  // (CalendarDate는 시간 정보가 없어 React Aria에서 에러 발생)
  const isTimeGranularity = ["hour", "minute", "second"].includes(
    effectiveGranularity,
  );
  const placeholderValue = isTimeGranularity
    ? (now(effectiveTimezone) as unknown as T)
    : undefined;

  // minValue/maxValue 문자열 자동 파싱
  const parsedMinValue =
    typeof minValue === "string" ? safeParseDateString(minValue) : minValue;

  const parsedMaxValue =
    typeof maxValue === "string" ? safeParseDateString(maxValue) : maxValue;

  // defaultValue 문자열 자동 파싱
  const parsedDefaultValue =
    typeof props.defaultValue === "string"
      ? safeParseDateString(props.defaultValue)
      : props.defaultValue;

  // defaultToday가 true이고 value가 없으면 오늘 날짜/시간 설정
  const defaultValue =
    defaultToday && !props.value && !parsedDefaultValue
      ? ((isTimeGranularity
          ? now(effectiveTimezone)
          : today(effectiveTimezone)) as T)
      : (parsedDefaultValue as T | undefined);

  const datePickerClassName = composeRenderProps(
    props.className,
    (className) =>
      className
        ? `react-aria-DatePicker ${className}`
        : "react-aria-DatePicker",
  );

  const effectiveLocale = calendarSystem
    ? `${locale || navigator.language}-u-ca-${calendarSystem}`
    : locale;

  const component = (
    <AriaDatePicker
      {...props}
      className={datePickerClassName}
      data-size={size}
      data-label-position={labelPosition}
      data-quiet={isQuiet ? "true" : undefined}
      granularity={effectiveGranularity}
      placeholderValue={placeholderValue}
      defaultValue={defaultValue}
      minValue={parsedMinValue as T | undefined}
      maxValue={parsedMaxValue as T | undefined}
      hideTimeZone={hideTimeZone}
      pageBehavior={pageBehavior}
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
      <Group>
        {showCalendarIcon && calendarIconPosition === "left" && (
          <Button slot="prefix">📅</Button>
        )}
        <DateInput>
          {(segment) => (
            <DateSegment
              segment={segment}
              data-placeholder={
                !segment.isPlaceholder ? undefined : placeholder
              }
            />
          )}
        </DateInput>
        {showCalendarIcon && calendarIconPosition === "right" && (
          <Button>
            <CalendarIcon size={16} />
          </Button>
        )}
        {allowClear && props.value && (
          <Button
            onPress={() => props.onChange?.(null)}
            aria-label="Clear date"
          >
            ✕
          </Button>
        )}
      </Group>
      {description && <Text slot="description">{description}</Text>}
      <FieldError>{errorMessage}</FieldError>
      <Popover>
        <Dialog data-size={size}>
          <div className="date-picker-popup">
            <Calendar
              data-size={size}
              data-highlight-today={highlightToday}
              data-show-week-numbers={showWeekNumbers}
              visibleDuration={
                maxVisibleMonths && maxVisibleMonths > 1
                  ? { months: maxVisibleMonths }
                  : undefined
              }
              pageBehavior={pageBehavior}
            >
              <header>
                <Button slot="previous">
                  <ChevronLeft size={16} />
                </Button>
                <Heading />
                <Button slot="next">
                  <ChevronRight size={16} />
                </Button>
              </header>
              <div style={{ display: "flex", gap: 8 }}>
                {Array.from(
                  {
                    length:
                      maxVisibleMonths && maxVisibleMonths > 1
                        ? maxVisibleMonths
                        : 1,
                  },
                  (_, i) => (
                    <CalendarGrid
                      key={i}
                      offset={i === 0 ? undefined : { months: i }}
                    >
                      {(date) => <CalendarCell date={date} />}
                    </CalendarGrid>
                  ),
                )}
              </div>
            </Calendar>

            {(includeTime || isTimeGranularity) && (
              <div className="date-picker-time-section">
                <div className="date-picker-time-field-wrapper">
                  <Label className="date-picker-time-field-label">
                    {timeLabel}
                  </Label>
                  <TimeField
                    granularity={
                      effectiveGranularity as "hour" | "minute" | "second"
                    }
                    hourCycle={timeFormat === "12h" ? 12 : 24}
                    className="react-aria-DatePicker-time-field"
                  >
                    <DateInput>
                      {(segment) => <DateSegment segment={segment} />}
                    </DateInput>
                  </TimeField>
                </div>
              </div>
            )}
          </div>
        </Dialog>
      </Popover>
    </AriaDatePicker>
  );

  if (effectiveLocale) {
    return <I18nProvider locale={effectiveLocale}>{component}</I18nProvider>;
  }
  return component;
}
