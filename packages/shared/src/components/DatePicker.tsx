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
import type { CSSProperties } from "react";

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
import {
  toDatePickerRacProps,
  type DatePickerCanonicalProps,
  type DatePickerRacProps,
} from "../catalog/outputs/toRacProps";

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
  const projectedProps = toDatePickerRacProps({
    ...props,
    size,
    label,
    description,
    errorMessage,
    showCalendarIcon,
    calendarIconPosition,
    placeholder,
    showWeekNumbers,
    highlightToday,
    allowClear,
    includeTime,
    timeFormat,
    timeLabel,
    granularity,
    timezone,
    defaultToday,
    minValue,
    maxValue,
    necessityIndicator,
    labelPosition,
    isQuiet,
    hideTimeZone,
    pageBehavior,
    maxVisibleMonths,
    form,
    autoComplete,
    validationBehavior,
    locale,
    calendarSystem,
  } as DatePickerCanonicalProps);
  const projectedSize = projectedProps.size as DatePickerRacProps["size"];
  const projectedLabelPosition =
    projectedProps.labelPosition as DatePickerRacProps["labelPosition"];
  const projectedMaxVisibleMonths = projectedProps.maxVisibleMonths;
  // 타임존 설정 (명시하지 않으면 로컬 타임존 사용)
  const effectiveTimezone = projectedProps.timezone || getLocalTimeZone();

  // includeTime이 true일 때 granularity를 자동으로 설정
  const effectiveGranularity = projectedProps.includeTime
    ? granularity || "minute"
    : projectedProps.granularity;

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
    typeof projectedProps.minValue === "string"
      ? safeParseDateString(projectedProps.minValue)
      : minValue;

  const parsedMaxValue =
    typeof projectedProps.maxValue === "string"
      ? safeParseDateString(projectedProps.maxValue)
      : maxValue;

  // defaultValue 문자열 자동 파싱
  const parsedDefaultValue =
    typeof projectedProps.defaultValue === "string"
      ? safeParseDateString(projectedProps.defaultValue)
      : props.defaultValue;

  // defaultToday가 true이고 value가 없으면 오늘 날짜/시간 설정
  const defaultValue =
    projectedProps.defaultToday && !props.value && !parsedDefaultValue
      ? ((isTimeGranularity
          ? now(effectiveTimezone)
          : today(effectiveTimezone)) as T)
      : (parsedDefaultValue as T | undefined);

  const datePickerClassName = composeRenderProps(
    projectedProps.className ?? props.className,
    (className) =>
      className
        ? `react-aria-DatePicker ${className}`
        : "react-aria-DatePicker",
  );

  const effectiveLocale = projectedProps.calendarSystem
    ? `${projectedProps.locale || navigator.language}-u-ca-${
        projectedProps.calendarSystem
      }`
    : projectedProps.locale;
  const renderedErrorMessage =
    typeof errorMessage === "function"
      ? errorMessage
      : projectedProps.errorMessage;

  const component = (
    <AriaDatePicker
      {...props}
      className={datePickerClassName}
      style={(projectedProps.style as CSSProperties | undefined) ?? props.style}
      data-size={projectedSize}
      data-label-position={projectedLabelPosition}
      data-quiet={projectedProps.isQuiet ? "true" : undefined}
      granularity={effectiveGranularity}
      placeholderValue={placeholderValue}
      defaultValue={defaultValue}
      minValue={parsedMinValue as T | undefined}
      maxValue={parsedMaxValue as T | undefined}
      hideTimeZone={projectedProps.hideTimeZone}
      pageBehavior={projectedProps.pageBehavior}
      form={projectedProps.form}
      autoComplete={projectedProps.autoComplete}
      validationBehavior={projectedProps.validationBehavior}
      isDisabled={projectedProps.isDisabled}
      isReadOnly={projectedProps.isReadOnly}
      isRequired={projectedProps.isRequired}
      isInvalid={projectedProps.isInvalid}
      autoFocus={projectedProps.autoFocus}
    >
      {projectedProps.label && (
        <Label>
          {projectedProps.label}
          {renderNecessityIndicator(
            projectedProps.necessityIndicator,
            projectedProps.isRequired,
          )}
        </Label>
      )}
      <Group>
        {projectedProps.showCalendarIcon &&
          projectedProps.calendarIconPosition === "left" && (
            <Button slot="prefix">📅</Button>
          )}
        <DateInput>
          {(segment) => (
            <DateSegment
              segment={segment}
              data-placeholder={
                !segment.isPlaceholder ? undefined : projectedProps.placeholder
              }
            />
          )}
        </DateInput>
        {projectedProps.showCalendarIcon &&
          projectedProps.calendarIconPosition === "right" && (
            <Button>
              <CalendarIcon size={16} />
            </Button>
          )}
        {projectedProps.allowClear && props.value && (
          <Button
            onPress={() => props.onChange?.(null)}
            aria-label="Clear date"
          >
            ✕
          </Button>
        )}
      </Group>
      {projectedProps.description && (
        <Text slot="description">{projectedProps.description}</Text>
      )}
      <FieldError>{renderedErrorMessage}</FieldError>
      <Popover>
        <Dialog data-size={projectedSize}>
          <div className="date-picker-popup">
            <Calendar
              data-size={projectedSize}
              data-highlight-today={projectedProps.highlightToday}
              data-show-week-numbers={projectedProps.showWeekNumbers}
              visibleDuration={
                projectedMaxVisibleMonths > 1
                  ? { months: projectedMaxVisibleMonths }
                  : undefined
              }
              pageBehavior={projectedProps.pageBehavior}
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
                    length: projectedMaxVisibleMonths,
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

            {(projectedProps.includeTime || isTimeGranularity) && (
              <div className="date-picker-time-section">
                <div className="date-picker-time-field-wrapper">
                  <Label className="date-picker-time-field-label">
                    {projectedProps.timeLabel}
                  </Label>
                  <TimeField
                    granularity={
                      effectiveGranularity as "hour" | "minute" | "second"
                    }
                    hourCycle={projectedProps.timeFormat === "12h" ? 12 : 24}
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
