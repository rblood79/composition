/**
 * Number Utilities using @internationalized/number
 *
 * This module provides comprehensive number formatting utilities with:
 * - Locale-aware number formatting
 * - Currency formatting with proper symbols
 * - Percentage formatting
 * - Unit formatting (length, temperature, etc.)
 * - Compact notation (1K, 1M, 1B)
 * - Number parsing from localized strings
 */
import { NumberFormatter, NumberParser } from '@internationalized/number';
// ============================================================================
// Constants
// ============================================================================
/**
 * Common currency codes
 */
export const CURRENCIES = {
    KRW: 'KRW', // 대한민국 원
    USD: 'USD', // 미국 달러
    EUR: 'EUR', // 유로
    GBP: 'GBP', // 영국 파운드
    JPY: 'JPY', // 일본 엔
    CNY: 'CNY', // 중국 위안
    HKD: 'HKD', // 홍콩 달러
    TWD: 'TWD', // 대만 달러
    SGD: 'SGD', // 싱가포르 달러
    AUD: 'AUD', // 호주 달러
    CAD: 'CAD', // 캐나다 달러
    CHF: 'CHF', // 스위스 프랑
    SEK: 'SEK', // 스웨덴 크로나
    NZD: 'NZD', // 뉴질랜드 달러
};
/**
 * Common units
 */
export const UNITS = {
    // Length
    MILLIMETER: 'millimeter',
    CENTIMETER: 'centimeter',
    METER: 'meter',
    KILOMETER: 'kilometer',
    INCH: 'inch',
    FOOT: 'foot',
    YARD: 'yard',
    MILE: 'mile',
    // Weight
    GRAM: 'gram',
    KILOGRAM: 'kilogram',
    OUNCE: 'ounce',
    POUND: 'pound',
    // Temperature
    CELSIUS: 'celsius',
    FAHRENHEIT: 'fahrenheit',
    KELVIN: 'kelvin',
    // Volume
    LITER: 'liter',
    MILLILITER: 'milliliter',
    GALLON: 'gallon',
    // Speed
    KILOMETER_PER_HOUR: 'kilometer-per-hour',
    METER_PER_SECOND: 'meter-per-second',
    MILE_PER_HOUR: 'mile-per-hour',
    // Digital
    BIT: 'bit',
    BYTE: 'byte',
    KILOBYTE: 'kilobyte',
    MEGABYTE: 'megabyte',
    GIGABYTE: 'gigabyte',
    TERABYTE: 'terabyte',
    PETABYTE: 'petabyte',
    // Time
    SECOND: 'second',
    MINUTE: 'minute',
    HOUR: 'hour',
    DAY: 'day',
    WEEK: 'week',
    MONTH: 'month',
    YEAR: 'year',
};
/**
 * Default locales
 */
export const DEFAULT_LOCALE = 'ko-KR';
// ============================================================================
// Core Formatter Factory
// ============================================================================
/**
 * Create a NumberFormatter with options
 * @param locale - Locale identifier
 * @param options - Intl.NumberFormatOptions
 * @returns NumberFormatter instance
 */
export const createNumberFormatter = (locale = DEFAULT_LOCALE, options) => {
    return new NumberFormatter(locale, options);
};
// ============================================================================
// Basic Number Formatting
// ============================================================================
/**
 * Format number with locale-specific formatting
 * @param value - Number to format
 * @param locale - Locale identifier
 * @param options - Format options
 * @returns Formatted string
 * @example formatNumber(1234.56, 'ko-KR') // "1,234.56"
 */
export const formatNumber = (value, locale = DEFAULT_LOCALE, options) => {
    const formatter = new NumberFormatter(locale, options);
    return formatter.format(value);
};
/**
 * Format integer (no decimals)
 * @example formatInteger(1234.56) // "1,235"
 */
export const formatInteger = (value, locale = DEFAULT_LOCALE) => {
    return formatNumber(value, locale, {
        maximumFractionDigits: 0,
    });
};
/**
 * Format decimal with specific precision
 * @param value - Number to format
 * @param decimals - Number of decimal places
 * @param locale - Locale identifier
 * @example formatDecimal(1234.5678, 2) // "1,234.57"
 */
export const formatDecimal = (value, decimals, locale = DEFAULT_LOCALE) => {
    return formatNumber(value, locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};
// ============================================================================
// Currency Formatting
// ============================================================================
/**
 * Format as currency
 * @param value - Amount to format
 * @param currency - Currency code (ISO 4217)
 * @param locale - Locale identifier
 * @param display - How to display currency
 * @example formatCurrency(1234.56, 'KRW') // "₩1,235"
 * @example formatCurrency(1234.56, 'USD', 'en-US') // "$1,234.56"
 */
export const formatCurrency = (value, currency = CURRENCIES.KRW, locale = DEFAULT_LOCALE, display = 'symbol') => {
    return formatNumber(value, locale, {
        style: 'currency',
        currency,
        currencyDisplay: display,
    });
};
/**
 * Format as accounting currency (negative in parentheses)
 * @example formatAccountingCurrency(-1234.56, 'USD') // "($1,234.56)"
 */
export const formatAccountingCurrency = (value, currency = CURRENCIES.KRW, locale = DEFAULT_LOCALE) => {
    return formatNumber(value, locale, {
        style: 'currency',
        currency,
        currencySign: 'accounting',
    });
};
/**
 * Format currency with code instead of symbol
 * @example formatCurrencyCode(1234.56, 'USD') // "1,234.56 USD"
 */
export const formatCurrencyCode = (value, currency, locale = DEFAULT_LOCALE) => {
    return formatCurrency(value, currency, locale, 'code');
};
/**
 * Format currency with full name
 * @example formatCurrencyName(1234.56, 'USD', 'en-US') // "1,234.56 US dollars"
 */
export const formatCurrencyName = (value, currency, locale = DEFAULT_LOCALE) => {
    return formatCurrency(value, currency, locale, 'name');
};
// ============================================================================
// Percentage Formatting
// ============================================================================
/**
 * Format as percentage
 * @param value - Value to format (0.15 = 15%)
 * @param locale - Locale identifier
 * @param decimals - Number of decimal places
 * @example formatPercent(0.1567) // "15.67%"
 * @example formatPercent(0.1567, 'ko-KR', 0) // "16%"
 */
export const formatPercent = (value, locale = DEFAULT_LOCALE, decimals = 2) => {
    return formatNumber(value, locale, {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};
/**
 * Format percentage from 0-100 scale
 * @param value - Value from 0 to 100
 * @example formatPercentFrom100(15.67) // "15.67%"
 */
export const formatPercentFrom100 = (value, locale = DEFAULT_LOCALE, decimals = 2) => {
    return formatPercent(value / 100, locale, decimals);
};
// ============================================================================
// Unit Formatting
// ============================================================================
/**
 * Format with unit
 * @param value - Value to format
 * @param unit - Unit identifier
 * @param locale - Locale identifier
 * @param display - Unit display style
 * @example formatUnit(10, 'kilometer') // "10 km"
 * @example formatUnit(25, 'celsius') // "25°C"
 */
export const formatUnit = (value, unit, locale = DEFAULT_LOCALE, display = 'short') => {
    return formatNumber(value, locale, {
        style: 'unit',
        unit,
        unitDisplay: display,
    });
};
/**
 * Format file size (bytes to KB, MB, GB, etc.)
 * @param bytes - Size in bytes
 * @param locale - Locale identifier
 * @example formatFileSize(1024) // "1 KB"
 * @example formatFileSize(1536000) // "1.5 MB"
 */
export const formatFileSize = (bytes, locale = DEFAULT_LOCALE) => {
    const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte', 'petabyte'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }
    return formatUnit(value, units[unitIndex], locale);
};
// ============================================================================
// Compact Notation
// ============================================================================
/**
 * Format with compact notation
 * @param value - Value to format
 * @param locale - Locale identifier
 * @param display - 'short' for 1K, 'long' for 1 thousand
 * @example formatCompact(1234) // "1.2K"
 * @example formatCompact(1500000) // "1.5M"
 */
export const formatCompact = (value, locale = DEFAULT_LOCALE, display = 'short') => {
    return formatNumber(value, locale, {
        notation: 'compact',
        compactDisplay: display,
    });
};
/**
 * Format with compact notation (long form)
 * @example formatCompactLong(1234, 'en-US') // "1.2 thousand"
 */
export const formatCompactLong = (value, locale = DEFAULT_LOCALE) => {
    return formatCompact(value, locale, 'long');
};
// ============================================================================
// Scientific Notation
// ============================================================================
/**
 * Format in scientific notation
 * @example formatScientific(123456) // "1.23456E5"
 */
export const formatScientific = (value, locale = DEFAULT_LOCALE, significantDigits) => {
    const options = {
        notation: 'scientific',
    };
    if (significantDigits) {
        options.minimumSignificantDigits = significantDigits;
        options.maximumSignificantDigits = significantDigits;
    }
    return formatNumber(value, locale, options);
};
/**
 * Format in engineering notation
 * @example formatEngineering(123456) // "123.456E3"
 */
export const formatEngineering = (value, locale = DEFAULT_LOCALE) => {
    return formatNumber(value, locale, {
        notation: 'engineering',
    });
};
// ============================================================================
// Special Formatting
// ============================================================================
/**
 * Format with sign always visible
 * @example formatWithSign(42) // "+42"
 * @example formatWithSign(-42) // "-42"
 */
export const formatWithSign = (value, locale = DEFAULT_LOCALE) => {
    return formatNumber(value, locale, {
        signDisplay: 'always',
    });
};
/**
 * Format without grouping separators
 * @example formatNoGrouping(1234567) // "1234567"
 */
export const formatNoGrouping = (value, locale = DEFAULT_LOCALE) => {
    return formatNumber(value, locale, {
        useGrouping: false,
    });
};
/**
 * Format with minimum integer digits (zero padding)
 * @example formatPadded(42, 5) // "00042"
 */
export const formatPadded = (value, minimumDigits, locale = DEFAULT_LOCALE) => {
    return formatNumber(value, locale, {
        minimumIntegerDigits: minimumDigits,
    });
};
// ============================================================================
// Number Parsing
// ============================================================================
/**
 * Parse localized number string to number
 * @param value - Localized number string
 * @param locale - Locale identifier
 * @returns Parsed number or NaN
 * @example parseLocalizedNumber("1,234.56", "en-US") // 1234.56
 * @example parseLocalizedNumber("1.234,56", "de-DE") // 1234.56
 */
export const parseLocalizedNumber = (value, locale = DEFAULT_LOCALE) => {
    const parser = new NumberParser(locale);
    const parsed = parser.parse(value);
    return parsed ?? NaN;
};
/**
 * Safe number parsing with fallback
 */
export const safeParseNumber = (value, locale = DEFAULT_LOCALE, fallback = 0) => {
    if (typeof value === 'number')
        return value;
    if (!value)
        return fallback;
    const parsed = parseLocalizedNumber(value, locale);
    return isNaN(parsed) ? fallback : parsed;
};
// ============================================================================
// Validation
// ============================================================================
/**
 * Check if string is a valid number in locale
 */
export const isValidNumber = (value, locale = DEFAULT_LOCALE) => {
    const parsed = parseLocalizedNumber(value, locale);
    return !isNaN(parsed);
};
/**
 * Check if number is in valid range
 */
export const isInRange = (value, min, max) => {
    if (min !== undefined && value < min)
        return false;
    if (max !== undefined && value > max)
        return false;
    return true;
};
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Round to specific decimal places
 */
export const roundToDecimals = (value, decimals) => {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
};
/**
 * Get currency symbol for currency code
 */
export const getCurrencySymbol = (currency, locale = DEFAULT_LOCALE) => {
    const formatter = new NumberFormatter(locale, {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
    });
    // Format 0 and extract just the symbol
    const formatted = formatter.format(0);
    return formatted.replace(/[\d\s,.]/g, '').trim();
};
/**
 * Format range of numbers
 * @example formatRange(10, 20) // "10–20"
 */
export const formatRange = (start, end, locale = DEFAULT_LOCALE, options) => {
    const formatter = new NumberFormatter(locale, options);
    return `${formatter.format(start)}–${formatter.format(end)}`;
};
/**
 * Format approximate number
 * @example formatApproximate(1234) // "~1,234"
 */
export const formatApproximate = (value, locale = DEFAULT_LOCALE) => {
    return `~${formatNumber(value, locale)}`;
};
//# sourceMappingURL=numberUtils.js.map