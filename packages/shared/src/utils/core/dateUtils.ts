/**
 * Date Utilities using @internationalized/date
 *
 * This module provides comprehensive date/time utilities with:
 * - Timezone support
 * - Locale-aware formatting
 * - Date parsing and validation
 * - Date arithmetic and comparisons
 * - Calendar operations
 */

import {
  parseDate,
  parseDateTime,
  parseZonedDateTime,
  parseAbsoluteToLocal,
  CalendarDate,
  CalendarDateTime,
  ZonedDateTime,
  toCalendarDate,
  toCalendarDateTime,
  getLocalTimeZone,
  today,
  now,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isSameDay,
  isToday,
  getDayOfWeek,
  type DateValue,
} from "@internationalized/date";
export { safeParseDateString } from "../../state/dateValue";

// ============================================================================
// Type Exports
// ============================================================================

export type { CalendarDate, CalendarDateTime, ZonedDateTime, DateValue };

// ============================================================================
// Constants
// ============================================================================

/**
 * Common timezone identifiers
 */
export const TIMEZONES = {
  SEOUL: "Asia/Seoul",
  NEW_YORK: "America/New_York",
  LOS_ANGELES: "America/Los_Angeles",
  LONDON: "Europe/London",
  PARIS: "Europe/Paris",
  TOKYO: "Asia/Tokyo",
  SHANGHAI: "Asia/Shanghai",
  HONG_KONG: "Asia/Hong_Kong",
  SYDNEY: "Australia/Sydney",
  UTC: "UTC",
} as const;

/**
 * Common locales
 */
export const LOCALES = {
  KOREAN: "ko-KR",
  ENGLISH_US: "en-US",
  ENGLISH_GB: "en-GB",
  JAPANESE: "ja-JP",
  CHINESE_SIMPLIFIED: "zh-CN",
  CHINESE_TRADITIONAL: "zh-TW",
} as const;

// ============================================================================
// Date Parsers
// ============================================================================

/**
 * Parse date string to CalendarDate
 * @param dateString - Date string in ISO format (YYYY-MM-DD)
 * @returns CalendarDate object
 * @example parseSimpleDate('2024-05-15')
 */
export const parseSimpleDate = (dateString: string): CalendarDate => {
  return parseDate(dateString);
};

/**
 * Parse datetime string to CalendarDateTime
 * @param dateTimeString - DateTime string in ISO format (YYYY-MM-DDTHH:mm:ss)
 * @returns CalendarDateTime object
 * @example parseSimpleDateTime('2024-05-15T14:30:00')
 */
export const parseSimpleDateTime = (
  dateTimeString: string,
): CalendarDateTime => {
  return parseDateTime(dateTimeString);
};

/**
 * Parse zoned datetime string to ZonedDateTime
 * @param zonedString - Zoned datetime string
 * @param timezone - Timezone identifier
 * @returns ZonedDateTime object
 * @example parseZonedDate('2024-05-15T14:30:00', 'Asia/Seoul')
 */
export const parseZonedDate = (
  zonedString: string,
  timezone: string = getLocalTimeZone(),
): ZonedDateTime => {
  return parseZonedDateTime(`${zonedString}[${timezone}]`);
};

/**
 * Parse ISO 8601 absolute timestamp to local time
 * @param isoString - ISO 8601 timestamp
 * @param timezone - Target timezone
 * @returns ZonedDateTime in local timezone
 * @example parseAbsoluteDate('2024-05-15T14:30:00Z')
 */
export const parseAbsoluteDate = (isoString: string): ZonedDateTime => {
  return parseAbsoluteToLocal(isoString);
};

// ============================================================================
// Current Date/Time
// ============================================================================

/**
 * Get current date in local timezone
 * @param timezone - Optional timezone (defaults to local)
 * @returns CalendarDate for today
 */
export const getCurrentDate = (timezone?: string): CalendarDate => {
  return today(timezone || getLocalTimeZone());
};

/**
 * Get current datetime in local timezone
 * @param timezone - Optional timezone (defaults to local)
 * @returns ZonedDateTime for now
 */
export const getCurrentDateTime = (timezone?: string): ZonedDateTime => {
  return now(timezone || getLocalTimeZone());
};

/**
 * Get local timezone identifier
 * @returns Timezone string (e.g., 'Asia/Seoul')
 */
export const getLocalTimezone = (): string => {
  return getLocalTimeZone();
};

// ============================================================================
// Date Comparisons
// ============================================================================

/**
 * Check if two dates are the same day
 */
export const areSameDay = (date1: DateValue, date2: DateValue): boolean => {
  return isSameDay(date1, date2);
};

/**
 * Check if date is today
 */
export const isDateToday = (date: DateValue, timezone?: string): boolean => {
  return isToday(date, timezone || getLocalTimeZone());
};

/**
 * Check if date1 is before date2
 */
export const isBefore = (date1: DateValue, date2: DateValue): boolean => {
  return date1.compare(date2) < 0;
};

/**
 * Check if date1 is after date2
 */
export const isAfter = (date1: DateValue, date2: DateValue): boolean => {
  return date1.compare(date2) > 0;
};

/**
 * Check if date is between start and end (inclusive)
 */
export const isBetween = (
  date: DateValue,
  start: DateValue,
  end: DateValue,
): boolean => {
  return date.compare(start) >= 0 && date.compare(end) <= 0;
};

// ============================================================================
// Date Arithmetic
// ============================================================================

/**
 * Add days to a date
 */
export const addDays = (date: CalendarDate, days: number): CalendarDate => {
  return date.add({ days });
};

/**
 * Add months to a date
 */
export const addMonths = (date: CalendarDate, months: number): CalendarDate => {
  return date.add({ months });
};

/**
 * Add years to a date
 */
export const addYears = (date: CalendarDate, years: number): CalendarDate => {
  return date.add({ years });
};

/**
 * Subtract days from a date
 */
export const subtractDays = (
  date: CalendarDate,
  days: number,
): CalendarDate => {
  return date.subtract({ days });
};

/**
 * Subtract months from a date
 */
export const subtractMonths = (
  date: CalendarDate,
  months: number,
): CalendarDate => {
  return date.subtract({ months });
};

/**
 * Subtract years from a date
 */
export const subtractYears = (
  date: CalendarDate,
  years: number,
): CalendarDate => {
  return date.subtract({ years });
};

// ============================================================================
// Date Ranges
// ============================================================================

/**
 * Get start and end of week for a given date
 * @param date - Date to get week for
 * @param locale - Locale for determining first day of week
 * @returns Object with start and end dates
 */
export const getWeekRange = (
  date: CalendarDate,
  locale: string = LOCALES.KOREAN,
): { start: CalendarDate; end: CalendarDate } => {
  return {
    start: startOfWeek(date, locale),
    end: endOfWeek(date, locale),
  };
};

/**
 * Get start and end of month for a given date
 */
export const getMonthRange = (
  date: CalendarDate,
): { start: CalendarDate; end: CalendarDate } => {
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
};

/**
 * Get start and end of year for a given date
 */
export const getYearRange = (
  date: CalendarDate,
): { start: CalendarDate; end: CalendarDate } => {
  return {
    start: startOfYear(date),
    end: endOfYear(date),
  };
};

/**
 * Get date range for "this week"
 */
export const getThisWeek = (
  timezone?: string,
  locale?: string,
): { start: CalendarDate; end: CalendarDate } => {
  const today = getCurrentDate(timezone);
  return getWeekRange(today, locale);
};

/**
 * Get date range for "this month"
 */
export const getThisMonth = (
  timezone?: string,
): { start: CalendarDate; end: CalendarDate } => {
  const today = getCurrentDate(timezone);
  return getMonthRange(today);
};

/**
 * Get date range for "this year"
 */
export const getThisYear = (
  timezone?: string,
): { start: CalendarDate; end: CalendarDate } => {
  const today = getCurrentDate(timezone);
  return getYearRange(today);
};

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Get day of week (0 = Sunday, 6 = Saturday)
 */
export const getDayOfWeekNumber = (
  date: DateValue,
  locale: string = LOCALES.KOREAN,
): number => {
  return getDayOfWeek(date, locale);
};

/**
 * Convert CalendarDateTime to CalendarDate
 */
export const toDate = (
  dateTime: CalendarDateTime | ZonedDateTime,
): CalendarDate => {
  return toCalendarDate(dateTime);
};

/**
 * Convert CalendarDate to CalendarDateTime (with midnight time)
 */
export const toDateTime = (date: CalendarDate): CalendarDateTime => {
  return toCalendarDateTime(date);
};

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
export const formatToISO = (date: DateValue): string => {
  return date.toString();
};

/**
 * Get days between two dates
 */
export const getDaysBetween = (
  start: CalendarDate,
  end: CalendarDate,
): number => {
  let current = start;
  let days = 0;

  while (current.compare(end) < 0) {
    days++;
    current = current.add({ days: 1 });
  }

  return days;
};

/**
 * Check if date is a weekend (Saturday or Sunday)
 */
export const isWeekend = (
  date: DateValue,
  locale: string = LOCALES.KOREAN,
): boolean => {
  const dayOfWeek = getDayOfWeek(date, locale);
  return dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday
};

/**
 * Check if date is a weekday (Monday-Friday)
 */
export const isWeekday = (
  date: DateValue,
  locale: string = LOCALES.KOREAN,
): boolean => {
  return !isWeekend(date, locale);
};

// ============================================================================
// Timezone Conversions
// ============================================================================

/**
 * Convert date to specific timezone
 */
export const convertToTimezone = (date: ZonedDateTime): ZonedDateTime => {
  return date.toAbsoluteString()
    ? parseAbsoluteToLocal(date.toAbsoluteString())
    : date;
};

/**
 * Get timezone offset in minutes
 */
export const getTimezoneOffset = (date: ZonedDateTime): number => {
  return date.offset;
};

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if date string is valid ISO format
 */
export const isValidDateString = (dateString: string): boolean => {
  try {
    parseDate(dateString);
    return true;
  } catch {
    return false;
  }
};

/**
 * Check if date is in valid range
 */
export const isDateInRange = (
  date: DateValue,
  minValue?: DateValue | null,
  maxValue?: DateValue | null,
): boolean => {
  if (minValue && date.compare(minValue) < 0) return false;
  if (maxValue && date.compare(maxValue) > 0) return false;
  return true;
};
