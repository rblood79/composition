import {
  Button,
  Calendar as AriaCalendar,
  CalendarCell,
  CalendarGrid,
  CalendarProps as AriaCalendarProps,
  DateValue,
  Heading,
  I18nProvider,
  Text,
  composeRenderProps,
} from "react-aria-components";
import type { CSSProperties } from "react";
import { getLocalTimeZone, today } from "@internationalized/date";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { safeParseDateString } from "../utils/core/dateUtils";
import type { ComponentSize } from "../types";
import { Skeleton } from "./Skeleton";
import {
  toCalendarRacProps,
  type CalendarCanonicalProps,
  type CalendarRacProps,
} from "../catalog/outputs/toRacProps";

import "./styles/Calendar.css";

export interface CalendarProps<T extends DateValue> extends Omit<
  AriaCalendarProps<T>,
  "minValue" | "maxValue" | "defaultValue" | "defaultFocusedValue"
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
  /** @default false */
  defaultToday?: boolean;
  /** @example "2024-01-01" */
  minValue?: string | DateValue;
  /** @example "2024-12-31" */
  maxValue?: string | DateValue;
  /** @example "2024-06-15" */
  defaultValue?: string | T;
  /** @example "2024-06-15" */
  defaultFocusedValue?: string | DateValue;
  /** @default 'center' */
  selectionAlignment?: "start" | "center" | "end";
  /** @default 'visible' */
  pageBehavior?: "visible" | "single";
  /** @default 1 */
  maxVisibleMonths?: number;
  /** @default false */
  isLoading?: boolean;
}

export function Calendar<T extends DateValue>({
  variant = "default",
  size = "md",
  errorMessage,
  locale,
  calendarSystem,
  defaultToday: _defaultToday = false,
  minValue,
  maxValue,
  selectionAlignment = "center",
  pageBehavior,
  maxVisibleMonths = 1,
  isLoading,
  ...props
}: CalendarProps<T>) {
  const projectedProps = toCalendarRacProps({
    ...props,
    variant,
    size,
    errorMessage,
    locale,
    calendarSystem,
    defaultToday: _defaultToday,
    minValue,
    maxValue,
    defaultValue: props.defaultValue,
    defaultFocusedValue: props.defaultFocusedValue,
    selectionAlignment,
    pageBehavior,
    maxVisibleMonths,
    isLoading,
  } as CalendarCanonicalProps);

  const projectedSize = projectedProps.size as CalendarRacProps["size"];
  const projectedMaxVisibleMonths = projectedProps.maxVisibleMonths;

  if (projectedProps.isLoading) {
    return (
      <Skeleton
        componentVariant="calendar"
        size={projectedSize}
        className={projectedProps.className}
        aria-label="Loading calendar..."
      />
    );
  }
  // minValue/maxValue/defaultValue/defaultFocusedValue 문자열 자동 파싱
  const parsedMinValue =
    typeof minValue === "string" ? safeParseDateString(minValue) : minValue;

  const parsedMaxValue =
    typeof maxValue === "string" ? safeParseDateString(maxValue) : maxValue;

  const parsedDefaultValue =
    typeof projectedProps.defaultValue === "string"
      ? safeParseDateString(projectedProps.defaultValue)
      : props.defaultValue;

  const parsedDefaultFocusedValue =
    typeof projectedProps.defaultFocusedValue === "string"
      ? safeParseDateString(projectedProps.defaultFocusedValue)
      : props.defaultFocusedValue;

  const defaultValue =
    projectedProps.defaultToday && !props.value && !parsedDefaultValue
      ? (today(getLocalTimeZone()) as T)
      : (parsedDefaultValue as T | undefined);

  const calendarClassName = composeRenderProps(
    projectedProps.className,
    (className) =>
      className ? `react-aria-Calendar ${className}` : "react-aria-Calendar",
  );

  const calendar = (
    <AriaCalendar
      {...props}
      className={calendarClassName}
      style={projectedProps.style as CSSProperties | undefined}
      data-variant={projectedProps.variant}
      data-size={projectedSize}
      data-max-visible-months={projectedMaxVisibleMonths}
      data-disabled={projectedProps.isDisabled ? "true" : undefined}
      data-invalid={projectedProps.isInvalid ? "true" : undefined}
      aria-label={projectedProps["aria-label"]}
      defaultValue={defaultValue}
      defaultFocusedValue={parsedDefaultFocusedValue as T | undefined}
      minValue={parsedMinValue as T | undefined}
      maxValue={parsedMaxValue as T | undefined}
      selectionAlignment={projectedProps.selectionAlignment}
      pageBehavior={projectedProps.pageBehavior}
      visibleDuration={{ months: projectedMaxVisibleMonths }}
      isDisabled={projectedProps.isDisabled}
      isReadOnly={projectedProps.isReadOnly}
      isInvalid={projectedProps.isInvalid}
      autoFocus={projectedProps.autoFocus}
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
    </AriaCalendar>
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
