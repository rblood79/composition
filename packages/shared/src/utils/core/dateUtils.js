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
import { parseDate, parseDateTime, parseZonedDateTime, parseAbsoluteToLocal, toCalendarDate, toCalendarDateTime, getLocalTimeZone, today, now, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isSameDay, isToday, getDayOfWeek, } from "@internationalized/date";
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
};
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
};
// ============================================================================
// Date Parsers
// ============================================================================
/**
 * Parse date string to CalendarDate
 * @param dateString - Date string in ISO format (YYYY-MM-DD)
 * @returns CalendarDate object
 * @example parseSimpleDate('2024-05-15')
 */
export const parseSimpleDate = (dateString) => {
    return parseDate(dateString);
};
/**
 * Parse datetime string to CalendarDateTime
 * @param dateTimeString - DateTime string in ISO format (YYYY-MM-DDTHH:mm:ss)
 * @returns CalendarDateTime object
 * @example parseSimpleDateTime('2024-05-15T14:30:00')
 */
export const parseSimpleDateTime = (dateTimeString) => {
    return parseDateTime(dateTimeString);
};
/**
 * Parse zoned datetime string to ZonedDateTime
 * @param zonedString - Zoned datetime string
 * @param timezone - Timezone identifier
 * @returns ZonedDateTime object
 * @example parseZonedDate('2024-05-15T14:30:00', 'Asia/Seoul')
 */
export const parseZonedDate = (zonedString, timezone = getLocalTimeZone()) => {
    return parseZonedDateTime(`${zonedString}[${timezone}]`);
};
/**
 * Parse ISO 8601 absolute timestamp to local time
 * @param isoString - ISO 8601 timestamp
 * @param timezone - Target timezone
 * @returns ZonedDateTime in local timezone
 * @example parseAbsoluteDate('2024-05-15T14:30:00Z')
 */
export const parseAbsoluteDate = (isoString) => {
    return parseAbsoluteToLocal(isoString);
};
/**
 * Safe date parser with error handling
 * @param value - Date string or null
 * @returns CalendarDate or null
 */
export const safeParseDateString = (value) => {
    if (!value)
        return null;
    try {
        return parseDate(value);
    }
    catch (error) {
        console.error("Failed to parse date:", value, error);
        return null;
    }
};
// ============================================================================
// Current Date/Time
// ============================================================================
/**
 * Get current date in local timezone
 * @param timezone - Optional timezone (defaults to local)
 * @returns CalendarDate for today
 */
export const getCurrentDate = (timezone) => {
    return today(timezone || getLocalTimeZone());
};
/**
 * Get current datetime in local timezone
 * @param timezone - Optional timezone (defaults to local)
 * @returns ZonedDateTime for now
 */
export const getCurrentDateTime = (timezone) => {
    return now(timezone || getLocalTimeZone());
};
/**
 * Get local timezone identifier
 * @returns Timezone string (e.g., 'Asia/Seoul')
 */
export const getLocalTimezone = () => {
    return getLocalTimeZone();
};
// ============================================================================
// Date Comparisons
// ============================================================================
/**
 * Check if two dates are the same day
 */
export const areSameDay = (date1, date2) => {
    return isSameDay(date1, date2);
};
/**
 * Check if date is today
 */
export const isDateToday = (date, timezone) => {
    return isToday(date, timezone || getLocalTimeZone());
};
/**
 * Check if date1 is before date2
 */
export const isBefore = (date1, date2) => {
    return date1.compare(date2) < 0;
};
/**
 * Check if date1 is after date2
 */
export const isAfter = (date1, date2) => {
    return date1.compare(date2) > 0;
};
/**
 * Check if date is between start and end (inclusive)
 */
export const isBetween = (date, start, end) => {
    return date.compare(start) >= 0 && date.compare(end) <= 0;
};
// ============================================================================
// Date Arithmetic
// ============================================================================
/**
 * Add days to a date
 */
export const addDays = (date, days) => {
    return date.add({ days });
};
/**
 * Add months to a date
 */
export const addMonths = (date, months) => {
    return date.add({ months });
};
/**
 * Add years to a date
 */
export const addYears = (date, years) => {
    return date.add({ years });
};
/**
 * Subtract days from a date
 */
export const subtractDays = (date, days) => {
    return date.subtract({ days });
};
/**
 * Subtract months from a date
 */
export const subtractMonths = (date, months) => {
    return date.subtract({ months });
};
/**
 * Subtract years from a date
 */
export const subtractYears = (date, years) => {
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
export const getWeekRange = (date, locale = LOCALES.KOREAN) => {
    return {
        start: startOfWeek(date, locale),
        end: endOfWeek(date, locale),
    };
};
/**
 * Get start and end of month for a given date
 */
export const getMonthRange = (date) => {
    return {
        start: startOfMonth(date),
        end: endOfMonth(date),
    };
};
/**
 * Get start and end of year for a given date
 */
export const getYearRange = (date) => {
    return {
        start: startOfYear(date),
        end: endOfYear(date),
    };
};
/**
 * Get date range for "this week"
 */
export const getThisWeek = (timezone, locale) => {
    const today = getCurrentDate(timezone);
    return getWeekRange(today, locale);
};
/**
 * Get date range for "this month"
 */
export const getThisMonth = (timezone) => {
    const today = getCurrentDate(timezone);
    return getMonthRange(today);
};
/**
 * Get date range for "this year"
 */
export const getThisYear = (timezone) => {
    const today = getCurrentDate(timezone);
    return getYearRange(today);
};
// ============================================================================
// Date Utilities
// ============================================================================
/**
 * Get day of week (0 = Sunday, 6 = Saturday)
 */
export const getDayOfWeekNumber = (date, locale = LOCALES.KOREAN) => {
    return getDayOfWeek(date, locale);
};
/**
 * Convert CalendarDateTime to CalendarDate
 */
export const toDate = (dateTime) => {
    return toCalendarDate(dateTime);
};
/**
 * Convert CalendarDate to CalendarDateTime (with midnight time)
 */
export const toDateTime = (date) => {
    return toCalendarDateTime(date);
};
/**
 * Format date to ISO string (YYYY-MM-DD)
 */
export const formatToISO = (date) => {
    return date.toString();
};
/**
 * Get days between two dates
 */
export const getDaysBetween = (start, end) => {
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
export const isWeekend = (date, locale = LOCALES.KOREAN) => {
    const dayOfWeek = getDayOfWeek(date, locale);
    return dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday
};
/**
 * Check if date is a weekday (Monday-Friday)
 */
export const isWeekday = (date, locale = LOCALES.KOREAN) => {
    return !isWeekend(date, locale);
};
// ============================================================================
// Timezone Conversions
// ============================================================================
/**
 * Convert date to specific timezone
 */
export const convertToTimezone = (date) => {
    return date.toAbsoluteString()
        ? parseAbsoluteToLocal(date.toAbsoluteString())
        : date;
};
/**
 * Get timezone offset in minutes
 */
export const getTimezoneOffset = (date) => {
    return date.offset;
};
// ============================================================================
// Validation
// ============================================================================
/**
 * Check if date string is valid ISO format
 */
export const isValidDateString = (dateString) => {
    try {
        parseDate(dateString);
        return true;
    }
    catch {
        return false;
    }
};
/**
 * Check if date is in valid range
 */
export const isDateInRange = (date, minValue, maxValue) => {
    if (minValue && date.compare(minValue) < 0)
        return false;
    if (maxValue && date.compare(maxValue) > 0)
        return false;
    return true;
};
//# sourceMappingURL=dateUtils.js.map