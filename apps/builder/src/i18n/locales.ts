/**
 * Locale Configurations
 *
 * Defines configuration for each supported locale
 */

import type { LocaleConfig, SupportedLocale } from "./types";

/**
 * All locale configurations
 */
export const localeConfigs: Record<SupportedLocale, LocaleConfig> = {
  "en-US": {
    locale: "en-US",
    name: "English",
    direction: "ltr",
    dateFormat: "MM/DD/YYYY",
    timeFormat: 12,
    currency: "USD",
  },
  "ko-KR": {
    locale: "ko-KR",
    name: "한국어",
    direction: "ltr",
    dateFormat: "YYYY년 MM월 DD일",
    timeFormat: 24,
    currency: "KRW",
  },
};

/**
 * Default locale
 */
export const DEFAULT_LOCALE: SupportedLocale = "en-US";

/**
 * Get locale configuration
 */
export function getLocaleConfig(locale: SupportedLocale): LocaleConfig {
  return localeConfigs[locale] || localeConfigs[DEFAULT_LOCALE];
}

/**
 * Get browser locale if supported, otherwise return default
 */
export function getBrowserLocale(): SupportedLocale {
  const browserLocale = navigator.language;

  // Check exact match
  if (browserLocale in localeConfigs) {
    return browserLocale as SupportedLocale;
  }

  // Check language prefix (e.g., 'ko' from 'ko-KR')
  const languagePrefix = browserLocale.split("-")[0];
  const matchingLocale = Object.keys(localeConfigs).find((locale) =>
    locale.startsWith(languagePrefix),
  );

  return (matchingLocale as SupportedLocale) || DEFAULT_LOCALE;
}

/**
 * Get locale from localStorage or the English default
 */
export function getStoredLocale(): SupportedLocale {
  try {
    const stored = localStorage.getItem("composition-locale");
    if (stored && stored in localeConfigs) {
      return stored as SupportedLocale;
    }
  } catch (error) {
    console.error("Error reading locale from localStorage:", error);
  }

  return DEFAULT_LOCALE;
}

/**
 * Save locale to localStorage
 */
export function setStoredLocale(locale: SupportedLocale): void {
  try {
    localStorage.setItem("composition-locale", locale);
  } catch (error) {
    console.error("Error saving locale to localStorage:", error);
  }
}
