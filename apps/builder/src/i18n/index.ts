/**
 * I18n Module
 *
 * Exports all internationalization functionality
 */

export { I18nProvider } from "./I18nProvider";
export { LanguageSwitcher } from "./LanguageSwitcher";
export { useI18n, useOptionalI18n } from "./useI18n";
export { semanticLabelKeys, translateKey } from "./labels";
export { translations, localizedStrings } from "./translations";
export {
  localeConfigs,
  DEFAULT_LOCALE,
  getLocaleConfig,
  getBrowserLocale,
  getStoredLocale,
  setStoredLocale,
} from "./locales";
export type {
  SupportedLocale,
  Direction,
  LocaleConfig,
  TranslationKeys,
  I18nContextValue,
} from "./types";
