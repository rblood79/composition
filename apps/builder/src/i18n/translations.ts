/**
 * Both locales, eagerly — for tests and tooling that compare languages or read every message
 * (vocabulary gates, label catalogs). App code must not import this module: it would put every
 * language in the initial bundle. The Builder loads the active locale through `./loadMessages`
 * (`localeSplit.static.test.ts`).
 */
import type { SupportedLocale, TranslationKeys } from "./types";
import enUS from "./messages/en-US";
import koKR from "./messages/ko-KR";
import type { LocaleStrings } from "./messages/shared";

/** The nested catalog per locale. */
export const translations: Record<SupportedLocale, TranslationKeys> = {
  "ko-KR": koKR.catalog,
  "en-US": enUS.catalog,
};

/** The flat dictionary per locale (what `useLocalizedStringFormatter` reads). */
export const localizedStrings: Record<SupportedLocale, LocaleStrings> = {
  "ko-KR": koKR.strings,
  "en-US": enUS.strings,
};
