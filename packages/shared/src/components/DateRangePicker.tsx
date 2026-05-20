import {
  Button,
  CalendarCell,
  CalendarGrid,
  DateInput,
  DateRangePicker as AriaDateRangePicker,
  DateRangePickerProps as AriaDateRangePickerProps,
  DateSegment,
  DateValue,
  Dialog,
  FieldError,
  Group,
  Heading,
  I18nProvider,
  Label,
  Popover,
  RangeCalendar,
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
  toDateRangePickerRacProps,
  type DateRangePickerCanonicalProps,
  type DateRangePickerRacProps,
} from "../catalog/outputs/toRacProps";

import "./styles/generated/DateRangePicker.css";

export interface DateRangePickerProps<T extends DateValue> extends Omit<
  AriaDateRangePickerProps<T>,
  "minValue" | "maxValue"
> {
  /** @default 'md' */
  size?: ComponentSize;
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  showCalendarIcon?: boolean;
  calendarIconPosition?: "left" | "right";
  placeholder?: string;
  showWeekNumbers?: boolean;
  highlightToday?: boolean;
  allowClear?: boolean;
  includeTime?: boolean;
  timeFormat?: "12h" | "24h";
  startTimeLabel?: string;
  endTimeLabel?: string;
  /** BCP 47 locale (e.g. "ko-KR", "en-US") */
  locale?: string;
  /** Unicode calendar identifier (e.g. "buddhist", "japanese") */
  calendarSystem?: string;
  /** @default getLocalTimeZone() */
  timezone?: string;
  /** @default false */
  defaultToday?: boolean;
  /** @example "2024-06-10" */
  defaultStartValue?: string;
  /** @example "2024-06-16" */
  defaultEndValue?: string;
  /** @example "2024-01-01" */
  minValue?: string | DateValue;
  /** @example "2024-12-31" */
  maxValue?: string | DateValue;
  necessityIndicator?: NecessityIndicator;
  labelPosition?: "top" | "side";
  hideTimeZone?: boolean;
  pageBehavior?: "visible" | "single";
  maxVisibleMonths?: number;
  startName?: string;
  endName?: string;
  form?: string;
  validationBehavior?: "native" | "aria";
  isQuiet?: boolean;
}

export function DateRangePicker<T extends DateValue>({
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
  startTimeLabel = "시작 시간",
  endTimeLabel = "종료 시간",
  granularity,
  locale,
  calendarSystem,
  timezone,
  defaultToday = false,
  defaultStartValue,
  defaultEndValue,
  minValue,
  maxValue,
  necessityIndicator,
  labelPosition = "top",
  isQuiet,
  hideTimeZone,
  pageBehavior,
  maxVisibleMonths,
  startName,
  endName,
  form,
  validationBehavior,
  ...props
}: DateRangePickerProps<T>) {
  const projectedProps = toDateRangePickerRacProps({
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
    startTimeLabel,
    endTimeLabel,
    granularity,
    locale,
    calendarSystem,
    timezone,
    defaultToday,
    defaultStartValue,
    defaultEndValue,
    minValue,
    maxValue,
    necessityIndicator,
    labelPosition,
    isQuiet,
    hideTimeZone,
    pageBehavior,
    maxVisibleMonths,
    startName,
    endName,
    form,
    validationBehavior,
  } as DateRangePickerCanonicalProps);
  const projectedSize = projectedProps.size as DateRangePickerRacProps["size"];
  const projectedLabelPosition =
    projectedProps.labelPosition as DateRangePickerRacProps["labelPosition"];
  const projectedMaxVisibleMonths = projectedProps.maxVisibleMonths;
  const effectiveTimezone = projectedProps.timezone || getLocalTimeZone();

  const effectiveGranularity = projectedProps.includeTime
    ? granularity || "minute"
    : projectedProps.granularity;

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
  const parsedDefaultStartValue =
    typeof projectedProps.defaultStartValue === "string"
      ? safeParseDateString(projectedProps.defaultStartValue)
      : undefined;
  const parsedDefaultEndValue =
    typeof projectedProps.defaultEndValue === "string"
      ? safeParseDateString(projectedProps.defaultEndValue)
      : undefined;
  const projectedDefaultValue =
    props.defaultValue ??
    (parsedDefaultStartValue && parsedDefaultEndValue
      ? {
          start: parsedDefaultStartValue as T,
          end: parsedDefaultEndValue as T,
        }
      : undefined);

  const todayOrNow = isTimeGranularity
    ? now(effectiveTimezone)
    : today(effectiveTimezone);
  const defaultValue =
    projectedProps.defaultToday && !props.value && !projectedDefaultValue
      ? {
          start: todayOrNow as T,
          end: todayOrNow as T,
        }
      : projectedDefaultValue;

  const dateRangePickerClassName = composeRenderProps(
    projectedProps.className ?? props.className,
    (className) =>
      className
        ? `react-aria-DateRangePicker ${className}`
        : "react-aria-DateRangePicker",
  );

  const picker = (
    <AriaDateRangePicker
      {...props}
      className={dateRangePickerClassName}
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
      startName={projectedProps.startName}
      endName={projectedProps.endName}
      form={projectedProps.form}
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
        <DateInput slot="start">
          {(segment) => (
            <DateSegment
              segment={segment}
              data-placeholder={
                !segment.isPlaceholder ? undefined : projectedProps.placeholder
              }
            />
          )}
        </DateInput>
        <span aria-hidden="true">–</span>
        <DateInput slot="end">
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
            aria-label="Clear date range"
          >
            ✕
          </Button>
        )}
      </Group>
      {projectedProps.description && (
        <Text slot="description">{projectedProps.description}</Text>
      )}
      <FieldError>
        {typeof errorMessage === "function"
          ? errorMessage
          : projectedProps.errorMessage}
      </FieldError>
      <Popover>
        <Dialog data-size={projectedSize}>
          <div className="date-picker-popup">
            <RangeCalendar
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
            </RangeCalendar>

            {(projectedProps.includeTime || isTimeGranularity) && (
              <div className="date-picker-time-section">
                <div className="date-picker-time-fields-container">
                  <div className="date-picker-time-field-wrapper">
                    <Label className="date-picker-time-field-label">
                      {projectedProps.startTimeLabel}
                    </Label>
                    <TimeField
                      granularity={
                        effectiveGranularity as "hour" | "minute" | "second"
                      }
                      hourCycle={projectedProps.timeFormat === "12h" ? 12 : 24}
                      className="react-aria-DateRangePicker-start-time"
                    >
                      <DateInput>
                        {(segment) => <DateSegment segment={segment} />}
                      </DateInput>
                    </TimeField>
                  </div>
                  <div className="date-picker-time-field-wrapper">
                    <Label className="date-picker-time-field-label">
                      {projectedProps.endTimeLabel}
                    </Label>
                    <TimeField
                      granularity={
                        effectiveGranularity as "hour" | "minute" | "second"
                      }
                      hourCycle={projectedProps.timeFormat === "12h" ? 12 : 24}
                      className="react-aria-DateRangePicker-end-time"
                    >
                      <DateInput>
                        {(segment) => <DateSegment segment={segment} />}
                      </DateInput>
                    </TimeField>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Dialog>
      </Popover>
    </AriaDateRangePicker>
  );

  // locale + calendarSystem → BCP 47 Unicode extension (e.g. "ko-KR-u-ca-buddhist")
  const effectiveLocale = projectedProps.calendarSystem
    ? `${projectedProps.locale || navigator.language}-u-ca-${
        projectedProps.calendarSystem
      }`
    : projectedProps.locale;

  if (effectiveLocale) {
    return <I18nProvider locale={effectiveLocale}>{picker}</I18nProvider>;
  }

  return picker;
}
