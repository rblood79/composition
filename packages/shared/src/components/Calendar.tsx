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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { safeParseDateString } from "../utils/core/dateUtils";
import type { ComponentSize } from "../types";
import { Skeleton } from "./Skeleton";

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
  /**
   * CalendarHeader 자식 element.props.style 의 layout 부분(display/flexDirection/gap/padding/
   * justifyContent)을 `<header>` 에 적용 — Style 패널 Layout 편집 ↔ Skia inline_icon_text 대칭
   * (2026-07-02 B2). header 구조/ARIA(D1)는 불변, 시각 style(D3)만 얹는다.
   */
  headerStyle?: React.CSSProperties;
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
  headerStyle,
  ...props
}: CalendarProps<T>) {
  if (isLoading) {
    return (
      <Skeleton
        componentVariant="calendar"
        size={size}
        className={props.className as string}
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
    typeof props.defaultValue === "string"
      ? safeParseDateString(props.defaultValue)
      : props.defaultValue;

  const parsedDefaultFocusedValue =
    typeof props.defaultFocusedValue === "string"
      ? safeParseDateString(props.defaultFocusedValue)
      : props.defaultFocusedValue;

  const calendarClassName = composeRenderProps(props.className, (className) =>
    className ? `react-aria-Calendar ${className}` : "react-aria-Calendar",
  );

  const calendar = (
    <AriaCalendar
      {...props}
      className={calendarClassName}
      data-variant={variant}
      data-size={size}
      defaultValue={parsedDefaultValue as T | undefined}
      defaultFocusedValue={parsedDefaultFocusedValue as T | undefined}
      minValue={parsedMinValue as T | undefined}
      maxValue={parsedMaxValue as T | undefined}
      selectionAlignment={selectionAlignment}
      pageBehavior={pageBehavior}
      visibleDuration={{ months: maxVisibleMonths }}
    >
      <header style={headerStyle}>
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
    </AriaCalendar>
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
