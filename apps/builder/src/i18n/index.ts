/**
 * I18n Module
 *
 * Exports all internationalization functionality
 */

export { I18nProvider } from "./I18nProvider";
export { LanguageSwitcher } from "./LanguageSwitcher";
export {
  useI18n,
  useOptionalI18n,
  useSemanticLabel,
  localizeSemanticLabel,
} from "./useI18n";
export { semanticLabelKeys, translateKey } from "./labels";
// One chunk per locale — the eager two-locale tables (`./translations`) are for tests only.
export {
  SUPPORTED_LOCALES,
  getLocaleMessages,
  loadAllLocaleMessages,
  loadLocaleMessages,
} from "./loadMessages";
export type { LocaleMessages, LocaleStrings } from "./messages/shared";
export {
  localeConfigs,
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
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
