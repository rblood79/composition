/**
 * The date segments RAC renders for an empty DateInput (`useDateFieldState`): the locale's
 * `Intl.DateTimeFormat` parts (year · month · day numeric, time fields `minute`/`second` 2-digit),
 * each editable field shown as its placeholder and each literal as written. Canvas measures the
 * same parts the DOM lays out, so a DateInput's content box is the RAC segment row.
 *
 * Placeholders mirror react-stately `datepicker/placeholders` (Chrome/Firefox `<input type=date>`
 * strings, Apache-2.0) for the locales the builder offers; other languages fall back to `en` like
 * RAC's dictionary. Time fields show `––`; `dayPeriod` / `era` show their value.
 */
const PLACEHOLDERS: Readonly<
  Record<string, { year: string; month: string; day: string }>
> = {
  en: { year: "yyyy", month: "mm", day: "dd" },
  de: { year: "jjjj", month: "mm", day: "tt" },
  es: { year: "aaaa", month: "mm", day: "dd" },
  fr: { year: "aaaa", month: "mm", day: "jj" },
  it: { year: "aaaa", month: "mm", day: "gg" },
  ja: { year: "年", month: "月", day: "日" },
  ko: { year: "연도", month: "월", day: "일" },
  pt: { year: "aaaa", month: "mm", day: "dd" },
  ru: { year: "гггг", month: "мм", day: "дд" },
  zh: { year: "年", month: "月", day: "日" },
};

export interface DateSegmentPart {
  text: string;
  /** Editable field (padded) vs literal separator. */
  editable: boolean;
}

export function racDateSegmentParts(options: {
  locale?: string;
  granularity?: string;
  hourCycle?: number;
}): DateSegmentPart[] {
  const locale = options.locale || "en-US";
  const granularity = options.granularity || "day";
  const hasTime =
    granularity === "hour" ||
    granularity === "minute" ||
    granularity === "second";
  const format = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    ...(hasTime
      ? {
          hour: "numeric",
          ...(granularity !== "hour" ? { minute: "2-digit" } : {}),
          ...(granularity === "second" ? { second: "2-digit" } : {}),
          ...(options.hourCycle === 12
            ? { hour12: true }
            : options.hourCycle === 24
              ? { hourCycle: "h23" as const }
              : {}),
        }
      : {}),
  });
  const language = locale.split("-")[0];
  const placeholder = PLACEHOLDERS[locale] ?? PLACEHOLDERS[language] ?? PLACEHOLDERS.en;
  return format.formatToParts(new Date(2000, 0, 1, 12)).map((part) => {
    if (part.type === "literal") return { text: part.value, editable: false };
    if (part.type === "year" || part.type === "month" || part.type === "day")
      return { text: placeholder[part.type], editable: true };
    if (part.type === "dayPeriod" || part.type === "era")
      return { text: part.value, editable: true };
    return { text: "\u2013\u2013", editable: true };
  });
}
