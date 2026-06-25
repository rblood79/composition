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
import { CalendarDate, CalendarDateTime, ZonedDateTime, type DateValue } from "@internationalized/date";
export type { CalendarDate, CalendarDateTime, ZonedDateTime, DateValue };
/**
 * Common timezone identifiers
 */
export declare const TIMEZONES: {
    readonly SEOUL: "Asia/Seoul";
    readonly NEW_YORK: "America/New_York";
    readonly LOS_ANGELES: "America/Los_Angeles";
    readonly LONDON: "Europe/London";
    readonly PARIS: "Europe/Paris";
    readonly TOKYO: "Asia/Tokyo";
    readonly SHANGHAI: "Asia/Shanghai";
    readonly HONG_KONG: "Asia/Hong_Kong";
    readonly SYDNEY: "Australia/Sydney";
    readonly UTC: "UTC";
};
/**
 * Common locales
 */
export declare const LOCALES: {
    readonly KOREAN: "ko-KR";
    readonly ENGLISH_US: "en-US";
    readonly ENGLISH_GB: "en-GB";
    readonly JAPANESE: "ja-JP";
    readonly CHINESE_SIMPLIFIED: "zh-CN";
    readonly CHINESE_TRADITIONAL: "zh-TW";
};
/**
 * Parse date string to CalendarDate
 * @param dateString - Date string in ISO format (YYYY-MM-DD)
 * @returns CalendarDate object
 * @example parseSimpleDate('2024-05-15')
 */
export declare const parseSimpleDate: (dateString: string) => CalendarDate;
/**
 * Parse datetime string to CalendarDateTime
 * @param dateTimeString - DateTime string in ISO format (YYYY-MM-DDTHH:mm:ss)
 * @returns CalendarDateTime object
 * @example parseSimpleDateTime('2024-05-15T14:30:00')
 */
export declare const parseSimpleDateTime: (dateTimeString: string) => CalendarDateTime;
/**
 * Parse zoned datetime string to ZonedDateTime
 * @param zonedString - Zoned datetime string
 * @param timezone - Timezone identifier
 * @returns ZonedDateTime object
 * @example parseZonedDate('2024-05-15T14:30:00', 'Asia/Seoul')
 */
export declare const parseZonedDate: (zonedString: string, timezone?: string) => ZonedDateTime;
/**
 * Parse ISO 8601 absolute timestamp to local time
 * @param isoString - ISO 8601 timestamp
 * @param timezone - Target timezone
 * @returns ZonedDateTime in local timezone
 * @example parseAbsoluteDate('2024-05-15T14:30:00Z')
 */
export declare const parseAbsoluteDate: (isoString: string) => ZonedDateTime;
/**
 * Safe date parser with error handling
 * @param value - Date string or null
 * @returns CalendarDate or null
 */
export declare const safeParseDateString: (value: string | null | undefined) => CalendarDate | null;
/**
 * Get current date in local timezone
 * @param timezone - Optional timezone (defaults to local)
 * @returns CalendarDate for today
 */
export declare const getCurrentDate: (timezone?: string) => CalendarDate;
/**
 * Get current datetime in local timezone
 * @param timezone - Optional timezone (defaults to local)
 * @returns ZonedDateTime for now
 */
export declare const getCurrentDateTime: (timezone?: string) => ZonedDateTime;
/**
 * Get local timezone identifier
 * @returns Timezone string (e.g., 'Asia/Seoul')
 */
export declare const getLocalTimezone: () => string;
/**
 * Check if two dates are the same day
 */
export declare const areSameDay: (date1: DateValue, date2: DateValue) => boolean;
/**
 * Check if date is today
 */
export declare const isDateToday: (date: DateValue, timezone?: string) => boolean;
/**
 * Check if date1 is before date2
 */
export declare const isBefore: (date1: DateValue, date2: DateValue) => boolean;
/**
 * Check if date1 is after date2
 */
export declare const isAfter: (date1: DateValue, date2: DateValue) => boolean;
/**
 * Check if date is between start and end (inclusive)
 */
export declare const isBetween: (date: DateValue, start: DateValue, end: DateValue) => boolean;
/**
 * Add days to a date
 */
export declare const addDays: (date: CalendarDate, days: number) => CalendarDate;
/**
 * Add months to a date
 */
export declare const addMonths: (date: CalendarDate, months: number) => CalendarDate;
/**
 * Add years to a date
 */
export declare const addYears: (date: CalendarDate, years: number) => CalendarDate;
/**
 * Subtract days from a date
 */
export declare const subtractDays: (date: CalendarDate, days: number) => CalendarDate;
/**
 * Subtract months from a date
 */
export declare const subtractMonths: (date: CalendarDate, months: number) => CalendarDate;
/**
 * Subtract years from a date
 */
export declare const subtractYears: (date: CalendarDate, years: number) => CalendarDate;
/**
 * Get start and end of week for a given date
 * @param date - Date to get week for
 * @param locale - Locale for determining first day of week
 * @returns Object with start and end dates
 */
export declare const getWeekRange: (date: CalendarDate, locale?: string) => {
    start: CalendarDate;
    end: CalendarDate;
};
/**
 * Get start and end of month for a given date
 */
export declare const getMonthRange: (date: CalendarDate) => {
    start: CalendarDate;
    end: CalendarDate;
};
/**
 * Get start and end of year for a given date
 */
export declare const getYearRange: (date: CalendarDate) => {
    start: CalendarDate;
    end: CalendarDate;
};
/**
 * Get date range for "this week"
 */
export declare const getThisWeek: (timezone?: string, locale?: string) => {
    start: CalendarDate;
    end: CalendarDate;
};
/**
 * Get date range for "this month"
 */
export declare const getThisMonth: (timezone?: string) => {
    start: CalendarDate;
    end: CalendarDate;
};
/**
 * Get date range for "this year"
 */
export declare const getThisYear: (timezone?: string) => {
    start: CalendarDate;
    end: CalendarDate;
};
/**
 * Get day of week (0 = Sunday, 6 = Saturday)
 */
export declare const getDayOfWeekNumber: (date: DateValue, locale?: string) => number;
/**
 * Convert CalendarDateTime to CalendarDate
 */
export declare const toDate: (dateTime: CalendarDateTime | ZonedDateTime) => CalendarDate;
/**
 * Convert CalendarDate to CalendarDateTime (with midnight time)
 */
export declare const toDateTime: (date: CalendarDate) => CalendarDateTime;
/**
 * Format date to ISO string (YYYY-MM-DD)
 */
export declare const formatToISO: (date: DateValue) => string;
/**
 * Get days between two dates
 */
export declare const getDaysBetween: (start: CalendarDate, end: CalendarDate) => number;
/**
 * Check if date is a weekend (Saturday or Sunday)
 */
export declare const isWeekend: (date: DateValue, locale?: string) => boolean;
/**
 * Check if date is a weekday (Monday-Friday)
 */
export declare const isWeekday: (date: DateValue, locale?: string) => boolean;
/**
 * Convert date to specific timezone
 */
export declare const convertToTimezone: (date: ZonedDateTime) => ZonedDateTime;
/**
 * Get timezone offset in minutes
 */
export declare const getTimezoneOffset: (date: ZonedDateTime) => number;
/**
 * Check if date string is valid ISO format
 */
export declare const isValidDateString: (dateString: string) => boolean;
/**
 * Check if date is in valid range
 */
export declare const isDateInRange: (date: DateValue, minValue?: DateValue | null, maxValue?: DateValue | null) => boolean;
//# sourceMappingURL=dateUtils.d.ts.map