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

/**
 * S2 `firstDayOfWeek` (Calendar · RangeCalendar · DatePicker · DateRangePicker — 1.8.0): the week's
 * first column. Unset = the locale's own first day (RAC `useCalendarGrid`); a picker hands its
 * value to its calendar through RAC's calendar context.
 */
export const FIRST_DAY_OF_WEEK_PROP: PropContract = {
  kind: "enum",
  label: "First Day of Week",
  section: "locale",
  options: [
    { value: "", label: "Locale default" },
    { value: "sun", label: "Sunday" },
    { value: "mon", label: "Monday" },
    { value: "tue", label: "Tuesday" },
    { value: "wed", label: "Wednesday" },
    { value: "thu", label: "Thursday" },
    { value: "fri", label: "Friday" },
    { value: "sat", label: "Saturday" },
  ],
};

/**
 * ADR-256 Phase 9 — RAC `visibleDuration` (Calendar · RangeCalendar, the reference's Display
 * options): how much the calendar shows — a count of days, weeks or months (`calendar-duration`,
 * one unit, whole ≥ 1). Unset = one month (RAC's default). A picker's calendar keeps its own
 * (RAC's picker context does not carry it — `useDatePicker` `calendarProps`).
 */
export const VISIBLE_DURATION_PROP: PropContract = {
  kind: "calendar-duration",
  label: "Visible Duration",
  section: "content",
  default: { months: 1 },
};

/**
 * ADR-256 Phase 9 — RAC `weeksInMonth` (Calendar · RangeCalendar): a fixed number of week rows.
 * Unset = the locale's count for the month (RAC `useCalendarState`). Not a picker prop — a
 * picker's calendar keeps its own, like `visibleDuration`.
 */
export const WEEKS_IN_MONTH_PROP: PropContract = {
  kind: "number",
  label: "Weeks in Month",
  section: "content",
  min: 1,
  step: 1,
};
