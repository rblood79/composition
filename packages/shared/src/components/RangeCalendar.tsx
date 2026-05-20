import {
  Button,
  RangeCalendar as AriaRangeCalendar,
  CalendarCell,
  CalendarGrid,
  RangeCalendarProps as AriaRangeCalendarProps,
  DateValue,
  Heading,
  I18nProvider,
  Text,
  composeRenderProps,
} from "react-aria-components";
import type { CSSProperties } from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { safeParseDateString } from "../utils/core/dateUtils";
import type { ComponentSize } from "../types";
import { Skeleton } from "./Skeleton";
import {
  toRangeCalendarRacProps,
  type RangeCalendarCanonicalProps,
  type RangeCalendarRacProps,
} from "../catalog/outputs/toRacProps";

import "./styles/RangeCalendar.css";

export interface RangeCalendarProps<T extends DateValue> extends Omit<
  AriaRangeCalendarProps<T>,
  "minValue" | "maxValue" | "defaultFocusedValue"
> {
  /** @default 'default' */
  variant?: "default" | "accent";
  /** @default 'md' */
  size?: ComponentSize;
  errorMessage?: string;
  /** BCP 47 locale (e.g. "ko-KR", "en-US") */
  locale?: string;
  /** Unicode calendar identifier (e.g. "gregory", "buddhist", "japanese") */
  calendarSystem?: string;
  /** @default 1 */
  maxVisibleMonths?: number;
  /** @example "2024-06-10" */
  defaultStartValue?: string;
  /** @example "2024-06-16" */
  defaultEndValue?: string;
  /** @example "2024-06-01" */
  defaultFocusedValue?: string | DateValue;
  /** @example "2024-01-01" */
  minValue?: string | DateValue;
  /** @example "2024-12-31" */
  maxValue?: string | DateValue;
  /** @default false */
  isLoading?: boolean;
}

export function RangeCalendar<T extends DateValue>({
  variant = "default",
  size = "md",
  errorMessage,
  locale,
  calendarSystem,
  maxVisibleMonths = 1,
  defaultStartValue,
  defaultEndValue,
  defaultFocusedValue,
  minValue,
  maxValue,
  isLoading,
  ...props
}: RangeCalendarProps<T>) {
  const projectedProps = toRangeCalendarRacProps({
    ...props,
    variant,
    size,
    errorMessage,
    locale,
    calendarSystem,
    maxVisibleMonths,
    defaultStartValue,
    defaultEndValue,
    defaultFocusedValue,
    minValue,
    maxValue,
    isLoading,
  } as RangeCalendarCanonicalProps);

  const projectedSize = projectedProps.size as RangeCalendarRacProps["size"];
  const projectedMaxVisibleMonths = projectedProps.maxVisibleMonths;

  if (projectedProps.isLoading) {
    return (
      <Skeleton
        componentVariant="calendar"
        size={projectedSize}
        className={projectedProps.className}
        aria-label="Loading range calendar..."
      />
    );
  }

  // minValue/maxValue 문자열 자동 파싱
  const parsedMinValue =
    typeof minValue === "string" ? safeParseDateString(minValue) : minValue;

  const parsedMaxValue =
    typeof maxValue === "string" ? safeParseDateString(maxValue) : maxValue;

  const parsedDefaultStartValue = safeParseDateString(
    projectedProps.defaultStartValue,
  );
  const parsedDefaultEndValue = safeParseDateString(
    projectedProps.defaultEndValue,
  );
  const parsedDefaultFocusedValue =
    typeof projectedProps.defaultFocusedValue === "string"
      ? safeParseDateString(projectedProps.defaultFocusedValue)
      : defaultFocusedValue;
  const projectedDefaultValue =
    props.defaultValue ??
    (parsedDefaultStartValue && parsedDefaultEndValue
      ? {
          start: parsedDefaultStartValue as T,
          end: parsedDefaultEndValue as T,
        }
      : undefined);

  const rangeCalendarClassName = composeRenderProps(
    projectedProps.className,
    (className) =>
      className
        ? `react-aria-RangeCalendar ${className}`
        : "react-aria-RangeCalendar",
  );

  const calendar = (
    <AriaRangeCalendar
      {...props}
      className={rangeCalendarClassName}
      style={projectedProps.style as CSSProperties | undefined}
      data-variant={projectedProps.variant}
      data-size={projectedSize}
      data-max-visible-months={projectedMaxVisibleMonths}
      data-disabled={projectedProps.isDisabled ? "true" : undefined}
      data-invalid={projectedProps.isInvalid ? "true" : undefined}
      aria-label={projectedProps["aria-label"]}
      defaultValue={projectedDefaultValue}
      defaultFocusedValue={parsedDefaultFocusedValue as T | undefined}
      minValue={parsedMinValue as T | undefined}
      maxValue={parsedMaxValue as T | undefined}
      visibleDuration={{ months: projectedMaxVisibleMonths }}
      isDisabled={projectedProps.isDisabled}
      isReadOnly={projectedProps.isReadOnly}
      isInvalid={projectedProps.isInvalid}
      autoFocus={projectedProps.autoFocus}
      allowsNonContiguousRanges={projectedProps.allowsNonContiguousRanges}
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
      <div className="calendar-grids">
        {Array.from({ length: projectedMaxVisibleMonths }, (_, i) => (
          <CalendarGrid key={i} offset={{ months: i }}>
            {(date) => <CalendarCell date={date} />}
          </CalendarGrid>
        ))}
      </div>
      {projectedProps.errorMessage && (
        <Text slot="errorMessage">{projectedProps.errorMessage}</Text>
      )}
    </AriaRangeCalendar>
  );

  // locale + calendarSystem → BCP 47 Unicode extension (e.g. "ko-KR-u-ca-buddhist")
  const effectiveLocale = projectedProps.calendarSystem
    ? `${projectedProps.locale || navigator.language}-u-ca-${projectedProps.calendarSystem}`
    : projectedProps.locale;

  if (effectiveLocale) {
    return <I18nProvider locale={effectiveLocale}>{calendar}</I18nProvider>;
  }

  return calendar;
}
