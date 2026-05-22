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

import { ChevronLeft, ChevronRight } from "lucide-react";
import { safeParseDateString } from "../utils/core/dateUtils";
import type { ComponentSize } from "../types";
import { Skeleton } from "./Skeleton";

import "./styles/RangeCalendar.css";

export interface RangeCalendarProps<T extends DateValue> extends Omit<
  AriaRangeCalendarProps<T>,
  "minValue" | "maxValue"
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
  minValue,
  maxValue,
  isLoading,
  ...props
}: RangeCalendarProps<T>) {
  if (isLoading) {
    return (
      <Skeleton
        componentVariant="calendar"
        size={size}
        className={props.className as string}
        aria-label="Loading range calendar..."
      />
    );
  }

  // minValue/maxValue 문자열 자동 파싱
  const parsedMinValue =
    typeof minValue === "string" ? safeParseDateString(minValue) : minValue;

  const parsedMaxValue =
    typeof maxValue === "string" ? safeParseDateString(maxValue) : maxValue;

  const rangeCalendarClassName = composeRenderProps(
    props.className,
    (className) =>
      className
        ? `react-aria-RangeCalendar ${className}`
        : "react-aria-RangeCalendar",
  );

  const calendar = (
    <AriaRangeCalendar
      {...props}
      className={rangeCalendarClassName}
      data-variant={variant}
      data-size={size}
      minValue={parsedMinValue as T | undefined}
      maxValue={parsedMaxValue as T | undefined}
      visibleDuration={{ months: maxVisibleMonths }}
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
        {Array.from({ length: maxVisibleMonths }, (_, i) => (
          <CalendarGrid key={i} offset={{ months: i }}>
            {(date) => <CalendarCell date={date} />}
          </CalendarGrid>
        ))}
      </div>
      {errorMessage && <Text slot="errorMessage">{errorMessage}</Text>}
    </AriaRangeCalendar>
  );

  // locale + calendarSystem → BCP 47 Unicode extension (e.g. "ko-KR-u-ca-buddhist")
  const effectiveLocale = calendarSystem
    ? `${locale || navigator.language}-u-ca-${calendarSystem}`
    : locale;

  if (effectiveLocale) {
    return <I18nProvider locale={effectiveLocale}>{calendar}</I18nProvider>;
  }

  return calendar;
}
