/**
 * I18n Provider Component
 *
 * Provides internationalization context to the application
 * Uses @react-aria/i18n for locale-aware components
 */

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  I18nProvider as AriaI18nProvider,
  useLocalizedStringFormatter,
} from "@react-aria/i18n";
import type { I18nContextValue, LocaleConfig, SupportedLocale } from "./types";
import { localizedStrings } from "./translations";
import { getLocaleConfig, getStoredLocale, setStoredLocale } from "./locales";
import { formatNumber, formatCurrency } from "@composition/shared/utils";

/**
 * I18n Context
 */
// eslint-disable-next-line react-refresh/only-export-components
export const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * I18n Provider Props
 */
export interface I18nProviderProps {
  children: React.ReactNode;
  /** Initial locale (optional, defaults to stored or English locale) */
  initialLocale?: SupportedLocale;
}

/**
 * I18n Provider Component
 *
 * Wraps the app with both React Aria I18nProvider and custom I18n context
 */
export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<SupportedLocale>(
    initialLocale || getStoredLocale(),
  );

  const config = useMemo(() => getLocaleConfig(locale), [locale]);

  /**
   * Set locale and persist to localStorage
   */
  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    setStoredLocale(newLocale);

    // Update document dir attribute for RTL support
    document.documentElement.dir = getLocaleConfig(newLocale).direction;

    // Update document lang attribute
    document.documentElement.lang = newLocale;
  }, []);

  return (
    <AriaI18nProvider locale={locale}>
      <I18nRuntime locale={locale} config={config} setLocale={setLocale}>
        {children}
      </I18nRuntime>
    </AriaI18nProvider>
  );
}

interface I18nRuntimeProps {
  children: React.ReactNode;
  locale: SupportedLocale;
  config: LocaleConfig;
  setLocale: (locale: SupportedLocale) => void;
}

function I18nRuntime({
  children,
  locale,
  config,
  setLocale,
}: I18nRuntimeProps): React.ReactElement {
  const stringFormatter = useLocalizedStringFormatter(localizedStrings);

  /** Translate function backed by React Aria's localized string formatter. */
  const t = useCallback(
    (
      key: string,
      params?: Record<string, string | number | boolean>,
    ): string => {
      try {
        return stringFormatter.format(key, params);
      } catch {
        return key;
      }
    },
    [stringFormatter],
  );

  /**
   * Format date using @internationalized/date
   */
  const formatDate = useCallback(
    (date: Date): string => {
      const formatter = new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      return formatter.format(date);
    },
    [locale],
  );

  /**
   * Format time using @internationalized/date
   */
  const formatTime = useCallback(
    (date: Date): string => {
      const formatter = new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "numeric",
        hour12: config.timeFormat === 12,
      });
      return formatter.format(date);
    },
    [locale, config.timeFormat],
  );

  /**
   * Format number using @internationalized/number
   */
  const formatNumberFn = useCallback(
    (value: number): string => {
      return formatNumber(value, locale);
    },
    [locale],
  );

  /**
   * Format currency using @internationalized/number
   */
  const formatCurrencyFn = useCallback(
    (value: number): string => {
      return formatCurrency(value, config.currency, locale);
    },
    [locale, config.currency],
  );

  /**
   * Context value
   */
  const contextValue = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      direction: config.direction,
      config,
      formatDate,
      formatTime,
      formatNumber: formatNumberFn,
      formatCurrency: formatCurrencyFn,
    }),
    [
      locale,
      setLocale,
      t,
      config,
      formatDate,
      formatTime,
      formatNumberFn,
      formatCurrencyFn,
    ],
  );

  /**
   * Set initial dir and lang attributes
   */
  useEffect(() => {
    document.documentElement.dir = config.direction;
    document.documentElement.lang = locale;
  }, [config.direction, locale]);

  return (
    <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
  );
}
