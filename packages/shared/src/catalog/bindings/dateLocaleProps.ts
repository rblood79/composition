import type { PropContract } from "../types";

/**
 * A date component's locale and calendar system (react-aria.adobe.com Calendar · DateField
 * "International calendars": the `I18nProvider` locale with the Unicode `-u-ca-` calendar
 * extension). Unset = the browser's locale (RAC's default — the Canvas root measures the same),
 * so a document shows each visitor's own format unless it names one.
 *
 * Locales: the languages React Aria ships translations for. Calendar systems: the identifiers
 * `@internationalized/date` `createCalendar` takes.
 */
const LOCALES: ReadonlyArray<readonly [string, string]> = [
  ["ar-AE", "Arabic (UAE)"],
  ["bg-BG", "Bulgarian"],
  ["cs-CZ", "Czech"],
  ["da-DK", "Danish"],
  ["de-DE", "German"],
  ["el-GR", "Greek"],
  ["en-GB", "English (UK)"],
  ["en-US", "English (US)"],
  ["es-ES", "Spanish"],
  ["et-EE", "Estonian"],
  ["fi-FI", "Finnish"],
  ["fr-FR", "French"],
  ["he-IL", "Hebrew"],
  ["hr-HR", "Croatian"],
  ["hu-HU", "Hungarian"],
  ["it-IT", "Italian"],
  ["ja-JP", "Japanese"],
  ["ko-KR", "Korean"],
  ["lt-LT", "Lithuanian"],
  ["lv-LV", "Latvian"],
  ["nb-NO", "Norwegian"],
  ["nl-NL", "Dutch"],
  ["pl-PL", "Polish"],
  ["pt-BR", "Portuguese (Brazil)"],
  ["pt-PT", "Portuguese (Portugal)"],
  ["ro-RO", "Romanian"],
  ["ru-RU", "Russian"],
  ["sk-SK", "Slovak"],
  ["sl-SI", "Slovenian"],
  ["sr-SP", "Serbian"],
  ["sv-SE", "Swedish"],
  ["th-TH", "Thai"],
  ["tr-TR", "Turkish"],
  ["uk-UA", "Ukrainian"],
  ["zh-CN", "Chinese (Simplified)"],
  ["zh-TW", "Chinese (Traditional)"],
];

const CALENDAR_SYSTEMS: ReadonlyArray<readonly [string, string]> = [
  ["gregory", "Gregorian"],
  ["buddhist", "Buddhist"],
  ["ethiopic", "Ethiopic"],
  ["ethioaa", "Ethiopic (Amete Alem)"],
  ["coptic", "Coptic"],
  ["hebrew", "Hebrew"],
  ["indian", "Indian"],
  ["islamic-civil", "Islamic (civil)"],
  ["islamic-tbla", "Islamic (tabular)"],
  ["islamic-umalqura", "Islamic (Umm al-Qura)"],
  ["japanese", "Japanese"],
  ["persian", "Persian"],
  ["roc", "Minguo (ROC)"],
];

/** The empty choice: the browser's locale / the locale's own calendar. */
const BROWSER = { value: "", label: "Browser default" };

export const DATE_LOCALE_PROP: PropContract = {
  kind: "enum",
  label: "Locale",
  section: "locale",
  options: [
    BROWSER,
    ...LOCALES.map(([value, label]) => ({
      value,
      label: `${label} (${value})`,
    })),
  ],
};

export const DATE_CALENDAR_SYSTEM_PROP: PropContract = {
  kind: "enum",
  label: "Calendar",
  section: "locale",
  options: [
    { value: "", label: "Locale default" },
    ...CALENDAR_SYSTEMS.map(([value, label]) => ({ value, label })),
  ],
};
