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
import { NumberFormatter } from '@internationalized/number';
export type NumberFormatStyle = 'decimal' | 'currency' | 'percent' | 'unit';
export type NumberNotation = 'standard' | 'scientific' | 'engineering' | 'compact';
export type CompactDisplay = 'short' | 'long';
export type CurrencyDisplay = 'symbol' | 'narrowSymbol' | 'code' | 'name';
export type CurrencySign = 'standard' | 'accounting';
export interface NumberFormatOptions {
    style?: NumberFormatStyle;
    currency?: string;
    currencyDisplay?: CurrencyDisplay;
    currencySign?: CurrencySign;
    unit?: string;
    unitDisplay?: 'short' | 'narrow' | 'long';
    notation?: NumberNotation;
    compactDisplay?: CompactDisplay;
    useGrouping?: boolean;
    minimumIntegerDigits?: number;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    minimumSignificantDigits?: number;
    maximumSignificantDigits?: number;
    signDisplay?: 'auto' | 'never' | 'always' | 'exceptZero';
}
/**
 * Common currency codes
 */
export declare const CURRENCIES: {
    readonly KRW: "KRW";
    readonly USD: "USD";
    readonly EUR: "EUR";
    readonly GBP: "GBP";
    readonly JPY: "JPY";
    readonly CNY: "CNY";
    readonly HKD: "HKD";
    readonly TWD: "TWD";
    readonly SGD: "SGD";
    readonly AUD: "AUD";
    readonly CAD: "CAD";
    readonly CHF: "CHF";
    readonly SEK: "SEK";
    readonly NZD: "NZD";
};
/**
 * Common units
 */
export declare const UNITS: {
    readonly MILLIMETER: "millimeter";
    readonly CENTIMETER: "centimeter";
    readonly METER: "meter";
    readonly KILOMETER: "kilometer";
    readonly INCH: "inch";
    readonly FOOT: "foot";
    readonly YARD: "yard";
    readonly MILE: "mile";
    readonly GRAM: "gram";
    readonly KILOGRAM: "kilogram";
    readonly OUNCE: "ounce";
    readonly POUND: "pound";
    readonly CELSIUS: "celsius";
    readonly FAHRENHEIT: "fahrenheit";
    readonly KELVIN: "kelvin";
    readonly LITER: "liter";
    readonly MILLILITER: "milliliter";
    readonly GALLON: "gallon";
    readonly KILOMETER_PER_HOUR: "kilometer-per-hour";
    readonly METER_PER_SECOND: "meter-per-second";
    readonly MILE_PER_HOUR: "mile-per-hour";
    readonly BIT: "bit";
    readonly BYTE: "byte";
    readonly KILOBYTE: "kilobyte";
    readonly MEGABYTE: "megabyte";
    readonly GIGABYTE: "gigabyte";
    readonly TERABYTE: "terabyte";
    readonly PETABYTE: "petabyte";
    readonly SECOND: "second";
    readonly MINUTE: "minute";
    readonly HOUR: "hour";
    readonly DAY: "day";
    readonly WEEK: "week";
    readonly MONTH: "month";
    readonly YEAR: "year";
};
/**
 * Default locales
 */
export declare const DEFAULT_LOCALE = "ko-KR";
/**
 * Create a NumberFormatter with options
 * @param locale - Locale identifier
 * @param options - Intl.NumberFormatOptions
 * @returns NumberFormatter instance
 */
export declare const createNumberFormatter: (locale?: string, options?: NumberFormatOptions) => NumberFormatter;
/**
 * Format number with locale-specific formatting
 * @param value - Number to format
 * @param locale - Locale identifier
 * @param options - Format options
 * @returns Formatted string
 * @example formatNumber(1234.56, 'ko-KR') // "1,234.56"
 */
export declare const formatNumber: (value: number, locale?: string, options?: NumberFormatOptions) => string;
/**
 * Format integer (no decimals)
 * @example formatInteger(1234.56) // "1,235"
 */
export declare const formatInteger: (value: number, locale?: string) => string;
/**
 * Format decimal with specific precision
 * @param value - Number to format
 * @param decimals - Number of decimal places
 * @param locale - Locale identifier
 * @example formatDecimal(1234.5678, 2) // "1,234.57"
 */
export declare const formatDecimal: (value: number, decimals: number, locale?: string) => string;
/**
 * Format as currency
 * @param value - Amount to format
 * @param currency - Currency code (ISO 4217)
 * @param locale - Locale identifier
 * @param display - How to display currency
 * @example formatCurrency(1234.56, 'KRW') // "₩1,235"
 * @example formatCurrency(1234.56, 'USD', 'en-US') // "$1,234.56"
 */
export declare const formatCurrency: (value: number, currency?: string, locale?: string, display?: CurrencyDisplay) => string;
/**
 * Format as accounting currency (negative in parentheses)
 * @example formatAccountingCurrency(-1234.56, 'USD') // "($1,234.56)"
 */
export declare const formatAccountingCurrency: (value: number, currency?: string, locale?: string) => string;
/**
 * Format currency with code instead of symbol
 * @example formatCurrencyCode(1234.56, 'USD') // "1,234.56 USD"
 */
export declare const formatCurrencyCode: (value: number, currency: string, locale?: string) => string;
/**
 * Format currency with full name
 * @example formatCurrencyName(1234.56, 'USD', 'en-US') // "1,234.56 US dollars"
 */
export declare const formatCurrencyName: (value: number, currency: string, locale?: string) => string;
/**
 * Format as percentage
 * @param value - Value to format (0.15 = 15%)
 * @param locale - Locale identifier
 * @param decimals - Number of decimal places
 * @example formatPercent(0.1567) // "15.67%"
 * @example formatPercent(0.1567, 'ko-KR', 0) // "16%"
 */
export declare const formatPercent: (value: number, locale?: string, decimals?: number) => string;
/**
 * Format percentage from 0-100 scale
 * @param value - Value from 0 to 100
 * @example formatPercentFrom100(15.67) // "15.67%"
 */
export declare const formatPercentFrom100: (value: number, locale?: string, decimals?: number) => string;
/**
 * Format with unit
 * @param value - Value to format
 * @param unit - Unit identifier
 * @param locale - Locale identifier
 * @param display - Unit display style
 * @example formatUnit(10, 'kilometer') // "10 km"
 * @example formatUnit(25, 'celsius') // "25°C"
 */
export declare const formatUnit: (value: number, unit: string, locale?: string, display?: "short" | "narrow" | "long") => string;
/**
 * Format file size (bytes to KB, MB, GB, etc.)
 * @param bytes - Size in bytes
 * @param locale - Locale identifier
 * @example formatFileSize(1024) // "1 KB"
 * @example formatFileSize(1536000) // "1.5 MB"
 */
export declare const formatFileSize: (bytes: number, locale?: string) => string;
/**
 * Format with compact notation
 * @param value - Value to format
 * @param locale - Locale identifier
 * @param display - 'short' for 1K, 'long' for 1 thousand
 * @example formatCompact(1234) // "1.2K"
 * @example formatCompact(1500000) // "1.5M"
 */
export declare const formatCompact: (value: number, locale?: string, display?: CompactDisplay) => string;
/**
 * Format with compact notation (long form)
 * @example formatCompactLong(1234, 'en-US') // "1.2 thousand"
 */
export declare const formatCompactLong: (value: number, locale?: string) => string;
/**
 * Format in scientific notation
 * @example formatScientific(123456) // "1.23456E5"
 */
export declare const formatScientific: (value: number, locale?: string, significantDigits?: number) => string;
/**
 * Format in engineering notation
 * @example formatEngineering(123456) // "123.456E3"
 */
export declare const formatEngineering: (value: number, locale?: string) => string;
/**
 * Format with sign always visible
 * @example formatWithSign(42) // "+42"
 * @example formatWithSign(-42) // "-42"
 */
export declare const formatWithSign: (value: number, locale?: string) => string;
/**
 * Format without grouping separators
 * @example formatNoGrouping(1234567) // "1234567"
 */
export declare const formatNoGrouping: (value: number, locale?: string) => string;
/**
 * Format with minimum integer digits (zero padding)
 * @example formatPadded(42, 5) // "00042"
 */
export declare const formatPadded: (value: number, minimumDigits: number, locale?: string) => string;
/**
 * Parse localized number string to number
 * @param value - Localized number string
 * @param locale - Locale identifier
 * @returns Parsed number or NaN
 * @example parseLocalizedNumber("1,234.56", "en-US") // 1234.56
 * @example parseLocalizedNumber("1.234,56", "de-DE") // 1234.56
 */
export declare const parseLocalizedNumber: (value: string, locale?: string) => number;
/**
 * Safe number parsing with fallback
 */
export declare const safeParseNumber: (value: string | number | null | undefined, locale?: string, fallback?: number) => number;
/**
 * Check if string is a valid number in locale
 */
export declare const isValidNumber: (value: string, locale?: string) => boolean;
/**
 * Check if number is in valid range
 */
export declare const isInRange: (value: number, min?: number, max?: number) => boolean;
/**
 * Round to specific decimal places
 */
export declare const roundToDecimals: (value: number, decimals: number) => number;
/**
 * Get currency symbol for currency code
 */
export declare const getCurrencySymbol: (currency: string, locale?: string) => string;
/**
 * Format range of numbers
 * @example formatRange(10, 20) // "10–20"
 */
export declare const formatRange: (start: number, end: number, locale?: string, options?: NumberFormatOptions) => string;
/**
 * Format approximate number
 * @example formatApproximate(1234) // "~1,234"
 */
export declare const formatApproximate: (value: number, locale?: string) => string;
//# sourceMappingURL=numberUtils.d.ts.map